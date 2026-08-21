import { randomUUID } from 'node:crypto'
import { DatabaseSync, type SQLOutputValue } from 'node:sqlite'
import type {
  AiComparisonConclusion,
  AiComparisonFinding,
  AiComparisonResult,
  ComparisonBatch,
  ComparisonBatchItem,
  ComparisonBatchItemStatus,
  ComparisonBatchStatus,
  CreateDocumentProblemInput,
  DocumentCompareStatus,
  DocumentImportRole,
  DocumentKind,
  DocumentProblemRecord,
  DocumentProblemSeverity,
  DocumentProblemType,
  DocumentRecord,
  DocumentTextPage,
  UpdateDocumentInput,
  UpdateDocumentProblemInput,
} from '@shared/types'

export interface CreateDocumentRecordInput {
  id: string
  role: DocumentImportRole
  name: string
  storageKey: string
  size: number
  pageCount: number
  kind: DocumentKind
  compareStatus?: DocumentCompareStatus
  importedAt: string
}

export interface SaveAiComparisonInput {
  standardDocumentId: string
  candidateDocumentId: string
  conclusion: AiComparisonConclusion
  summary: string
  model: string
  findings: Array<Omit<AiComparisonFinding, 'id'>>
}

export interface CreateComparisonBatchRecordInput {
  standardDocumentId: string
  candidateDocumentIds: string[]
  compareModel: string
}

type DatabaseRow = Record<string, SQLOutputValue>

export class DocumentDatabase {
  readonly #database: DatabaseSync

  constructor(databasePath: string) {
    this.#database = new DatabaseSync(databasePath)
    this.#database.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('standard', 'candidate')),
        name TEXT NOT NULL,
        storage_key TEXT NOT NULL UNIQUE,
        size INTEGER NOT NULL CHECK (size >= 0),
        page_count INTEGER NOT NULL CHECK (page_count > 0),
        kind TEXT NOT NULL CHECK (kind IN ('native-pdf', 'scanned-pdf', 'mixed-pdf', 'unknown-pdf')),
        compare_status TEXT CHECK (compare_status IN ('待比对', '比对中', '待查看', '有问题')),
        imported_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS document_problems (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('OCR疑点', '关键字段变化', '页数不一致', '条款缺失')),
        summary TEXT NOT NULL,
        page INTEGER NOT NULL CHECK (page > 0),
        severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
        confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS document_pages (
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        page_number INTEGER NOT NULL CHECK (page_number > 0),
        text TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('native', 'ocr')),
        confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
        updated_at TEXT NOT NULL,
        PRIMARY KEY (document_id, page_number)
      );

      CREATE TABLE IF NOT EXISTS document_comparisons (
        id TEXT PRIMARY KEY,
        standard_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        candidate_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        conclusion TEXT NOT NULL CHECK (conclusion IN ('no_issue', 'has_issue', 'needs_review')),
        summary TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS comparison_findings (
        id TEXT PRIMARY KEY,
        comparison_id TEXT NOT NULL REFERENCES document_comparisons(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('OCR疑点', '关键字段变化', '页数不一致', '条款缺失')),
        title TEXT NOT NULL,
        detail TEXT NOT NULL,
        standard_value TEXT,
        candidate_value TEXT,
        standard_page INTEGER CHECK (standard_page IS NULL OR standard_page > 0),
        candidate_page INTEGER CHECK (candidate_page IS NULL OR candidate_page > 0),
        severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
        confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1)
      );

      CREATE TABLE IF NOT EXISTS comparison_batches (
        id TEXT PRIMARY KEY,
        standard_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (
          status IN ('queued', 'running', 'completed', 'partial_failure', 'paused', 'cancelled')
        ),
        total_count INTEGER NOT NULL CHECK (total_count > 0),
        completed_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
        failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
        compare_model TEXT NOT NULL,
        progress_message TEXT NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      );

      CREATE TABLE IF NOT EXISTS comparison_batch_items (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL REFERENCES comparison_batches(id) ON DELETE CASCADE,
        candidate_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (
          status IN (
            'queued', 'preparing', 'extracting', 'ocr', 'comparing', 'saving',
            'succeeded', 'failed', 'cancelled'
          )
        ),
        progress_message TEXT NOT NULL,
        current_page INTEGER CHECK (current_page IS NULL OR current_page > 0),
        total_pages INTEGER CHECK (total_pages IS NULL OR total_pages > 0),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        comparison_id TEXT REFERENCES document_comparisons(id) ON DELETE SET NULL,
        error_message TEXT,
        started_at TEXT,
        finished_at TEXT,
        UNIQUE(batch_id, candidate_document_id)
      );

      CREATE INDEX IF NOT EXISTS documents_role_index ON documents(role);
      CREATE INDEX IF NOT EXISTS documents_status_index ON documents(compare_status);
      CREATE INDEX IF NOT EXISTS document_problems_document_index ON document_problems(document_id);
      CREATE INDEX IF NOT EXISTS document_comparisons_pair_index
        ON document_comparisons(standard_document_id, candidate_document_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS comparison_findings_comparison_index
        ON comparison_findings(comparison_id);
      CREATE INDEX IF NOT EXISTS comparison_batches_created_index
        ON comparison_batches(created_at DESC);
      CREATE INDEX IF NOT EXISTS comparison_batch_items_batch_index
        ON comparison_batch_items(batch_id);

      PRAGMA user_version = 3;
    `)
  }

  close(): void {
    if (this.#database.isOpen) this.#database.close()
  }

  createDocument(input: CreateDocumentRecordInput): DocumentRecord {
    const compareStatus = input.compareStatus ?? (input.role === 'candidate' ? '待比对' : null)
    this.#database
      .prepare(
        `INSERT INTO documents (
          id, role, name, storage_key, size, page_count, kind, compare_status, imported_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.role,
        input.name,
        input.storageKey,
        input.size,
        input.pageCount,
        input.kind,
        compareStatus,
        input.importedAt,
        input.importedAt,
      )
    return this.getDocument(input.id)
  }

  listDocuments(): DocumentRecord[] {
    return this.#database
      .prepare(
        `SELECT id, role, name, size, page_count, kind, compare_status, imported_at, updated_at
         FROM documents
         ORDER BY imported_at DESC`,
      )
      .all()
      .map(mapDocumentRow)
  }

  getDocument(id: string): DocumentRecord {
    const row = this.#database
      .prepare(
        `SELECT id, role, name, size, page_count, kind, compare_status, imported_at, updated_at
         FROM documents WHERE id = ?`,
      )
      .get(id)
    if (!row) throw new Error('Document not found.')
    return mapDocumentRow(row)
  }

  getDocumentStorageKey(id: string): string {
    const row = this.#database.prepare('SELECT storage_key FROM documents WHERE id = ?').get(id)
    if (!row) throw new Error('Document not found.')
    return readString(row, 'storage_key')
  }

  getDocumentPages(documentId: string): DocumentTextPage[] {
    return this.#database
      .prepare(
        `SELECT page_number, text, source, confidence
         FROM document_pages WHERE document_id = ? ORDER BY page_number`,
      )
      .all(documentId)
      .map(mapDocumentPageRow)
  }

  replaceDocumentPages(documentId: string, pages: DocumentTextPage[]): void {
    const now = new Date().toISOString()
    this.#database.exec('BEGIN IMMEDIATE')
    try {
      this.#database.prepare('DELETE FROM document_pages WHERE document_id = ?').run(documentId)
      const insert = this.#database.prepare(
        `INSERT INTO document_pages (
          document_id, page_number, text, source, confidence, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      for (const page of pages) {
        insert.run(documentId, page.page, page.text, page.source, page.confidence ?? null, now)
      }
      this.#database.exec('COMMIT')
    } catch (error) {
      this.#database.exec('ROLLBACK')
      throw error
    }
  }

  saveComparison(input: SaveAiComparisonInput): AiComparisonResult {
    const id = `AIC-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`
    const createdAt = new Date().toISOString()
    this.#database.exec('BEGIN IMMEDIATE')
    try {
      this.#database
        .prepare(
          `INSERT INTO document_comparisons (
            id, standard_document_id, candidate_document_id, conclusion, summary, model, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.standardDocumentId,
          input.candidateDocumentId,
          input.conclusion,
          input.summary,
          input.model,
          createdAt,
        )
      const insertFinding = this.#database.prepare(
        `INSERT INTO comparison_findings (
          id, comparison_id, type, title, detail, standard_value, candidate_value,
          standard_page, candidate_page, severity, confidence
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const finding of input.findings) {
        insertFinding.run(
          `AIF-${randomUUID().toUpperCase()}`,
          id,
          finding.type,
          finding.title,
          finding.detail,
          finding.standardValue ?? null,
          finding.candidateValue ?? null,
          finding.standardPage ?? null,
          finding.candidatePage ?? null,
          finding.severity,
          finding.confidence,
        )
      }
      this.#database.exec('COMMIT')
    } catch (error) {
      this.#database.exec('ROLLBACK')
      throw error
    }
    return this.getComparison(id)
  }

  getLatestComparison(
    standardDocumentId: string,
    candidateDocumentId: string,
  ): AiComparisonResult | null {
    const row = this.#database
      .prepare(
        `SELECT id FROM document_comparisons
         WHERE standard_document_id = ? AND candidate_document_id = ?
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(standardDocumentId, candidateDocumentId)
    return row ? this.getComparison(readString(row, 'id')) : null
  }

  getLatestCandidateComparison(candidateDocumentId: string): AiComparisonResult | null {
    const row = this.#database
      .prepare(
        `SELECT id FROM document_comparisons
         WHERE candidate_document_id = ?
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(candidateDocumentId)
    return row ? this.getComparison(readString(row, 'id')) : null
  }

  getComparison(id: string): AiComparisonResult {
    const row = this.#database
      .prepare(
        `SELECT id, standard_document_id, candidate_document_id, conclusion, summary, model, created_at
         FROM document_comparisons WHERE id = ?`,
      )
      .get(id)
    if (!row) throw new Error('Document comparison not found.')
    const findings = this.#database
      .prepare(
        `SELECT id, type, title, detail, standard_value, candidate_value,
                standard_page, candidate_page, severity, confidence
         FROM comparison_findings WHERE comparison_id = ? ORDER BY rowid`,
      )
      .all(id)
      .map(mapComparisonFindingRow)
    return {
      id: readString(row, 'id'),
      standardDocumentId: readString(row, 'standard_document_id'),
      candidateDocumentId: readString(row, 'candidate_document_id'),
      conclusion: readString(row, 'conclusion') as AiComparisonConclusion,
      summary: readString(row, 'summary'),
      model: readString(row, 'model'),
      findings,
      createdAt: readString(row, 'created_at'),
    }
  }

  createComparisonBatch(input: CreateComparisonBatchRecordInput): ComparisonBatch {
    const id = `BAT-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`
    const createdAt = new Date().toISOString()
    this.#database.exec('BEGIN IMMEDIATE')
    try {
      this.#database
        .prepare(
          `INSERT INTO comparison_batches (
            id, standard_document_id, status, total_count, completed_count, failed_count,
            compare_model, progress_message, created_at
          ) VALUES (?, ?, 'queued', ?, 0, 0, ?, ?, ?)`,
        )
        .run(
          id,
          input.standardDocumentId,
          input.candidateDocumentIds.length,
          input.compareModel,
          '等待开始批量分析',
          createdAt,
        )
      const insertItem = this.#database.prepare(
        `INSERT INTO comparison_batch_items (
          id, batch_id, candidate_document_id, status, progress_message
        ) VALUES (?, ?, ?, 'queued', ?)`,
      )
      for (const candidateDocumentId of input.candidateDocumentIds) {
        insertItem.run(`BAI-${randomUUID().toUpperCase()}`, id, candidateDocumentId, '等待分析')
      }
      this.#database.exec('COMMIT')
    } catch (error) {
      this.#database.exec('ROLLBACK')
      throw error
    }
    return this.getComparisonBatch(id)
  }

  getComparisonBatch(id: string): ComparisonBatch {
    const row = this.#database
      .prepare(
        `SELECT b.id, b.standard_document_id, d.name AS standard_document_name, b.status,
                b.total_count, b.completed_count, b.failed_count, b.compare_model,
                b.progress_message, b.error_message, b.created_at, b.started_at, b.finished_at
         FROM comparison_batches b
         JOIN documents d ON d.id = b.standard_document_id
         WHERE b.id = ?`,
      )
      .get(id)
    if (!row) throw new Error('Comparison batch not found.')
    const items = this.#database
      .prepare(
        `SELECT i.id, i.batch_id, i.candidate_document_id, d.name AS candidate_name,
                i.status, i.progress_message, i.current_page, i.total_pages,
                i.attempt_count, i.comparison_id, i.error_message, i.started_at, i.finished_at
         FROM comparison_batch_items i
         JOIN documents d ON d.id = i.candidate_document_id
         WHERE i.batch_id = ? ORDER BY i.rowid`,
      )
      .all(id)
      .map(mapComparisonBatchItemRow)
    return mapComparisonBatchRow(row, items)
  }

  getLatestComparisonBatch(): ComparisonBatch | null {
    const row = this.#database
      .prepare('SELECT id FROM comparison_batches ORDER BY created_at DESC, rowid DESC LIMIT 1')
      .get()
    return row ? this.getComparisonBatch(readString(row, 'id')) : null
  }

  getNextQueuedComparisonBatchItem(batchId: string): ComparisonBatchItem | null {
    const row = this.#database
      .prepare(
        `SELECT i.id, i.batch_id, i.candidate_document_id, d.name AS candidate_name,
                i.status, i.progress_message, i.current_page, i.total_pages,
                i.attempt_count, i.comparison_id, i.error_message, i.started_at, i.finished_at
         FROM comparison_batch_items i
         JOIN documents d ON d.id = i.candidate_document_id
         WHERE i.batch_id = ? AND i.status = 'queued' ORDER BY i.rowid LIMIT 1`,
      )
      .get(batchId)
    return row ? mapComparisonBatchItemRow(row) : null
  }

  updateComparisonBatch(
    id: string,
    input: {
      status?: ComparisonBatchStatus
      progressMessage?: string
      errorMessage?: string | null
      markStarted?: boolean
      markFinished?: boolean
    },
  ): ComparisonBatch {
    const current = this.getComparisonBatch(id)
    const now = new Date().toISOString()
    this.#database
      .prepare(
        `UPDATE comparison_batches
         SET status = ?, progress_message = ?, error_message = ?,
             started_at = ?, finished_at = ?
         WHERE id = ?`,
      )
      .run(
        input.status ?? current.status,
        input.progressMessage ?? current.progressMessage,
        input.errorMessage === undefined ? (current.errorMessage ?? null) : input.errorMessage,
        input.markStarted ? (current.startedAt ?? now) : (current.startedAt ?? null),
        input.markFinished ? now : (current.finishedAt ?? null),
        id,
      )
    return this.getComparisonBatch(id)
  }

  startComparisonBatchItem(id: string): void {
    this.#database
      .prepare(
        `UPDATE comparison_batch_items
         SET status = 'preparing', progress_message = '正在准备文书内容',
             attempt_count = attempt_count + 1, error_message = NULL,
             current_page = NULL, total_pages = NULL,
             started_at = COALESCE(started_at, ?), finished_at = NULL
         WHERE id = ?`,
      )
      .run(new Date().toISOString(), id)
  }

  updateComparisonBatchItemProgress(
    id: string,
    status: ComparisonBatchItemStatus,
    progressMessage: string,
    currentPage?: number,
    totalPages?: number,
  ): void {
    this.#database
      .prepare(
        `UPDATE comparison_batch_items
         SET status = ?, progress_message = ?, current_page = ?, total_pages = ?
         WHERE id = ?`,
      )
      .run(status, progressMessage, currentPage ?? null, totalPages ?? null, id)
  }

  completeComparisonBatchItem(id: string, comparisonId: string): void {
    this.#database
      .prepare(
        `UPDATE comparison_batch_items
         SET status = 'succeeded', progress_message = 'AI 对比完成', comparison_id = ?,
             error_message = NULL, finished_at = ?
         WHERE id = ?`,
      )
      .run(comparisonId, new Date().toISOString(), id)
  }

  failComparisonBatchItem(id: string, errorMessage: string): void {
    this.#database
      .prepare(
        `UPDATE comparison_batch_items
         SET status = 'failed', progress_message = '分析失败', error_message = ?, finished_at = ?
         WHERE id = ?`,
      )
      .run(errorMessage, new Date().toISOString(), id)
  }

  refreshComparisonBatchCounts(id: string): ComparisonBatch {
    this.#database
      .prepare(
        `UPDATE comparison_batches
         SET completed_count = (
               SELECT COUNT(*) FROM comparison_batch_items
               WHERE batch_id = ? AND status = 'succeeded'
             ),
             failed_count = (
               SELECT COUNT(*) FROM comparison_batch_items
               WHERE batch_id = ? AND status = 'failed'
             )
         WHERE id = ?`,
      )
      .run(id, id, id)
    return this.getComparisonBatch(id)
  }

  cancelComparisonBatch(id: string): ComparisonBatch {
    const now = new Date().toISOString()
    this.#database.exec('BEGIN IMMEDIATE')
    try {
      this.#database
        .prepare(
          `UPDATE comparison_batch_items
           SET status = 'cancelled', progress_message = '已取消', finished_at = ?
           WHERE batch_id = ? AND status NOT IN ('succeeded', 'failed', 'cancelled')`,
        )
        .run(now, id)
      this.#database
        .prepare(
          `UPDATE comparison_batches
           SET status = 'cancelled', progress_message = '批量分析已取消', finished_at = ?
           WHERE id = ?`,
        )
        .run(now, id)
      this.#database.exec('COMMIT')
    } catch (error) {
      this.#database.exec('ROLLBACK')
      throw error
    }
    return this.refreshComparisonBatchCounts(id)
  }

  retryComparisonBatch(id: string): ComparisonBatch {
    this.#database.exec('BEGIN IMMEDIATE')
    try {
      this.#database
        .prepare(
          `UPDATE comparison_batch_items
           SET status = 'queued', progress_message = '等待重试', error_message = NULL,
               current_page = NULL, total_pages = NULL, comparison_id = NULL, finished_at = NULL
           WHERE batch_id = ? AND status IN ('failed', 'cancelled')`,
        )
        .run(id)
      this.#database
        .prepare(
          `UPDATE comparison_batches
           SET status = 'queued', progress_message = '等待重试失败项目',
               error_message = NULL, finished_at = NULL
           WHERE id = ?`,
        )
        .run(id)
      this.#database.exec('COMMIT')
    } catch (error) {
      this.#database.exec('ROLLBACK')
      throw error
    }
    return this.refreshComparisonBatchCounts(id)
  }

  recoverInterruptedComparisonBatches(): string[] {
    const rows = this.#database
      .prepare("SELECT id FROM comparison_batches WHERE status IN ('queued', 'running')")
      .all()
    const ids = rows.map((row) => readString(row, 'id'))
    if (ids.length === 0) return []
    this.#database.exec('BEGIN IMMEDIATE')
    try {
      this.#database.exec(`
        UPDATE documents
        SET compare_status = '待比对', updated_at = datetime('now')
        WHERE id IN (
          SELECT candidate_document_id FROM comparison_batch_items
          WHERE status IN ('preparing', 'extracting', 'ocr', 'comparing', 'saving')
        );
        UPDATE comparison_batch_items
        SET status = 'queued', progress_message = '应用重启，等待恢复分析',
            current_page = NULL, total_pages = NULL
        WHERE status IN ('preparing', 'extracting', 'ocr', 'comparing', 'saving');
        UPDATE comparison_batches
        SET status = 'queued', progress_message = '等待恢复批量分析'
        WHERE status = 'running';
      `)
      this.#database.exec('COMMIT')
    } catch (error) {
      this.#database.exec('ROLLBACK')
      throw error
    }
    return ids
  }

  updateDocument(input: UpdateDocumentInput): DocumentRecord {
    const current = this.getDocument(input.id)
    const updatedAt = new Date().toISOString()
    this.#database
      .prepare(
        `UPDATE documents
         SET name = ?, compare_status = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.name ?? current.name,
        input.compareStatus ?? current.compareStatus ?? null,
        updatedAt,
        input.id,
      )
    return this.getDocument(input.id)
  }

  deleteDocument(id: string): string | null {
    const row = this.#database.prepare('SELECT storage_key FROM documents WHERE id = ?').get(id)
    if (!row) return null
    const storageKey = readString(row, 'storage_key')
    this.#database.prepare('DELETE FROM documents WHERE id = ?').run(id)
    return storageKey
  }

  isDocumentInActiveComparisonBatch(id: string): boolean {
    const row = this.#database
      .prepare(
        `SELECT 1
         FROM comparison_batches b
         LEFT JOIN comparison_batch_items i ON i.batch_id = b.id
         WHERE b.status IN ('queued', 'running', 'paused')
           AND (b.standard_document_id = ? OR i.candidate_document_id = ?)
         LIMIT 1`,
      )
      .get(id, id)
    return Boolean(row)
  }

  listProblems(): DocumentProblemRecord[] {
    return this.#database
      .prepare(
        `SELECT p.id, p.document_id, d.name AS file_name, p.type, p.summary, p.page,
                p.severity, p.confidence, p.created_at, p.updated_at
         FROM document_problems p
         JOIN documents d ON d.id = p.document_id
         ORDER BY p.created_at DESC`,
      )
      .all()
      .map(mapProblemRow)
  }

  createProblem(input: CreateDocumentProblemInput): DocumentProblemRecord {
    const id = `PRB-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`
    const now = new Date().toISOString()
    this.#database
      .prepare(
        `INSERT INTO document_problems (
          id, document_id, type, summary, page, severity, confidence, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.documentId,
        input.type,
        input.summary,
        input.page,
        input.severity,
        input.confidence,
        now,
        now,
      )
    return this.getProblem(id)
  }

  updateProblem(input: UpdateDocumentProblemInput): DocumentProblemRecord {
    const current = this.getProblem(input.id)
    const updatedAt = new Date().toISOString()
    this.#database
      .prepare(
        `UPDATE document_problems
         SET type = ?, summary = ?, page = ?, severity = ?, confidence = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.type ?? current.type,
        input.summary ?? current.summary,
        input.page ?? current.page,
        input.severity ?? current.severity,
        input.confidence ?? current.confidence,
        updatedAt,
        input.id,
      )
    return this.getProblem(input.id)
  }

  deleteProblem(id: string): boolean {
    const result = this.#database.prepare('DELETE FROM document_problems WHERE id = ?').run(id)
    return result.changes > 0
  }

  getProblem(id: string): DocumentProblemRecord {
    const row = this.#database
      .prepare(
        `SELECT p.id, p.document_id, d.name AS file_name, p.type, p.summary, p.page,
                p.severity, p.confidence, p.created_at, p.updated_at
         FROM document_problems p
         JOIN documents d ON d.id = p.document_id
         WHERE p.id = ?`,
      )
      .get(id)
    if (!row) throw new Error('Document problem not found.')
    return mapProblemRow(row)
  }
}

function mapDocumentRow(row: DatabaseRow): DocumentRecord {
  const compareStatus = readNullableString(row, 'compare_status')
  return {
    id: readString(row, 'id'),
    role: readString(row, 'role') as DocumentImportRole,
    name: readString(row, 'name'),
    size: readNumber(row, 'size'),
    pageCount: readNumber(row, 'page_count'),
    kind: readString(row, 'kind') as DocumentKind,
    ...(compareStatus ? { compareStatus: compareStatus as DocumentCompareStatus } : {}),
    importedAt: readString(row, 'imported_at'),
    updatedAt: readString(row, 'updated_at'),
  }
}

function mapProblemRow(row: DatabaseRow): DocumentProblemRecord {
  return {
    id: readString(row, 'id'),
    documentId: readString(row, 'document_id'),
    fileName: readString(row, 'file_name'),
    type: readString(row, 'type') as DocumentProblemType,
    summary: readString(row, 'summary'),
    page: readNumber(row, 'page'),
    severity: readString(row, 'severity') as DocumentProblemSeverity,
    confidence: readNumber(row, 'confidence'),
    createdAt: readString(row, 'created_at'),
    updatedAt: readString(row, 'updated_at'),
  }
}

function mapDocumentPageRow(row: DatabaseRow): DocumentTextPage {
  const confidence = readNullableNumber(row, 'confidence')
  return {
    page: readNumber(row, 'page_number'),
    text: readString(row, 'text'),
    source: readString(row, 'source') as DocumentTextPage['source'],
    ...(confidence !== null ? { confidence } : {}),
  }
}

function mapComparisonFindingRow(row: DatabaseRow): AiComparisonFinding {
  const standardValue = readNullableString(row, 'standard_value')
  const candidateValue = readNullableString(row, 'candidate_value')
  const standardPage = readNullableNumber(row, 'standard_page')
  const candidatePage = readNullableNumber(row, 'candidate_page')
  return {
    id: readString(row, 'id'),
    type: readString(row, 'type') as DocumentProblemType,
    title: readString(row, 'title'),
    detail: readString(row, 'detail'),
    ...(standardValue ? { standardValue } : {}),
    ...(candidateValue ? { candidateValue } : {}),
    ...(standardPage !== null ? { standardPage } : {}),
    ...(candidatePage !== null ? { candidatePage } : {}),
    severity: readString(row, 'severity') as DocumentProblemSeverity,
    confidence: readNumber(row, 'confidence'),
  }
}

function mapComparisonBatchRow(row: DatabaseRow, items: ComparisonBatchItem[]): ComparisonBatch {
  const errorMessage = readNullableString(row, 'error_message')
  const startedAt = readNullableString(row, 'started_at')
  const finishedAt = readNullableString(row, 'finished_at')
  return {
    id: readString(row, 'id'),
    standardDocumentId: readString(row, 'standard_document_id'),
    standardDocumentName: readString(row, 'standard_document_name'),
    status: readString(row, 'status') as ComparisonBatchStatus,
    totalCount: readNumber(row, 'total_count'),
    completedCount: readNumber(row, 'completed_count'),
    failedCount: readNumber(row, 'failed_count'),
    compareModel: readString(row, 'compare_model'),
    progressMessage: readString(row, 'progress_message'),
    ...(errorMessage ? { errorMessage } : {}),
    createdAt: readString(row, 'created_at'),
    ...(startedAt ? { startedAt } : {}),
    ...(finishedAt ? { finishedAt } : {}),
    items,
  }
}

function mapComparisonBatchItemRow(row: DatabaseRow): ComparisonBatchItem {
  const currentPage = readNullableNumber(row, 'current_page')
  const totalPages = readNullableNumber(row, 'total_pages')
  const comparisonId = readNullableString(row, 'comparison_id')
  const errorMessage = readNullableString(row, 'error_message')
  const startedAt = readNullableString(row, 'started_at')
  const finishedAt = readNullableString(row, 'finished_at')
  return {
    id: readString(row, 'id'),
    batchId: readString(row, 'batch_id'),
    candidateDocumentId: readString(row, 'candidate_document_id'),
    candidateName: readString(row, 'candidate_name'),
    status: readString(row, 'status') as ComparisonBatchItemStatus,
    progressMessage: readString(row, 'progress_message'),
    ...(currentPage !== null ? { currentPage } : {}),
    ...(totalPages !== null ? { totalPages } : {}),
    attemptCount: readNumber(row, 'attempt_count'),
    ...(comparisonId ? { comparisonId } : {}),
    ...(errorMessage ? { errorMessage } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(finishedAt ? { finishedAt } : {}),
  }
}

function readString(row: DatabaseRow, key: string): string {
  const value = row[key]
  if (typeof value !== 'string') throw new Error(`Invalid database value for ${key}.`)
  return value
}

function readNullableString(row: DatabaseRow, key: string): string | null {
  const value = row[key]
  if (value === null) return null
  if (typeof value !== 'string') throw new Error(`Invalid database value for ${key}.`)
  return value
}

function readNumber(row: DatabaseRow, key: string): number {
  const value = row[key]
  if (typeof value !== 'number') throw new Error(`Invalid database value for ${key}.`)
  return value
}

function readNullableNumber(row: DatabaseRow, key: string): number | null {
  const value = row[key]
  if (value === null) return null
  if (typeof value !== 'number') throw new Error(`Invalid database value for ${key}.`)
  return value
}
