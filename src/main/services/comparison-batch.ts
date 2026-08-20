import { compareDocuments } from './document-comparison'
import { getOrExtractDocumentText } from './document-text'
import { getAiProviderSettings } from './config'
import { getDocumentDatabase } from './document-store'
import type {
  ComparisonBatch,
  ComparisonBatchItemStatus,
  CreateComparisonBatchInput,
  DocumentComparisonProgress,
} from '@shared/types'

type BatchListener = (batch: ComparisonBatch) => void

const RETRY_DELAYS_MS = [800, 1_600]

export class ComparisonBatchService {
  readonly #listeners = new Set<BatchListener>()
  readonly #queuedBatchIds = new Set<string>()
  #draining = false

  initialize(): void {
    for (const batchId of getDocumentDatabase().recoverInterruptedComparisonBatches()) {
      this.#enqueue(batchId)
    }
  }

  subscribe(listener: BatchListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  start(input: CreateComparisonBatchInput): ComparisonBatch {
    const database = getDocumentDatabase()
    const latest = database.getLatestComparisonBatch()
    if (
      this.#draining ||
      this.#queuedBatchIds.size > 0 ||
      (latest && ['queued', 'running', 'paused'].includes(latest.status))
    ) {
      throw new Error('已有批量分析任务正在执行，请等待完成或先取消。')
    }

    const settings = getAiProviderSettings()
    if (!settings.apiKeyConfigured) throw new Error('请先在设置页面配置 DashScope API Key。')
    const standard = database.getDocument(input.standardDocumentId)
    if (standard.role !== 'standard') throw new Error('请选择正确的标准文书。')
    for (const candidateId of input.candidateDocumentIds) {
      const candidate = database.getDocument(candidateId)
      if (candidate.role !== 'candidate') throw new Error('待比对文书选择无效。')
    }

    const batch = database.createComparisonBatch({
      standardDocumentId: input.standardDocumentId,
      candidateDocumentIds: input.candidateDocumentIds,
      compareModel: settings.compareModel,
    })
    this.#enqueue(batch.id)
    return batch
  }

  getLatest(): ComparisonBatch | null {
    const batch = getDocumentDatabase().getLatestComparisonBatch()
    if (batch && ['queued', 'running'].includes(batch.status)) this.#enqueue(batch.id)
    return batch
  }

  retry(batchId: string): ComparisonBatch {
    const database = getDocumentDatabase()
    const batch = database.getComparisonBatch(batchId)
    if (['queued', 'running'].includes(batch.status)) return batch
    const retried = database.retryComparisonBatch(batchId)
    this.#enqueue(batchId)
    return retried
  }

  cancel(batchId: string): ComparisonBatch {
    this.#queuedBatchIds.delete(batchId)
    const batch = getDocumentDatabase().cancelComparisonBatch(batchId)
    this.#emit(batch)
    return batch
  }

  #enqueue(batchId: string): void {
    this.#queuedBatchIds.add(batchId)
    void this.#drain()
  }

  async #drain(): Promise<void> {
    if (this.#draining) return
    this.#draining = true
    try {
      while (this.#queuedBatchIds.size > 0) {
        const batchId = this.#queuedBatchIds.values().next().value as string | undefined
        if (!batchId) break
        this.#queuedBatchIds.delete(batchId)
        try {
          await this.#process(batchId)
        } catch (error) {
          const database = getDocumentDatabase()
          try {
            this.#emit(
              database.updateComparisonBatch(batchId, {
                status: 'paused',
                progressMessage: '批量分析意外中断，任务已暂停',
                errorMessage: getSafeErrorMessage(error),
                markFinished: true,
              }),
            )
          } catch {
            // The batch may have been removed with its documents; avoid an unhandled rejection.
          }
        }
      }
    } finally {
      this.#draining = false
    }
  }

  async #process(batchId: string): Promise<void> {
    const database = getDocumentDatabase()
    let batch = database.getComparisonBatch(batchId)
    if (batch.status === 'cancelled') return
    batch = database.updateComparisonBatch(batchId, {
      status: 'running',
      progressMessage: '正在准备标准文书内容',
      errorMessage: null,
      markStarted: true,
    })
    this.#emit(batch)

    let standardPages
    try {
      standardPages = await getOrExtractDocumentText(batch.standardDocumentId, (progress) => {
        const current = database.getComparisonBatch(batchId)
        if (current.status === 'cancelled') return
        this.#emit(
          database.updateComparisonBatch(batchId, {
            progressMessage: `标准文书：${progress.message}`,
          }),
        )
      })
    } catch (error) {
      this.#emit(
        database.updateComparisonBatch(batchId, {
          status: 'paused',
          progressMessage: '标准文书处理失败，批次已暂停',
          errorMessage: getSafeErrorMessage(error),
          markFinished: true,
        }),
      )
      return
    }

    while (true) {
      batch = database.getComparisonBatch(batchId)
      if (batch.status === 'cancelled') return
      const item = database.getNextQueuedComparisonBatchItem(batchId)
      if (!item) break

      let resultId: string | null = null
      let finalError: unknown
      for (let attempt = 0; attempt < 3; attempt += 1) {
        database.startComparisonBatchItem(item.id)
        this.#emitCurrent(batchId, `正在分析 ${item.candidateName}`)
        try {
          const result = await compareDocuments(
            {
              standardDocumentId: batch.standardDocumentId,
              candidateDocumentId: item.candidateDocumentId,
            },
            (progress) => this.#handleItemProgress(batchId, item.id, progress),
            standardPages,
          )
          resultId = result.id
          break
        } catch (error) {
          finalError = error
          if (!isTransientError(error) || attempt === 2) break
          database.updateComparisonBatchItemProgress(
            item.id,
            'preparing',
            `网络繁忙，${RETRY_DELAYS_MS[attempt] ? '正在自动重试' : '准备重试'}`,
          )
          this.#emitCurrent(batchId, `正在重试 ${item.candidateName}`)
          await delay(RETRY_DELAYS_MS[attempt] ?? 1_600)
        }
      }

      if (resultId) {
        database.completeComparisonBatchItem(item.id, resultId)
        this.#emitCurrent(batchId, `${item.candidateName} 分析完成`)
        continue
      }

      const errorMessage = getSafeErrorMessage(finalError)
      database.failComparisonBatchItem(item.id, errorMessage)
      database.updateDocument({ id: item.candidateDocumentId, compareStatus: '待比对' })
      if (isBlockingConfigurationError(finalError)) {
        database.refreshComparisonBatchCounts(batchId)
        this.#emit(
          database.updateComparisonBatch(batchId, {
            status: 'paused',
            progressMessage: 'AI 配置异常，批次已暂停',
            errorMessage,
            markFinished: true,
          }),
        )
        return
      }
      this.#emitCurrent(batchId, `${item.candidateName} 分析失败，继续下一份`)
    }

    batch = database.refreshComparisonBatchCounts(batchId)
    const status = batch.failedCount > 0 ? 'partial_failure' : 'completed'
    this.#emit(
      database.updateComparisonBatch(batchId, {
        status,
        progressMessage:
          status === 'completed'
            ? `批量分析完成，共 ${batch.completedCount} 份`
            : `批量分析完成，成功 ${batch.completedCount} 份，失败 ${batch.failedCount} 份`,
        markFinished: true,
      }),
    )
  }

  #handleItemProgress(batchId: string, itemId: string, progress: DocumentComparisonProgress): void {
    if (getDocumentDatabase().getComparisonBatch(batchId).status === 'cancelled') return
    if (progress.documentRole === 'standard') return
    const status = mapProgressStatus(progress.stage)
    getDocumentDatabase().updateComparisonBatchItemProgress(
      itemId,
      status,
      progress.message,
      progress.page,
      progress.totalPages,
    )
    this.#emitCurrent(batchId, progress.message)
  }

  #emitCurrent(batchId: string, progressMessage: string): void {
    const database = getDocumentDatabase()
    database.refreshComparisonBatchCounts(batchId)
    this.#emit(database.updateComparisonBatch(batchId, { progressMessage }))
  }

  #emit(batch: ComparisonBatch): void {
    for (const listener of this.#listeners) listener(batch)
  }
}

function mapProgressStatus(stage: DocumentComparisonProgress['stage']): ComparisonBatchItemStatus {
  if (stage === 'complete') return 'saving'
  return stage
}

function isTransientError(error: unknown): boolean {
  return /429|rate limit|限流|timeout|超时|network|fetch|econn|temporar|结构化|json 格式|未返回 json/i.test(
    getSafeErrorMessage(error),
  )
}

function isBlockingConfigurationError(error: unknown): boolean {
  return /api key|apikey|401|403|unauthorized|forbidden|模型|model|配置/i.test(
    getSafeErrorMessage(error),
  )
}

function getSafeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '未知错误')
  return message.replace(/sk-[a-z0-9_-]+/gi, '[已隐藏]').slice(0, 500)
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

let service: ComparisonBatchService | null = null

export function getComparisonBatchService(): ComparisonBatchService {
  service ??= new ComparisonBatchService()
  return service
}
