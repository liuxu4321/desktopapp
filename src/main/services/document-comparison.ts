import { requestStructuredComparison } from './dashscope-client'
import { getOrExtractDocumentText } from './document-text'
import { getDocumentDatabase } from './document-store'
import { DOCUMENT_COMPARISON_SYSTEM_PROMPT } from '@shared/document-comparison-prompt'
import type {
  AiComparisonResult,
  CompareDocumentsInput,
  DocumentComparisonProgress,
  DocumentImportRole,
  DocumentTextPage,
} from '@shared/types'

export async function compareDocuments(
  input: CompareDocumentsInput,
  reportProgress?: (progress: DocumentComparisonProgress) => void,
  preloadedStandardPages?: DocumentTextPage[],
): Promise<AiComparisonResult> {
  const database = getDocumentDatabase()
  const standard = database.getDocument(input.standardDocumentId)
  const candidate = database.getDocument(input.candidateDocumentId)
  if (standard.role !== 'standard' || candidate.role !== 'candidate') {
    throw new Error('请选择正确的标准文书和待比对文书。')
  }

  const previousStatus = candidate.compareStatus ?? '待比对'
  database.updateDocument({ id: candidate.id, compareStatus: '比对中' })
  const report = (progress: Omit<DocumentComparisonProgress, 'candidateDocumentId'>): void => {
    reportProgress?.({ candidateDocumentId: candidate.id, ...progress })
  }
  report({ stage: 'preparing', message: '正在准备文书内容' })
  try {
    const [standardPages, candidatePages] = await Promise.all([
      preloadedStandardPages ??
        getOrExtractDocumentText(standard.id, (progress) =>
          reportTextProgress(report, 'standard', progress),
        ),
      getOrExtractDocumentText(candidate.id, (progress) =>
        reportTextProgress(report, 'candidate', progress),
      ),
    ])
    const userPrompt = buildComparisonUserPrompt(
      standard.name,
      standardPages,
      candidate.name,
      candidatePages,
    )
    report({ stage: 'comparing', message: 'OCR 与文本提取完成，正在执行大模型对比' })
    const { model, output } = await requestStructuredComparison(
      DOCUMENT_COMPARISON_SYSTEM_PROMPT,
      userPrompt,
    )
    report({ stage: 'saving', message: '正在校验并保存结构化结果' })
    const saved = database.saveComparison({
      standardDocumentId: standard.id,
      candidateDocumentId: candidate.id,
      conclusion: output.conclusion,
      summary: output.summary,
      model,
      findings: output.findings,
    })
    database.updateDocument({ id: candidate.id, compareStatus: '待查看' })
    report({ stage: 'complete', message: 'AI 对比完成' })
    return saved
  } catch (error) {
    database.updateDocument({ id: candidate.id, compareStatus: previousStatus })
    throw error
  }
}

function reportTextProgress(
  report: (progress: Omit<DocumentComparisonProgress, 'candidateDocumentId'>) => void,
  documentRole: DocumentImportRole,
  progress: {
    stage: 'extracting' | 'ocr'
    message: string
    page: number
    totalPages: number
    textPreview?: string
  },
): void {
  report({
    stage: progress.stage,
    message: `${documentRole === 'standard' ? '标准文书' : '待比对文书'}：${progress.message}`,
    documentRole,
    page: progress.page,
    totalPages: progress.totalPages,
    ...(progress.textPreview ? { textPreview: progress.textPreview } : {}),
  })
}

export function getLatestDocumentComparison(
  input: CompareDocumentsInput,
): AiComparisonResult | null {
  return getDocumentDatabase().getLatestComparison(
    input.standardDocumentId,
    input.candidateDocumentId,
  )
}

export function getLatestCandidateComparison(
  candidateDocumentId: string,
): AiComparisonResult | null {
  return getDocumentDatabase().getLatestCandidateComparison(candidateDocumentId)
}

function buildComparisonUserPrompt(
  standardName: string,
  standardPages: DocumentTextPage[],
  candidateName: string,
  candidatePages: DocumentTextPage[],
): string {
  return `请对比以下两份文书并按系统要求返回结构化结果。

<标准文书 文件名="${escapeAttribute(standardName)}">
${formatPages(standardPages)}
</标准文书>

<待比对文书 文件名="${escapeAttribute(candidateName)}">
${formatPages(candidatePages)}
</待比对文书>`
}

function formatPages(pages: DocumentTextPage[]): string {
  return pages.map((page) => `--- 第${page.page}页 ---\n${page.text}`).join('\n\n')
}

function escapeAttribute(value: string): string {
  return value.replace(/[&"<>]/g, (character) => {
    if (character === '&') return '&amp;'
    if (character === '"') return '&quot;'
    if (character === '<') return '&lt;'
    return '&gt;'
  })
}
