import type {
  AiComparisonResult,
  AiProviderSettings,
  AppConfig,
  CompareDocumentsInput,
  CreateDocumentProblemInput,
  DesktopAPI,
  DocumentImportRole,
  DocumentProblemRecord,
  DocumentRecord,
  DocumentComparisonProgress,
  ImportedDocument,
  PlatformInfo,
  SelectedFile,
  UpdateDocumentInput,
  UpdateDocumentProblemInput,
  UpdateState,
  UpdateAiProviderSettingsInput,
} from '@shared/types'
import { createDesktopAPI } from '@shared/desktop-api'
import { hasPdfSignature, isPdfFileName } from '@shared/document-file'

let previewConfig: AppConfig = { theme: 'system', releaseChannel: 'stable' }
let previewDocuments: DocumentRecord[] = createPreviewDocuments()
let previewProblems: DocumentProblemRecord[] = createPreviewProblems()
let previewAiSettings: AiProviderSettings = {
  apiKeyConfigured: false,
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  compareModel: 'qwen-plus',
  ocrModel: 'qwen3.5-ocr',
}
const previewComparisons = new Map<string, AiComparisonResult>()
const archivedPreviewComparison = createArchivedPreviewComparison()
previewComparisons.set(getComparisonKey(archivedPreviewComparison), archivedPreviewComparison)
const previewComparisonProgressListeners = new Set<(progress: DocumentComparisonProgress) => void>()
const previewUrls = new Map<string, string>()

const previewPlatform: PlatformInfo = {
  platform: 'browser',
  name: getPreviewPlatformName(),
  arch: 'preview',
  versions: {
    electron: 'not available',
    chrome: navigator.userAgent,
    node: 'not available',
  },
  canAutoUpdate: true,
}

let previewUpdateState: UpdateState = {
  status: 'idle',
  channel: 'stable',
  message: '可以检查是否有新版本。',
}
const previewUpdateStateListeners = new Set<(state: UpdateState) => void>()

const previewAPI: DesktopAPI = {
  getVersion: async () => 'browser-preview',
  getPlatformInfo: async () => previewPlatform,
  openExternal: async (url) => {
    const parsed = new URL(url)
    if (!['https:', 'mailto:'].includes(parsed.protocol))
      throw new Error('Unsupported URL protocol.')
    window.open(parsed.toString(), '_blank', 'noopener,noreferrer')
  },
  selectFile: selectBrowserFile,
  importDocument: importBrowserDocument,
  listDocuments: async () => previewDocuments.map((document) => ({ ...document })),
  getDocumentPreview: async (id) => previewUrls.get(id) ?? '',
  updateDocument: async (input) => updatePreviewDocument(input),
  deleteDocument: async (id) => deletePreviewDocument(id),
  listDocumentProblems: async () => previewProblems.map((problem) => ({ ...problem })),
  createDocumentProblem: async (input) => createPreviewProblem(input),
  updateDocumentProblem: async (input) => updatePreviewProblem(input),
  deleteDocumentProblem: async (id) => deletePreviewProblem(id),
  getAiProviderSettings: async () => ({ ...previewAiSettings }),
  updateAiProviderSettings: async (input) => updatePreviewAiSettings(input),
  compareDocuments: async (input) => createPreviewComparison(input),
  getLatestDocumentComparison: async (input) =>
    previewComparisons.get(getComparisonKey(input)) ?? null,
  getLatestCandidateComparison: async (candidateDocumentId) =>
    [...previewComparisons.values()]
      .filter((comparison) => comparison.candidateDocumentId === candidateDocumentId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null,
  onDocumentComparisonProgress: (callback) => {
    previewComparisonProgressListeners.add(callback)
    return () => previewComparisonProgressListeners.delete(callback)
  },
  openLogDirectory: async () => undefined,
  getConfig: async () => ({ ...previewConfig }),
  setTheme: async (theme) => {
    previewConfig = { ...previewConfig, theme }
    return { ...previewConfig }
  },
  getUpdateState: async () => ({ ...previewUpdateState }),
  checkForUpdates: runPreviewUpdateFlow,
  installUpdate: async () => {
    setPreviewUpdateState({
      ...previewUpdateState,
      message: '浏览器预览不会重启；正式安装包会重启并完成升级。',
    })
  },
  onUpdateStateChanged: (callback) => {
    previewUpdateStateListeners.add(callback)
    return () => previewUpdateStateListeners.delete(callback)
  },
}

const bridge = window.desktopAPI as Partial<DesktopAPI> | undefined

export const desktopAPI = createDesktopAPI(bridge, previewAPI)

export const isBrowserPreview = bridge === undefined

function selectBrowserFile(): Promise<SelectedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.hidden = true

    const finish = (): void => {
      const file = input.files?.[0]
      input.remove()
      resolve(
        file
          ? {
              name: file.name,
              path: `Browser selection: ${file.name}`,
              size: file.size,
            }
          : null,
      )
    }

    input.addEventListener('change', finish, { once: true })
    input.addEventListener('cancel', finish, { once: true })
    document.body.append(input)
    input.click()
  })
}

function importBrowserDocument(role: DocumentImportRole): Promise<ImportedDocument[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf,.pdf'
    input.multiple = true
    input.hidden = true

    const finish = async (): Promise<void> => {
      const files = Array.from(input.files ?? [])
      input.remove()
      if (files.length === 0) {
        resolve([])
        return
      }

      try {
        if (files.some((file) => !isPdfFileName(file.name))) {
          throw new Error('Only PDF documents can be imported.')
        }

        const importedDocuments = await Promise.all(
          files.map(async (file): Promise<ImportedDocument> => {
            const signature = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
            if (!hasPdfSignature(signature)) {
              throw new Error('Only valid PDF documents can be imported.')
            }

            const previewUrl = await readFileAsDataUrl(file)
            const importedAt = new Date().toISOString()
            const id = `${role === 'standard' ? 'STD' : 'DOC'}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
            const compareStatus = role === 'candidate' ? '待比对' : undefined
            return {
              id,
              role,
              name: file.name,
              size: file.size,
              pageCount: 1,
              kind: 'unknown-pdf',
              status: 'imported',
              ...(compareStatus ? { compareStatus } : {}),
              importedAt,
              updatedAt: importedAt,
              previewUrl,
            }
          }),
        )

        previewDocuments = [...importedDocuments.map(toDocumentRecord), ...previewDocuments]
        for (const document of importedDocuments) {
          if (document.previewUrl) previewUrls.set(document.id, document.previewUrl)
        }
        resolve(importedDocuments)
      } catch (cause) {
        reject(cause)
      }
    }

    input.addEventListener('change', () => void finish(), { once: true })
    input.addEventListener('cancel', () => void finish(), { once: true })
    document.body.append(input)
    input.click()
  })
}

function updatePreviewDocument(input: UpdateDocumentInput): DocumentRecord {
  const index = previewDocuments.findIndex((document) => document.id === input.id)
  const current = previewDocuments[index]
  if (index < 0 || !current) throw new Error('Document not found.')
  const updated: DocumentRecord = {
    ...current,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.compareStatus !== undefined ? { compareStatus: input.compareStatus } : {}),
    updatedAt: new Date().toISOString(),
  }
  previewDocuments[index] = updated
  return { ...updated }
}

function deletePreviewDocument(id: string): boolean {
  const previousLength = previewDocuments.length
  previewDocuments = previewDocuments.filter((document) => document.id !== id)
  previewProblems = previewProblems.filter((problem) => problem.documentId !== id)
  previewUrls.delete(id)
  return previewDocuments.length < previousLength
}

function createPreviewProblem(input: CreateDocumentProblemInput): DocumentProblemRecord {
  const document = previewDocuments.find((item) => item.id === input.documentId)
  if (!document) throw new Error('Document not found.')
  const now = new Date().toISOString()
  const problem: DocumentProblemRecord = {
    id: `PRB-${Date.now().toString(36).toUpperCase()}`,
    documentId: input.documentId,
    fileName: document.name,
    type: input.type,
    summary: input.summary,
    page: input.page,
    severity: input.severity,
    confidence: input.confidence,
    createdAt: now,
    updatedAt: now,
  }
  previewProblems = [problem, ...previewProblems]
  return { ...problem }
}

function updatePreviewProblem(input: UpdateDocumentProblemInput): DocumentProblemRecord {
  const index = previewProblems.findIndex((problem) => problem.id === input.id)
  const current = previewProblems[index]
  if (index < 0 || !current) throw new Error('Document problem not found.')
  const updated: DocumentProblemRecord = {
    ...current,
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
    ...(input.page !== undefined ? { page: input.page } : {}),
    ...(input.severity !== undefined ? { severity: input.severity } : {}),
    ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
    updatedAt: new Date().toISOString(),
  }
  previewProblems[index] = updated
  return { ...updated }
}

function deletePreviewProblem(id: string): boolean {
  const previousLength = previewProblems.length
  previewProblems = previewProblems.filter((problem) => problem.id !== id)
  return previewProblems.length < previousLength
}

function updatePreviewAiSettings(input: UpdateAiProviderSettingsInput): AiProviderSettings {
  previewAiSettings = {
    apiKeyConfigured: input.clearApiKey
      ? false
      : Boolean(input.apiKey) || previewAiSettings.apiKeyConfigured,
    baseUrl: input.baseUrl,
    compareModel: input.compareModel,
    ocrModel: input.ocrModel,
  }
  return { ...previewAiSettings }
}

async function createPreviewComparison(input: CompareDocumentsInput): Promise<AiComparisonResult> {
  emitPreviewComparisonProgress(input.candidateDocumentId, {
    stage: 'preparing',
    message: '正在准备文书内容',
  })
  await waitForPreviewProgress()
  emitPreviewComparisonProgress(input.candidateDocumentId, {
    stage: 'ocr',
    message: '待比对文书：第 1 页 OCR 识别完成',
    documentRole: 'candidate',
    page: 1,
    totalPages: 1,
    textPreview: '采购服务合同 第三条 付款安排 甲方应在验收合格后45日内支付合同款。',
  })
  await waitForPreviewProgress()
  emitPreviewComparisonProgress(input.candidateDocumentId, {
    stage: 'comparing',
    message: 'OCR 与文本提取完成，正在执行大模型对比',
  })
  await waitForPreviewProgress()
  const result: AiComparisonResult = {
    id: `AIC-${Date.now().toString(36).toUpperCase()}`,
    standardDocumentId: input.standardDocumentId,
    candidateDocumentId: input.candidateDocumentId,
    conclusion: 'has_issue',
    summary: '发现 3 项可能影响合同履行的实质差异，建议人工复核。',
    model: previewAiSettings.compareModel,
    findings: [
      {
        id: 'AIF-PREVIEW-1',
        type: '关键字段变化',
        title: '付款期限发生变化',
        detail: '付款期限由验收后30日调整为45日。',
        standardValue: '30日',
        candidateValue: '45日',
        standardPage: 3,
        candidatePage: 3,
        severity: 'high',
        confidence: 0.96,
      },
      {
        id: 'AIF-PREVIEW-2',
        type: '关键字段变化',
        title: '违约金比例变化',
        detail: '逾期付款违约金比例由万分之五调整为万分之三。',
        standardValue: '万分之五',
        candidateValue: '万分之三',
        standardPage: 5,
        candidatePage: 5,
        severity: 'medium',
        confidence: 0.93,
      },
      {
        id: 'AIF-PREVIEW-3',
        type: 'OCR疑点',
        title: '金额区域文字不清晰',
        detail: '扫描页金额区域存在无法确认的字符，建议人工复核。',
        candidatePage: 12,
        severity: 'medium',
        confidence: 0.68,
      },
    ],
    createdAt: new Date().toISOString(),
  }
  previewComparisons.set(getComparisonKey(input), result)
  updatePreviewDocument({ id: input.candidateDocumentId, compareStatus: '待查看' })
  emitPreviewComparisonProgress(input.candidateDocumentId, {
    stage: 'complete',
    message: 'AI 对比完成',
  })
  return structuredClone(result)
}

function emitPreviewComparisonProgress(
  candidateDocumentId: string,
  progress: Omit<DocumentComparisonProgress, 'candidateDocumentId'>,
): void {
  const event = { candidateDocumentId, ...progress }
  for (const listener of previewComparisonProgressListeners) listener(event)
}

function waitForPreviewProgress(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 180))
}

async function runPreviewUpdateFlow(): Promise<UpdateState> {
  setPreviewUpdateState({ status: 'checking', channel: 'stable', message: '正在检查新版本...' })
  await waitForPreviewProgress()
  setPreviewUpdateState({
    status: 'downloading',
    channel: 'stable',
    message: '发现新版本，正在下载...',
    version: '0.2.0-preview',
    progress: { percent: 65, transferred: 65, total: 100, bytesPerSecond: 1024 },
  })
  await waitForPreviewProgress()
  setPreviewUpdateState({
    status: 'downloaded',
    channel: 'stable',
    message: '新版本已下载完成，可以重启应用并安装。',
    version: '0.2.0-preview',
    progress: { percent: 100, transferred: 100, total: 100, bytesPerSecond: 0 },
  })
  return { ...previewUpdateState }
}

function setPreviewUpdateState(state: UpdateState): void {
  previewUpdateState = state
  for (const listener of previewUpdateStateListeners) listener({ ...state })
}

function getComparisonKey(input: CompareDocumentsInput): string {
  return `${input.standardDocumentId}:${input.candidateDocumentId}`
}

function toDocumentRecord(document: ImportedDocument): DocumentRecord {
  return {
    id: document.id,
    role: document.role,
    name: document.name,
    size: document.size,
    pageCount: document.pageCount,
    kind: document.kind,
    ...(document.compareStatus ? { compareStatus: document.compareStatus } : {}),
    importedAt: document.importedAt,
    updatedAt: document.updatedAt,
  }
}

function createPreviewDocuments(): DocumentRecord[] {
  return [
    createPreviewDocument('STD-001', 'standard', '采购服务合同_标准模板.pdf', 18, 'native-pdf'),
    createPreviewDocument('STD-002', 'standard', '保密协议_标准模板.pdf', 8, 'native-pdf'),
    createPreviewDocument(
      'DOC-2026-001',
      'candidate',
      '采购服务合同_上海分公司扫描件.pdf',
      18,
      'scanned-pdf',
      '待比对',
    ),
    createPreviewDocument(
      'DOC-2026-002',
      'candidate',
      '采购服务合同_北京分公司盖章版.pdf',
      18,
      'native-pdf',
      '待查看',
    ),
    createPreviewDocument(
      'DOC-2026-003',
      'candidate',
      '采购服务合同_华南区域复印件.pdf',
      17,
      'scanned-pdf',
      '有问题',
    ),
    createPreviewDocument(
      'DOC-2026-004',
      'candidate',
      '采购服务合同_西区扫描件.pdf',
      18,
      'scanned-pdf',
      '比对中',
    ),
  ]
}

function createPreviewDocument(
  id: string,
  role: DocumentImportRole,
  name: string,
  pageCount: number,
  kind: DocumentRecord['kind'],
  compareStatus?: DocumentRecord['compareStatus'],
): DocumentRecord {
  const now = new Date().toISOString()
  return {
    id,
    role,
    name,
    size: 0,
    pageCount,
    kind,
    ...(compareStatus ? { compareStatus } : {}),
    importedAt: now,
    updatedAt: now,
  }
}

function createPreviewProblems(): DocumentProblemRecord[] {
  const now = new Date().toISOString()
  return [
    createPreviewProblemRecord(
      'PRB-001',
      'DOC-2026-002',
      '采购服务合同_北京分公司盖章版.pdf',
      '关键字段变化',
      '付款期限从30日调整为45日',
      3,
      'high',
      0.96,
      now,
    ),
    createPreviewProblemRecord(
      'PRB-002',
      'DOC-2026-003',
      '采购服务合同_华南区域复印件.pdf',
      '页数不一致',
      '待比对文书缺少第14页',
      14,
      'high',
      0.99,
      now,
    ),
    createPreviewProblemRecord(
      'PRB-003',
      'DOC-2026-003',
      '采购服务合同_华南区域复印件.pdf',
      'OCR疑点',
      '金额区域识别置信度偏低',
      12,
      'medium',
      0.68,
      now,
    ),
    createPreviewProblemRecord(
      'PRB-004',
      'DOC-2026-002',
      '采购服务合同_北京分公司盖章版.pdf',
      '条款缺失',
      '未检测到数据保密义务对应条款',
      9,
      'medium',
      0.9,
      now,
    ),
  ]
}

function createArchivedPreviewComparison(): AiComparisonResult {
  return {
    id: 'AIC-PREVIEW-ARCHIVED',
    standardDocumentId: 'STD-001',
    candidateDocumentId: 'DOC-2026-003',
    conclusion: 'has_issue',
    summary: '服务验收标准和数据交付要求存在实质变化，已由人工确认归档。',
    model: 'qwen-plus',
    findings: [
      {
        id: 'AIF-PREVIEW-ARCHIVED-1',
        type: '关键字段变化',
        title: '服务验收标准降低',
        detail: '待比对文书取消了标准文书中的月度数据完整性核验要求。',
        standardPage: 6,
        candidatePage: 6,
        severity: 'high',
        confidence: 0.96,
      },
      {
        id: 'AIF-PREVIEW-ARCHIVED-2',
        type: '条款缺失',
        title: '缺少异常数据补交要求',
        detail: '待比对文书未约定异常数据发现后的补交时限。',
        standardPage: 8,
        candidatePage: 8,
        severity: 'medium',
        confidence: 0.91,
      },
    ],
    createdAt: new Date().toISOString(),
  }
}

function createPreviewProblemRecord(
  id: string,
  documentId: string,
  fileName: string,
  type: DocumentProblemRecord['type'],
  summary: string,
  page: number,
  severity: DocumentProblemRecord['severity'],
  confidence: number,
  now: string,
): DocumentProblemRecord {
  return {
    id,
    documentId,
    fileName,
    type,
    summary,
    page,
    severity,
    confidence,
    createdAt: now,
    updatedAt: now,
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)), { once: true })
    reader.addEventListener('error', () => reject(new Error('无法读取所选PDF文件。')), {
      once: true,
    })
    reader.readAsDataURL(file)
  })
}

function getPreviewPlatformName(): PlatformInfo['name'] {
  const userAgent = navigator.userAgent.toLocaleLowerCase()
  if (userAgent.includes('win')) return 'windows'
  if (userAgent.includes('linux')) return 'linux'
  return 'macos'
}
