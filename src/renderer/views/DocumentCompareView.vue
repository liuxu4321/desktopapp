<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Archive,
  BrainCircuit,
  ChevronDown,
  CircleCheck,
  Download,
  Eye,
  Glasses,
  Play,
  Search,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from '@lucide/vue'
import AppDialog from '@renderer/components/AppDialog.vue'
import PageHeader from '@renderer/components/PageHeader.vue'
import PdfPreview from '@renderer/components/PdfPreview.vue'
import { desktopAPI } from '@renderer/services/desktop-api'
import type {
  AiComparisonResult,
  DocumentCompareStatus,
  DocumentComparisonProgress,
  DocumentProblemRecord,
  DocumentProblemSeverity,
  DocumentProblemType,
  DocumentRecord,
  ImportedDocument,
} from '@shared/types'

type CompareStatus = DocumentCompareStatus
type ProblemType = DocumentProblemType
type Severity = DocumentProblemSeverity

interface StandardDocument {
  id: string
  name: string
  pages: number
  format: string
  importedAt: string
  previewUrl?: string
}

interface CandidateDocument {
  id: string
  name: string
  pages: number
  status: CompareStatus
  updatedAt: string
  previewUrl?: string
}

interface ProblemDocument {
  id: string
  documentId: string
  fileName: string
  type: ProblemType
  summary: string
  page: number
  severity: Severity
  confidence: number
  createdAt: string
}

interface ArchivedProblemDocument {
  id: string
  recordIds: string[]
  documentId: string
  fileName: string
  summary: string
  severity: Severity
  archivedAt: string
}

interface PdfPreviewHandle {
  getScrollPosition(): number
  scrollToPosition(scrollTop: number): void
}

interface SinglePreviewDocument {
  name: string
  previewUrl?: string
  role: 'standard' | 'candidate'
}

const query = ref('')
const statusFilter = ref<'all' | CompareStatus>('all')
const selectedStandardId = ref('')
const selectedCandidateId = ref('')
const selectedCandidateIds = ref<string[]>([])
const singlePreviewDocument = ref<SinglePreviewDocument | null>(null)
const singlePreviewOpen = ref(false)
const comparePreviewOpen = ref(false)
const comparePreviewMode = ref<'review' | 'archive'>('review')
const zoom = ref(100)
const previewMode = ref<'original' | 'enhanced'>('enhanced')
const syncScroll = ref(true)
const aiCompareState = ref<'idle' | 'analyzing' | 'complete' | 'error'>('idle')
const aiPanelView = ref<'result' | 'process'>('result')
const aiCompareError = ref('')
const aiProgressEvents = ref<Array<DocumentComparisonProgress & { id: number }>>([])
let aiProgressEventSequence = 0
const comparePageAspectRatio = ref(765 / 595)
const standardPreview = ref<PdfPreviewHandle | null>(null)
const candidatePreview = ref<PdfPreviewHandle | null>(null)
const importingStandard = ref(false)
const importingCandidate = ref(false)
const loadingData = ref(true)
const dataError = ref('')
const compareResolutionState = ref<'idle' | 'removing' | 'archiving'>('idle')
const aiComparisonResult = ref<AiComparisonResult | null>(null)

const standardDocuments = ref<StandardDocument[]>([])
const candidateDocuments = ref<CandidateDocument[]>([])
const archivedCandidateDocuments = ref<CandidateDocument[]>([])
const problemDocuments = ref<ProblemDocument[]>([])

const selectedCandidate = computed(
  () =>
    candidateDocuments.value.find((document) => document.id === selectedCandidateId.value) ??
    archivedCandidateDocuments.value.find(
      (document) => document.id === selectedCandidateId.value,
    ) ??
    candidateDocuments.value[0],
)
const selectedStandard = computed(
  () =>
    standardDocuments.value.find((document) => document.id === selectedStandardId.value) ??
    standardDocuments.value[0],
)

const filteredCandidates = computed(() => {
  const value = query.value.trim().toLocaleLowerCase()
  return candidateDocuments.value.filter(
    (document) =>
      (statusFilter.value === 'all' || document.status === statusFilter.value) &&
      (!value || `${document.id} ${document.name}`.toLocaleLowerCase().includes(value)),
  )
})

const archivedProblems = computed(() => {
  const archivedIds = new Set(archivedCandidateDocuments.value.map((document) => document.id))
  return groupProblemsByDocument(problemDocuments.value).filter((problem) =>
    archivedIds.has(problem.documentId),
  )
})

const filteredProblems = computed(() => {
  const value = query.value.trim().toLocaleLowerCase()
  return archivedProblems.value.filter(
    (problem) =>
      !value || `${problem.fileName} ${problem.summary}`.toLocaleLowerCase().includes(value),
  )
})

const allFilteredCandidatesSelected = computed(
  () =>
    filteredCandidates.value.length > 0 &&
    filteredCandidates.value.every((document) => selectedCandidateIds.value.includes(document.id)),
)
const someFilteredCandidatesSelected = computed(
  () =>
    !allFilteredCandidatesSelected.value &&
    filteredCandidates.value.some((document) => selectedCandidateIds.value.includes(document.id)),
)

const waitingCount = computed(
  () => candidateDocuments.value.filter((document) => document.status === '待比对').length,
)
const readyCount = computed(
  () => candidateDocuments.value.filter((document) => document.status === '待查看').length,
)
const problemCount = computed(() => archivedProblems.value.length)
const aiCompareFindings = computed(() => aiComparisonResult.value?.findings ?? [])
const aiHighRiskCount = computed(
  () => aiCompareFindings.value.filter((finding) => finding.severity === 'high').length,
)
const aiAverageConfidence = computed(() => {
  if (aiCompareFindings.value.length === 0) return 0
  const total = aiCompareFindings.value.reduce((sum, finding) => sum + finding.confidence, 0)
  return Math.round((total / aiCompareFindings.value.length) * 100)
})
const latestAiProgressMessage = computed(
  () => aiProgressEvents.value[aiProgressEvents.value.length - 1]?.message ?? '正在启动分析任务',
)

onMounted(() => void loadDocumentData())
const unsubscribeComparisonProgress = desktopAPI.onDocumentComparisonProgress((progress) => {
  if (progress.candidateDocumentId !== selectedCandidateId.value) return
  const existingIndex = aiProgressEvents.value.findIndex(
    (item) =>
      item.stage === progress.stage &&
      item.documentRole === progress.documentRole &&
      item.page === progress.page &&
      item.textPreview === undefined,
  )
  const item = { ...progress, id: ++aiProgressEventSequence }
  if (existingIndex >= 0 && progress.textPreview) {
    aiProgressEvents.value.splice(existingIndex, 1, item)
  } else {
    aiProgressEvents.value.push(item)
  }
  aiProgressEvents.value = aiProgressEvents.value.slice(-40)
})
onUnmounted(unsubscribeComparisonProgress)

async function loadDocumentData(): Promise<void> {
  loadingData.value = true
  dataError.value = ''
  try {
    const [documents, problems] = await Promise.all([
      desktopAPI.listDocuments(),
      desktopAPI.listDocumentProblems(),
    ])
    standardDocuments.value = documents
      .filter((document) => document.role === 'standard')
      .map(toStandardDocumentRecord)
    const candidates = documents
      .filter((document) => document.role === 'candidate')
      .map(toCandidateDocumentRecord)
    candidateDocuments.value = candidates.filter((document) => document.status !== '有问题')
    archivedCandidateDocuments.value = candidates.filter((document) => document.status === '有问题')
    problemDocuments.value = problems.map(toProblemDocument)
    selectedStandardId.value = standardDocuments.value[0]?.id ?? ''
    selectedCandidateId.value = candidateDocuments.value[0]?.id ?? ''
    selectedCandidateIds.value = []
  } catch {
    dataError.value = '无法读取本地文书数据，请重新打开应用。'
  } finally {
    loadingData.value = false
  }
}

function selectCandidate(document: CandidateDocument): void {
  selectedCandidateId.value = document.id
}

async function importStandardDocument(): Promise<void> {
  importingStandard.value = true
  try {
    const documents = await desktopAPI.importDocument('standard')
    if (documents.length === 0) return
    const standards = documents.map(toStandardDocument)
    standardDocuments.value.unshift(...standards)
    selectedStandardId.value = standards[0]?.id ?? selectedStandardId.value
    dataError.value = ''
  } catch {
    dataError.value = '标准文书导入失败，仅支持可正常读取的PDF文件。'
  } finally {
    importingStandard.value = false
  }
}

async function importCandidateDocument(): Promise<void> {
  importingCandidate.value = true
  try {
    const documents = await desktopAPI.importDocument('candidate')
    if (documents.length === 0) return
    const candidates = documents.map(toCandidateDocument)
    candidateDocuments.value.unshift(...candidates)
    selectedCandidateId.value = candidates[0]?.id ?? selectedCandidateId.value
    dataError.value = ''
  } catch {
    dataError.value = '待比对文书导入失败，仅支持可正常读取的PDF文件。'
  } finally {
    importingCandidate.value = false
  }
}

async function openCandidatePreview(document: CandidateDocument): Promise<void> {
  selectedCandidateId.value = document.id
  await loadPreview(document)
  singlePreviewDocument.value = {
    name: document.name,
    role: 'candidate',
    ...(document.previewUrl ? { previewUrl: document.previewUrl } : {}),
  }
  singlePreviewOpen.value = true
}

async function openStandardPreview(document: StandardDocument): Promise<void> {
  await loadPreview(document)
  singlePreviewDocument.value = {
    name: document.name,
    role: 'standard',
    ...(document.previewUrl ? { previewUrl: document.previewUrl } : {}),
  }
  singlePreviewOpen.value = true
}

async function openProblemPreview(problem: ArchivedProblemDocument): Promise<void> {
  const document = archivedCandidateDocuments.value.find((item) => item.id === problem.documentId)
  if (!document) {
    dataError.value = `无法读取“${problem.fileName}”的归档文书。`
    return
  }

  dataError.value = ''
  aiCompareError.value = ''
  aiProgressEvents.value = []
  aiPanelView.value = 'result'
  comparePreviewMode.value = 'archive'
  selectedCandidateId.value = document.id
  try {
    const latest = await desktopAPI.getLatestCandidateComparison(document.id)
    aiComparisonResult.value = latest
    aiCompareState.value = latest ? 'complete' : 'idle'
    const standard = latest
      ? standardDocuments.value.find((item) => item.id === latest.standardDocumentId)
      : selectedStandard.value
    if (standard) selectedStandardId.value = standard.id
    await Promise.all([loadPreview(document), ...(standard ? [loadPreview(standard)] : [])])
    compareResolutionState.value = 'idle'
    comparePreviewOpen.value = true
  } catch {
    dataError.value = `无法读取“${problem.fileName}”的 AI 对比结果。`
  }
}

async function openComparePreview(document: CandidateDocument): Promise<void> {
  comparePreviewMode.value = 'review'
  selectedCandidateId.value = document.id
  if (selectedStandard.value) {
    await Promise.all([loadPreview(selectedStandard.value), loadPreview(document)])
  } else {
    await loadPreview(document)
  }
  aiComparisonResult.value = null
  aiCompareError.value = ''
  aiProgressEvents.value = []
  aiPanelView.value = 'result'
  aiCompareState.value = 'idle'
  if (selectedStandard.value) {
    try {
      const latest = await desktopAPI.getLatestDocumentComparison({
        standardDocumentId: selectedStandard.value.id,
        candidateDocumentId: document.id,
      })
      if (latest) {
        aiComparisonResult.value = latest
        aiCompareState.value = 'complete'
      }
    } catch {
      dataError.value = '无法读取最近一次 AI 对比结果。'
    }
  }
  compareResolutionState.value = 'idle'
  comparePreviewOpen.value = true
}

async function markCompared(
  document: CandidateDocument,
  showPageError = true,
): Promise<AiComparisonResult | null> {
  const standard = selectedStandard.value
  if (!standard) {
    dataError.value = '请先选择一份标准文书。'
    return null
  }
  const previousStatus = document.status
  document.status = '比对中'
  dataError.value = ''
  try {
    const result = await desktopAPI.compareDocuments({
      standardDocumentId: standard.id,
      candidateDocumentId: document.id,
    })
    document.status = '待查看'
    document.updatedAt = formatImportedAt(result.createdAt)
    selectedCandidateId.value = document.id
    return result
  } catch (error) {
    document.status = previousStatus
    const message = getAiErrorMessage(error, document.name)
    aiCompareError.value = message
    if (showPageError) dataError.value = message
    return null
  }
}

async function compareSelectedCandidates(): Promise<void> {
  const selected = candidateDocuments.value.filter((document) =>
    selectedCandidateIds.value.includes(document.id),
  )
  for (const document of selected) await markCompared(document)
}

function toggleFilteredCandidates(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked
  const filteredIds = new Set(filteredCandidates.value.map((document) => document.id))
  const preservedIds = selectedCandidateIds.value.filter((id) => !filteredIds.has(id))
  selectedCandidateIds.value = checked ? [...preservedIds, ...filteredIds] : preservedIds
}

async function removeStandard(document: StandardDocument): Promise<void> {
  try {
    await desktopAPI.deleteDocument(document.id)
    standardDocuments.value = standardDocuments.value.filter((item) => item.id !== document.id)
    if (selectedStandardId.value === document.id) {
      selectedStandardId.value = standardDocuments.value[0]?.id ?? ''
    }
  } catch {
    dataError.value = `无法删除“${document.name}”。`
  }
}

async function removeCandidate(document: CandidateDocument): Promise<boolean> {
  try {
    await desktopAPI.deleteDocument(document.id)
    candidateDocuments.value = candidateDocuments.value.filter((item) => item.id !== document.id)
    problemDocuments.value = problemDocuments.value.filter(
      (problem) => problem.documentId !== document.id,
    )
    selectedCandidateIds.value = selectedCandidateIds.value.filter((id) => id !== document.id)
    if (selectedCandidateId.value === document.id) {
      selectedCandidateId.value = candidateDocuments.value[0]?.id ?? ''
    }
    return true
  } catch {
    dataError.value = `无法删除“${document.name}”。`
    return false
  }
}

async function resolveCandidateAsNoProblem(): Promise<void> {
  const document = selectedCandidate.value
  if (!document || compareResolutionState.value !== 'idle') return
  compareResolutionState.value = 'removing'
  dataError.value = ''
  const removed = await removeCandidate(document)
  if (removed) comparePreviewOpen.value = false
  compareResolutionState.value = 'idle'
}

async function archiveCandidateAsProblem(): Promise<void> {
  const document = selectedCandidate.value
  if (!document || compareResolutionState.value !== 'idle') return
  compareResolutionState.value = 'archiving'
  dataError.value = ''
  let createdProblem: DocumentProblemRecord | null = null

  try {
    const existingProblem = problemDocuments.value.some(
      (problem) => problem.documentId === document.id,
    )
    if (!existingProblem) {
      const primaryFinding = [...aiCompareFindings.value].sort(
        (left, right) => severityRank(right.severity) - severityRank(left.severity),
      )[0]
      createdProblem = await desktopAPI.createDocumentProblem({
        documentId: document.id,
        type: primaryFinding?.type ?? '关键字段变化',
        summary:
          aiComparisonResult.value?.summary ??
          primaryFinding?.detail ??
          '人工复核确认该文书存在问题',
        page: primaryFinding?.candidatePage ?? primaryFinding?.standardPage ?? 1,
        severity: primaryFinding?.severity ?? 'medium',
        confidence: primaryFinding?.confidence ?? 1,
      })
    }

    const updated = await desktopAPI.updateDocument({
      id: document.id,
      compareStatus: '有问题',
    })
    document.status = updated.compareStatus ?? '有问题'
    document.updatedAt = formatImportedAt(updated.updatedAt)
    if (createdProblem) problemDocuments.value.unshift(toProblemDocument(createdProblem))
    candidateDocuments.value = candidateDocuments.value.filter((item) => item.id !== document.id)
    archivedCandidateDocuments.value = [
      document,
      ...archivedCandidateDocuments.value.filter((item) => item.id !== document.id),
    ]
    selectedCandidateIds.value = selectedCandidateIds.value.filter((id) => id !== document.id)
    selectedCandidateId.value = candidateDocuments.value[0]?.id ?? ''
    comparePreviewOpen.value = false
  } catch {
    if (createdProblem) {
      try {
        await desktopAPI.deleteDocumentProblem(createdProblem.id)
      } catch {
        // The next data reload reconciles a rare rollback failure.
      }
    }
    dataError.value = `无法归档“${document.name}”，请重试。`
  } finally {
    compareResolutionState.value = 'idle'
  }
}

async function removeProblem(problem: ArchivedProblemDocument): Promise<void> {
  try {
    await desktopAPI.deleteDocument(problem.documentId)
    problemDocuments.value = problemDocuments.value.filter(
      (item) => item.documentId !== problem.documentId,
    )
    archivedCandidateDocuments.value = archivedCandidateDocuments.value.filter(
      (item) => item.id !== problem.documentId,
    )
  } catch {
    dataError.value = '无法删除该问题文书。'
  }
}

function adjustZoom(delta: number): void {
  zoom.value = Math.min(125, Math.max(70, zoom.value + delta))
}

function synchronizeFromStandard(scrollTop: number): void {
  if (syncScroll.value) candidatePreview.value?.scrollToPosition(scrollTop)
}

function synchronizeFromCandidate(scrollTop: number): void {
  if (syncScroll.value) standardPreview.value?.scrollToPosition(scrollTop)
}

function alignSynchronizedPreviews(): void {
  if (!syncScroll.value) return
  candidatePreview.value?.scrollToPosition(standardPreview.value?.getScrollPosition() ?? 0)
}

async function runAiCompare(): Promise<void> {
  if (aiCompareState.value === 'analyzing') return
  const document = selectedCandidate.value
  if (!document) return
  aiCompareError.value = ''
  aiProgressEvents.value = []
  aiPanelView.value = 'process'
  aiCompareState.value = 'analyzing'
  const result = await markCompared(document, false)
  if (result) {
    aiComparisonResult.value = result
    aiCompareState.value = 'complete'
    aiPanelView.value = 'result'
  } else {
    aiCompareState.value = 'error'
    aiPanelView.value = 'process'
  }
}

function getAiErrorMessage(error: unknown, documentName: string): string {
  const detail =
    error instanceof Error ? error.message.replace(/^Error invoking remote method.*?: /, '') : ''
  return detail
    ? `“${documentName}”AI 比对失败：${detail}`
    : `“${documentName}”AI 比对失败，请检查 DashScope 配置和网络。`
}

async function loadPreview(document: StandardDocument | CandidateDocument): Promise<void> {
  if (document.previewUrl) return
  try {
    const previewUrl = await desktopAPI.getDocumentPreview(document.id)
    if (previewUrl) document.previewUrl = previewUrl
  } catch {
    dataError.value = `无法读取“${document.name}”的预览文件。`
  }
}

function toStandardDocumentRecord(document: DocumentRecord): StandardDocument {
  return {
    id: document.id,
    name: document.name,
    pages: document.pageCount,
    format: getKindLabel(document.kind),
    importedAt: formatImportedAt(document.importedAt),
  }
}

function toCandidateDocumentRecord(document: DocumentRecord): CandidateDocument {
  return {
    id: document.id,
    name: document.name,
    pages: document.pageCount,
    status: document.compareStatus ?? '待比对',
    updatedAt: formatImportedAt(document.updatedAt),
  }
}

function toProblemDocument(problem: DocumentProblemRecord): ProblemDocument {
  return {
    id: problem.id,
    documentId: problem.documentId,
    fileName: problem.fileName,
    type: problem.type,
    summary: problem.summary,
    page: problem.page,
    severity: problem.severity,
    confidence: problem.confidence,
    createdAt: problem.createdAt,
  }
}

function groupProblemsByDocument(problems: ProblemDocument[]): ArchivedProblemDocument[] {
  const groups = new Map<string, ProblemDocument[]>()
  for (const problem of problems) {
    const current = groups.get(problem.documentId) ?? []
    current.push(problem)
    groups.set(problem.documentId, current)
  }

  return [...groups.values()]
    .map((records) => {
      const sorted = [...records].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      )
      const latest = sorted[0]
      if (!latest) return null
      const highestSeverity = [...records].sort(
        (left, right) => severityRank(right.severity) - severityRank(left.severity),
      )[0]?.severity
      return {
        id: latest.documentId,
        recordIds: records.map((record) => record.id),
        documentId: latest.documentId,
        fileName: latest.fileName,
        summary: latest.summary,
        severity: highestSeverity ?? latest.severity,
        archivedAt: formatImportedAt(latest.createdAt),
      }
    })
    .filter((problem): problem is ArchivedProblemDocument => problem !== null)
    .sort((left, right) => right.archivedAt.localeCompare(left.archivedAt))
}

function severityRank(severity: Severity): number {
  if (severity === 'high') return 3
  if (severity === 'medium') return 2
  return 1
}

function toStandardDocument(document: ImportedDocument): StandardDocument {
  return {
    id: document.id,
    name: document.name,
    pages: document.pageCount,
    format: getKindLabel(document.kind),
    importedAt: formatImportedAt(document.importedAt),
    previewUrl: document.previewUrl,
  }
}

function toCandidateDocument(document: ImportedDocument): CandidateDocument {
  return {
    id: document.id,
    name: document.name,
    pages: document.pageCount,
    status: document.compareStatus ?? '待比对',
    updatedAt: formatImportedAt(document.importedAt),
    previewUrl: document.previewUrl,
  }
}

function getKindLabel(kind: DocumentRecord['kind']): string {
  if (kind === 'native-pdf') return '原生PDF'
  if (kind === 'scanned-pdf') return '扫描PDF'
  if (kind === 'mixed-pdf') return '混合PDF'
  return '未知PDF'
}

function formatImportedAt(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
</script>

<template>
  <section class="page compact-page document-compare-page">
    <PageHeader title="文书比对" description="标准文书、批量待比对文书和问题文书集中处理">
      <template #search>
        <label class="content-search">
          <Search :size="16" aria-hidden="true" />
          <input v-model="query" type="search" placeholder="搜索文件、问题或条款" />
        </label>
      </template>
    </PageHeader>

    <p v-if="dataError" class="document-data-error" role="alert">{{ dataError }}</p>

    <section class="compare-summary-strip" aria-label="批量比对状态">
      <article>
        <span>标准文书</span>
        <strong>{{ standardDocuments.length }}</strong>
      </article>
      <article>
        <span>待比对</span>
        <strong>{{ waitingCount }}</strong>
      </article>
      <article>
        <span>待查看</span>
        <strong>{{ readyCount }}</strong>
      </article>
      <article>
        <span>问题文书</span>
        <strong>{{ problemCount }}</strong>
      </article>
    </section>

    <section class="document-table-grid">
      <article class="document-table-panel standard-table-panel">
        <header class="table-panel-header">
          <div>
            <h2>标准文书</h2>
            <p>支持批量导入，选择其中一份作为比对基准</p>
          </div>
          <button
            class="secondary-button"
            type="button"
            :disabled="importingStandard"
            @click="importStandardDocument"
          >
            <Upload :size="16" aria-hidden="true" />{{
              importingStandard ? '导入中' : '批量导入标准文书'
            }}
          </button>
        </header>

        <div class="data-table-frame document-data-frame">
          <table class="data-table document-data-table standard-data-table">
            <thead>
              <tr>
                <th class="standard-select-heading">标准</th>
                <th>文件名称</th>
                <th>页数</th>
                <th>类型</th>
                <th>导入时间</th>
                <th class="table-actions-heading">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="document in standardDocuments"
                :key="document.id"
                :class="{ selected: selectedStandardId === document.id }"
              >
                <td class="standard-select-cell">
                  <input
                    v-model="selectedStandardId"
                    type="radio"
                    name="standard-document"
                    :value="document.id"
                    :aria-label="`选择 ${document.name} 作为标准文书`"
                  />
                </td>
                <td>
                  <strong>{{ document.name }}</strong>
                  <small>{{ document.id }}</small>
                </td>
                <td>{{ document.pages }}</td>
                <td>{{ document.format }}</td>
                <td>{{ document.importedAt }}</td>
                <td>
                  <div class="table-row-actions">
                    <button
                      type="button"
                      aria-label="预览标准文书"
                      title="预览"
                      @click="openStandardPreview(document)"
                    >
                      <Eye :size="15" aria-hidden="true" />
                    </button>
                    <button
                      class="table-delete-button"
                      type="button"
                      aria-label="删除标准文书"
                      title="删除"
                      @click="removeStandard(document)"
                    >
                      <Trash2 :size="15" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="standardDocuments.length === 0">
                <td class="table-empty" colspan="6">
                  {{ loadingData ? '正在读取标准文书...' : '尚未导入标准文书' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="document-table-panel candidate-table-panel">
        <header class="table-panel-header">
          <div>
            <h2>待比对文书</h2>
            <p>支持批量上传、多选比对和逐份预览</p>
          </div>
          <div class="table-header-actions">
            <label class="status-filter-select">
              <select v-model="statusFilter" aria-label="比对状态">
                <option value="all">全部状态</option>
                <option value="待比对">待比对</option>
                <option value="比对中">比对中</option>
                <option value="待查看">待查看</option>
                <option value="有问题">有问题</option>
              </select>
              <ChevronDown :size="15" aria-hidden="true" />
            </label>
            <button type="button" :disabled="importingCandidate" @click="importCandidateDocument">
              <Upload :size="16" aria-hidden="true" />{{
                importingCandidate ? '上传中' : '批量上传待比对文书'
              }}
            </button>
            <button
              type="button"
              :disabled="selectedCandidateIds.length === 0"
              @click="compareSelectedCandidates"
            >
              <Play :size="16" aria-hidden="true" />批量比对
            </button>
          </div>
        </header>

        <div class="data-table-frame document-data-frame">
          <table class="data-table document-data-table candidate-data-table">
            <thead>
              <tr>
                <th class="table-select-heading">
                  <input
                    type="checkbox"
                    aria-label="选择全部待比对文书"
                    :checked="allFilteredCandidatesSelected"
                    :indeterminate="someFilteredCandidatesSelected"
                    @change="toggleFilteredCandidates"
                  />
                </th>
                <th>文件名称</th>
                <th>状态</th>
                <th>页数</th>
                <th>更新时间</th>
                <th class="table-actions-heading">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="document in filteredCandidates"
                :key="document.id"
                :class="{ selected: selectedCandidateIds.includes(document.id) }"
              >
                <td class="table-select-cell">
                  <input
                    v-model="selectedCandidateIds"
                    type="checkbox"
                    :value="document.id"
                    :aria-label="`选择 ${document.name}`"
                  />
                </td>
                <td>
                  <button
                    class="table-name-button"
                    type="button"
                    @click="selectCandidate(document)"
                  >
                    <strong>{{ document.name }}</strong>
                    <small>{{ document.id }}</small>
                  </button>
                </td>
                <td>
                  <span class="status-badge" :class="document.status">{{ document.status }}</span>
                </td>
                <td>{{ document.pages }}</td>
                <td>{{ document.updatedAt }}</td>
                <td>
                  <div class="table-row-actions">
                    <button
                      type="button"
                      aria-label="比对文书"
                      title="比对"
                      @click="markCompared(document)"
                    >
                      <Play :size="15" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="预览单个文件"
                      title="预览单个文件"
                      @click="openCandidatePreview(document)"
                    >
                      <Eye :size="15" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="对比预览"
                      title="对比预览"
                      @click="openComparePreview(document)"
                    >
                      <Glasses :size="15" aria-hidden="true" />
                    </button>
                    <button
                      class="table-delete-button"
                      type="button"
                      aria-label="删除待比对文书"
                      title="删除"
                      @click="removeCandidate(document)"
                    >
                      <Trash2 :size="15" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredCandidates.length === 0">
                <td class="table-empty" colspan="6">
                  {{ loadingData ? '正在读取待比对文书...' : '没有匹配的待比对文书' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="document-table-panel problem-table-panel">
        <header class="table-panel-header">
          <div>
            <h2>问题文书列表</h2>
            <p>每份归档文书一行，详细问题在对比阅览中查看</p>
          </div>
        </header>

        <div class="data-table-frame document-data-frame">
          <table class="data-table document-data-table problem-data-table">
            <thead>
              <tr>
                <th>文件名称</th>
                <th>归档结论</th>
                <th>风险级别</th>
                <th>归档时间</th>
                <th class="table-actions-heading">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="problem in filteredProblems" :key="problem.id">
                <td>
                  <strong>{{ problem.fileName }}</strong>
                  <small>{{ problem.documentId }}</small>
                </td>
                <td>{{ problem.summary }}</td>
                <td>
                  <span class="status-badge" :class="problem.severity">
                    {{
                      problem.severity === 'high'
                        ? '高'
                        : problem.severity === 'medium'
                          ? '中'
                          : '低'
                    }}
                  </span>
                </td>
                <td>{{ problem.archivedAt }}</td>
                <td>
                  <div class="table-row-actions">
                    <button
                      type="button"
                      aria-label="预览问题文书"
                      title="预览"
                      @click="openProblemPreview(problem)"
                    >
                      <Eye :size="15" aria-hidden="true" />
                    </button>
                    <button
                      class="table-delete-button"
                      type="button"
                      aria-label="删除问题文书"
                      title="删除"
                      @click="removeProblem(problem)"
                    >
                      <Trash2 :size="15" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredProblems.length === 0">
                <td class="table-empty" colspan="5">
                  {{ loadingData ? '正在读取问题文书...' : '没有匹配的问题文书' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </section>

    <AppDialog
      class="preview-dialog"
      :open="singlePreviewOpen"
      title="单文件预览"
      :description="singlePreviewDocument?.name ?? '文书预览'"
      @close="singlePreviewOpen = false"
    >
      <section class="preview-dialog-body">
        <header class="viewer-toolbar single-viewer-toolbar">
          <div class="viewer-tools">
            <div class="preview-mode-switch" aria-label="预览模式">
              <button
                type="button"
                :class="{ active: previewMode === 'original' }"
                @click="previewMode = 'original'"
              >
                原始
              </button>
              <button
                type="button"
                :class="{ active: previewMode === 'enhanced' }"
                @click="previewMode = 'enhanced'"
              >
                清晰
              </button>
            </div>
            <button
              class="icon-tool-button"
              type="button"
              aria-label="缩小"
              title="缩小"
              @click="adjustZoom(-5)"
            >
              <ZoomOut :size="16" aria-hidden="true" />
            </button>
            <span>{{ zoom }}%</span>
            <button
              class="icon-tool-button"
              type="button"
              aria-label="放大"
              title="放大"
              @click="adjustZoom(5)"
            >
              <ZoomIn :size="16" aria-hidden="true" />
            </button>
          </div>
        </header>

        <section class="single-document-preview" :style="{ '--doc-zoom': `${zoom}%` }">
          <PdfPreview
            v-if="singlePreviewDocument?.previewUrl"
            :source="singlePreviewDocument.previewUrl"
            :zoom="zoom"
            fit="width"
            :enhanced="previewMode === 'enhanced'"
            continuous
            :label="`${singlePreviewDocument.name} PDF预览`"
          />
          <article v-else class="document-page">
            <header>
              <span>{{
                singlePreviewDocument?.role === 'standard' ? '标准文书' : '待比对文书'
              }}</span>
              <b>第3页</b>
            </header>
            <div
              class="paper-surface"
              :class="{ scanned: singlePreviewDocument?.role !== 'standard' }"
            >
              <p class="doc-title">采购服务合同</p>
              <p>第三条 付款安排</p>
              <p>
                甲方应在验收合格后<span
                  class="mark"
                  :class="singlePreviewDocument?.role === 'standard' ? 'removed' : 'added'"
                  >{{ singlePreviewDocument?.role === 'standard' ? '30日' : '45日' }}</span
                >内支付合同款。
              </p>
              <p>第五条 违约责任</p>
              <p>
                每日按未付款项的<span
                  class="mark"
                  :class="singlePreviewDocument?.role === 'standard' ? 'removed' : 'added'"
                  >{{ singlePreviewDocument?.role === 'standard' ? '万分之五' : '万分之三' }}</span
                >承担违约金。
              </p>
              <div v-if="singlePreviewDocument?.role === 'standard'" class="stamp-area">签章区</div>
              <div v-else class="ocr-warning">OCR低置信度区域</div>
            </div>
          </article>
        </section>
      </section>

      <template #footer>
        <button class="secondary-button" type="button" @click="singlePreviewOpen = false">
          关闭
        </button>
        <button type="button"><Download :size="16" aria-hidden="true" />导出预览</button>
      </template>
    </AppDialog>

    <AppDialog
      class="preview-dialog compare-preview-dialog"
      :open="comparePreviewOpen"
      :title="comparePreviewMode === 'archive' ? '问题文书阅览' : '对比预览'"
      @close="comparePreviewOpen = false"
    >
      <section class="preview-dialog-body compare-preview-body">
        <header class="viewer-toolbar compare-viewer-toolbar">
          <div class="viewer-tools">
            <label class="sync-scroll-control">
              <input
                v-model="syncScroll"
                class="switch-input"
                type="checkbox"
                @change="alignSynchronizedPreviews"
              />
              <span>同步滚动</span>
            </label>
            <div class="preview-mode-switch" aria-label="预览模式">
              <button
                type="button"
                :class="{ active: previewMode === 'original' }"
                @click="previewMode = 'original'"
              >
                原始
              </button>
              <button
                type="button"
                :class="{ active: previewMode === 'enhanced' }"
                @click="previewMode = 'enhanced'"
              >
                清晰
              </button>
            </div>
            <button
              class="icon-tool-button"
              type="button"
              aria-label="缩小"
              title="缩小"
              @click="adjustZoom(-5)"
            >
              <ZoomOut :size="16" aria-hidden="true" />
            </button>
            <span>{{ zoom }}%</span>
            <button
              class="icon-tool-button"
              type="button"
              aria-label="放大"
              title="放大"
              @click="adjustZoom(5)"
            >
              <ZoomIn :size="16" aria-hidden="true" />
            </button>
            <button
              v-if="comparePreviewMode === 'review'"
              class="ai-compare-button"
              type="button"
              :disabled="aiCompareState === 'analyzing'"
              @click="runAiCompare"
            >
              <BrainCircuit :size="15" aria-hidden="true" />
              {{
                aiCompareState === 'analyzing'
                  ? '比对中'
                  : aiCompareState === 'complete'
                    ? '重新比对'
                    : 'AI对比'
              }}
            </button>
          </div>
        </header>

        <section class="document-pair" :style="{ '--doc-zoom': `${zoom}%` }">
          <article class="document-page">
            <header>
              <div class="document-pane-heading">
                <span>标准文书</span>
                <small :title="selectedStandard?.name">{{
                  selectedStandard?.name ?? '未选择文书'
                }}</small>
              </div>
            </header>
            <PdfPreview
              v-if="selectedStandard?.previewUrl"
              ref="standardPreview"
              :source="selectedStandard.previewUrl"
              :zoom="zoom"
              fit="width"
              :enhanced="previewMode === 'enhanced'"
              :normalized-page-aspect-ratio="comparePageAspectRatio"
              continuous
              label="标准文书PDF预览"
              @page-aspect-ratio="comparePageAspectRatio = $event"
              @rendered="alignSynchronizedPreviews"
              @scroll-position="synchronizeFromStandard"
            />
            <div v-else class="paper-surface">
              <p class="doc-title">采购服务合同</p>
              <p>第三条 付款安排</p>
              <p>甲方应在验收合格后<span class="mark removed">30日</span>内支付合同款。</p>
              <p>第五条 违约责任</p>
              <p>每日按未付款项的<span class="mark removed">万分之五</span>承担违约金。</p>
              <div class="stamp-area">签章区</div>
            </div>
          </article>

          <article class="document-page">
            <header>
              <div class="document-pane-heading">
                <span>待比对文书</span>
                <small :title="selectedCandidate?.name">{{
                  selectedCandidate?.name ?? '未选择文书'
                }}</small>
              </div>
            </header>
            <PdfPreview
              v-if="selectedCandidate?.previewUrl"
              ref="candidatePreview"
              :source="selectedCandidate.previewUrl"
              :zoom="zoom"
              fit="width"
              :enhanced="previewMode === 'enhanced'"
              :normalized-page-aspect-ratio="comparePageAspectRatio"
              continuous
              label="待比对文书PDF预览"
              @rendered="alignSynchronizedPreviews"
              @scroll-position="synchronizeFromCandidate"
            />
            <div v-else class="paper-surface scanned">
              <p class="doc-title">采购服务合同</p>
              <p>第三条 付款安排</p>
              <p>甲方应在验收合格后<span class="mark added">45日</span>内支付合同款。</p>
              <p>第五条 违约责任</p>
              <p>每日按未付款项的<span class="mark added">万分之三</span>承担违约金。</p>
              <div class="ocr-warning">OCR低置信度区域</div>
            </div>
          </article>

          <aside class="ai-compare-panel" aria-live="polite">
            <header class="ai-result-header">
              <div>
                <BrainCircuit :size="16" aria-hidden="true" />
                <h3>AI对比结果</h3>
              </div>
              <span class="ai-result-status" :class="aiCompareState">
                {{
                  aiCompareState === 'idle'
                    ? '未分析'
                    : aiCompareState === 'analyzing'
                      ? '分析中'
                      : aiCompareState === 'error'
                        ? '失败'
                        : '已完成'
                }}
              </span>
            </header>

            <div v-if="aiCompareState === 'idle'" class="ai-result-empty">
              <BrainCircuit :size="28" aria-hidden="true" />
              <strong>{{
                comparePreviewMode === 'archive' ? '暂无AI分析结果' : '尚未执行AI对比'
              }}</strong>
            </div>

            <template v-else>
              <nav
                v-if="comparePreviewMode === 'review'"
                class="ai-panel-tabs"
                aria-label="AI分析视图"
              >
                <button
                  type="button"
                  :class="{ active: aiPanelView === 'result' }"
                  :disabled="!aiComparisonResult"
                  @click="aiPanelView = 'result'"
                >
                  对比结果
                </button>
                <button
                  type="button"
                  :class="{ active: aiPanelView === 'process' }"
                  @click="aiPanelView = 'process'"
                >
                  处理过程
                </button>
              </nav>

              <div v-if="aiPanelView === 'process'" class="ai-process-view">
                <div v-if="aiCompareState === 'analyzing'" class="ai-waiting-state">
                  <span class="ai-loading-indicator" aria-hidden="true"></span>
                  <div>
                    <strong>AI分析进行中</strong>
                    <small>{{ latestAiProgressMessage }}</small>
                  </div>
                </div>
                <div v-if="aiCompareError" class="ai-process-error" role="alert">
                  <strong>分析失败</strong>
                  <p>{{ aiCompareError }}</p>
                </div>
                <ol class="ai-progress-list">
                  <li v-for="progress in aiProgressEvents" :key="progress.id">
                    <span class="ai-progress-dot" :class="progress.stage" aria-hidden="true"></span>
                    <div>
                      <strong>{{ progress.message }}</strong>
                      <small v-if="progress.page && progress.totalPages">
                        {{ progress.page }}/{{ progress.totalPages }} 页
                      </small>
                      <details v-if="progress.textPreview" class="ai-ocr-preview">
                        <summary>查看识别文本</summary>
                        <p>{{ progress.textPreview }}</p>
                      </details>
                    </div>
                  </li>
                </ol>
              </div>

              <template v-else>
                <section class="ai-result-summary" aria-label="AI对比汇总">
                  <div>
                    <strong>{{ aiCompareFindings.length }}</strong
                    ><span>差异</span>
                  </div>
                  <div>
                    <strong>{{ aiHighRiskCount }}</strong
                    ><span>高风险</span>
                  </div>
                  <div>
                    <strong>{{ aiAverageConfidence }}%</strong><span>平均置信度</span>
                  </div>
                </section>
                <p v-if="aiComparisonResult" class="ai-result-conclusion">
                  {{ aiComparisonResult.summary }}
                </p>
                <div class="ai-finding-list">
                  <article v-for="finding in aiCompareFindings" :key="finding.id">
                    <header>
                      <span class="status-badge" :class="finding.severity">
                        {{ finding.severity === 'high' ? '高' : '中' }}
                      </span>
                      <b> 第{{ finding.candidatePage ?? finding.standardPage ?? '?' }}页 </b>
                      <small>{{ Math.round(finding.confidence * 100) }}%</small>
                    </header>
                    <strong>{{ finding.title }}</strong>
                    <p>{{ finding.detail }}</p>
                  </article>
                  <div v-if="aiCompareFindings.length === 0" class="ai-no-findings">
                    <CircleCheck :size="24" aria-hidden="true" />
                    <strong>未发现实质差异</strong>
                  </div>
                </div>
              </template>
            </template>
          </aside>
        </section>
      </section>

      <template #footer>
        <button
          class="secondary-button"
          type="button"
          :disabled="compareResolutionState !== 'idle'"
          @click="comparePreviewOpen = false"
        >
          关闭
        </button>
        <button
          v-if="comparePreviewMode === 'review'"
          class="compare-resolution-button no-problem-button"
          type="button"
          :disabled="
            !selectedCandidate ||
            compareResolutionState !== 'idle' ||
            aiCompareState === 'analyzing'
          "
          @click="resolveCandidateAsNoProblem"
        >
          <CircleCheck :size="16" aria-hidden="true" />
          {{ compareResolutionState === 'removing' ? '移除中' : '没问题&移除' }}
        </button>
        <button
          v-if="comparePreviewMode === 'review'"
          class="compare-resolution-button archive-problem-button"
          type="button"
          :disabled="
            !selectedCandidate ||
            compareResolutionState !== 'idle' ||
            aiCompareState === 'analyzing'
          "
          @click="archiveCandidateAsProblem"
        >
          <Archive :size="16" aria-hidden="true" />
          {{ compareResolutionState === 'archiving' ? '归档中' : '有问题&归档' }}
        </button>
      </template>
    </AppDialog>
  </section>
</template>

<style scoped>
.document-compare-page {
  color: CanvasText;
}

.document-data-error {
  background: color-mix(in srgb, #b9433f 8%, Canvas);
  border: 1px solid color-mix(in srgb, #b9433f 30%, transparent);
  border-radius: 6px;
  color: #9f3431;
  font-size: 13px;
  margin: 0;
  padding: 9px 12px;
}

.compare-summary-strip {
  border: 1px solid color-mix(in srgb, CanvasText 13%, transparent);
  border-radius: 7px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  overflow: hidden;
}

.compare-summary-strip article {
  display: grid;
  gap: 4px;
  min-height: 70px;
  padding: 13px 16px;
}

.compare-summary-strip article + article {
  border-left: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
}

.compare-summary-strip span,
.table-panel-header p,
.selected-document-title small,
.document-page header b,
.viewer-tools span {
  color: color-mix(in srgb, CanvasText 55%, transparent);
  font-size: 12px;
}

.compare-summary-strip strong {
  font-size: 24px;
}

.document-table-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr);
}

.document-table-panel,
.document-viewer {
  border: 1px solid color-mix(in srgb, CanvasText 13%, transparent);
  border-radius: 7px;
  min-width: 0;
  overflow: hidden;
}

.table-panel-header,
.viewer-toolbar,
.document-page header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  min-width: 0;
}

.table-panel-header {
  border-bottom: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
  min-height: 58px;
  padding: 12px 14px;
}

.table-panel-header h2,
.table-panel-header p {
  margin-bottom: 0;
}

.table-header-actions {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

.status-filter-select {
  align-items: center;
  display: inline-flex;
  position: relative;
}

.status-filter-select select {
  appearance: none;
  background: Canvas;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  border-radius: 6px;
  color: CanvasText;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  height: 36px;
  min-width: 112px;
  outline: none;
  padding: 0 32px 0 11px;
}

.status-filter-select select:hover {
  border-color: color-mix(in srgb, #256f73 55%, transparent);
}

.status-filter-select select:focus-visible {
  border-color: #256f73;
  box-shadow: 0 0 0 3px color-mix(in srgb, #256f73 16%, transparent);
}

.status-filter-select svg {
  color: color-mix(in srgb, CanvasText 55%, transparent);
  pointer-events: none;
  position: absolute;
  right: 10px;
}

.table-panel-header h2,
.document-page header span {
  font-size: 13px;
  font-weight: 700;
}

.document-data-frame {
  border: 0;
  border-radius: 0;
}

.document-data-table {
  min-width: 860px;
}

.standard-select-heading,
.standard-select-cell,
.table-select-heading,
.table-select-cell {
  text-align: center;
  width: 54px;
}

.standard-select-cell input,
.table-select-heading input,
.table-select-cell input {
  accent-color: #256f73;
  cursor: pointer;
  height: 16px;
  margin: 0;
  padding: 0;
  width: 16px;
}

.standard-data-table tbody tr {
  transition: background-color 140ms ease;
}

.standard-data-table tr.selected {
  background: color-mix(in srgb, #256f73 8%, transparent);
}

.candidate-data-table,
.problem-data-table {
  min-width: 860px;
}

.candidate-data-table tr.selected {
  background: color-mix(in srgb, #256f73 8%, transparent);
}

.status-badge.待比对 {
  background: rgb(102 116 168 / 15%);
  color: #5967a0;
}

.status-badge.比对中 {
  background: rgb(217 146 59 / 16%);
  color: #9b5f17;
}

.status-badge.待查看 {
  background: rgb(37 111 115 / 14%);
  color: #1e7074;
}

.status-badge.有问题,
.status-badge.high {
  background: rgb(185 67 63 / 13%);
  color: #b9433f;
}

.status-badge.medium {
  background: rgb(217 146 59 / 16%);
  color: #9b5f17;
}

.status-badge.low {
  background: rgb(102 116 168 / 15%);
  color: #5967a0;
}

.viewer-toolbar {
  border-bottom: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
  flex: none;
  min-height: 58px;
  padding: 10px 12px;
}

.single-viewer-toolbar {
  justify-content: flex-end;
}

.compare-viewer-toolbar {
  justify-content: flex-end;
  min-height: 44px;
  padding: 6px 10px;
}

.compare-viewer-toolbar .viewer-tools {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.sync-scroll-control {
  align-items: center;
  color: color-mix(in srgb, CanvasText 72%, transparent);
  cursor: pointer;
  display: inline-flex;
  font-size: 12px;
  gap: 7px;
  margin-right: 4px;
  white-space: nowrap;
}

.sync-scroll-control .switch-input {
  flex-basis: 36px;
  height: 20px;
  width: 36px;
}

.sync-scroll-control .switch-input::after {
  height: 14px;
  width: 14px;
}

.sync-scroll-control .switch-input:checked::after {
  transform: translateX(16px);
}

.ai-compare-button {
  min-height: 32px;
  padding: 5px 10px;
}

:deep(.preview-dialog) {
  max-width: min(900px, calc(100vw - 48px));
}

:deep(.compare-preview-dialog) {
  max-height: calc(100dvh - 16px);
  max-width: min(1400px, calc(100vw - 32px));
}

:deep(.compare-preview-dialog .dialog-surface) {
  display: flex;
  flex-direction: column;
  height: min(900px, calc(100dvh - 16px));
}

:deep(.compare-preview-dialog .dialog-header) {
  align-items: center;
  padding: 11px 16px 9px;
}

:deep(.compare-preview-dialog .dialog-header h2) {
  font-size: 17px;
  margin: 0;
}

:deep(.compare-preview-dialog .dialog-close) {
  flex-basis: 32px;
  height: 32px;
}

:deep(.compare-preview-dialog .dialog-footer) {
  flex: none;
  padding: 8px 14px;
}

.compare-resolution-button {
  align-items: center;
  display: inline-flex;
  gap: 6px;
  justify-content: center;
  min-width: 132px;
}

.no-problem-button {
  background: #2f7857;
}

.archive-problem-button {
  background: #b9433f;
}

:deep(.compare-preview-dialog .dialog-body) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

:deep(.preview-dialog .dialog-body) {
  padding: 0;
}

.preview-dialog-body {
  display: flex;
  flex-direction: column;
  height: clamp(420px, calc(100dvh - 142px), 800px);
  min-height: 0;
  overflow: hidden;
}

.compare-preview-body {
  height: 100%;
}

.selected-document-title {
  min-width: 0;
}

.selected-document-title strong,
.selected-document-title small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-tools {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
}

.preview-mode-switch {
  background: color-mix(in srgb, CanvasText 7%, transparent);
  border: 1px solid color-mix(in srgb, CanvasText 13%, transparent);
  border-radius: 6px;
  display: inline-grid;
  grid-template-columns: repeat(2, 1fr);
  overflow: hidden;
}

.preview-mode-switch button {
  background: transparent;
  border-radius: 0;
  color: color-mix(in srgb, CanvasText 62%, transparent);
  font-size: 12px;
  min-height: 30px;
  padding: 4px 10px;
}

.preview-mode-switch button + button {
  border-left: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
}

.preview-mode-switch button.active {
  background: Canvas;
  color: CanvasText;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}

.icon-tool-button {
  align-items: center;
  background: transparent;
  color: CanvasText;
  display: inline-flex;
  height: 32px;
  justify-content: center;
  min-height: 32px;
  padding: 0;
  width: 32px;
}

.icon-tool-button:hover,
.icon-tool-button:focus-visible {
  background: color-mix(in srgb, CanvasText 9%, transparent);
}

.document-pair {
  background: color-mix(in srgb, CanvasText 4%, transparent);
  display: grid;
  flex: 1;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr)) 270px;
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  padding: 10px;
}

.single-document-preview {
  background: color-mix(in srgb, CanvasText 4%, transparent);
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.document-page {
  display: grid;
  gap: 10px;
  grid-template-rows: 28px minmax(390px, 1fr);
  min-width: 0;
}

.document-pair .document-page {
  grid-template-rows: 28px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.document-pane-heading {
  align-items: baseline;
  display: flex;
  gap: 8px;
  min-width: 0;
}

.document-pane-heading span {
  flex: 0 0 auto;
}

.document-pane-heading small {
  color: color-mix(in srgb, CanvasText 56%, transparent);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-compare-panel {
  background: Canvas;
  border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.ai-result-header {
  align-items: center;
  border-bottom: 1px solid color-mix(in srgb, CanvasText 11%, transparent);
  display: flex;
  flex: 0 0 40px;
  justify-content: space-between;
  padding: 0 10px;
}

.ai-result-header > div {
  align-items: center;
  display: flex;
  gap: 6px;
  min-width: 0;
}

.ai-result-header h3 {
  font-size: 13px;
  margin: 0;
}

.ai-result-status {
  background: color-mix(in srgb, CanvasText 8%, transparent);
  border-radius: 4px;
  color: color-mix(in srgb, CanvasText 58%, transparent);
  font-size: 10px;
  padding: 3px 5px;
}

.ai-result-status.analyzing {
  background: rgb(217 146 59 / 15%);
  color: #9b5f17;
}

.ai-result-status.complete {
  background: rgb(37 111 115 / 13%);
  color: #1e7074;
}

.ai-result-status.error {
  background: rgb(185 67 63 / 13%);
  color: #b9433f;
}

.ai-panel-tabs {
  border-bottom: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
  display: grid;
  flex: 0 0 32px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ai-panel-tabs button {
  background: transparent;
  border-radius: 0;
  color: color-mix(in srgb, CanvasText 58%, transparent);
  font-size: 11px;
  min-height: 32px;
  padding: 0 6px;
}

.ai-panel-tabs button.active {
  box-shadow: inset 0 -2px #256f73;
  color: CanvasText;
  font-weight: 600;
}

.ai-result-empty {
  align-items: center;
  color: color-mix(in srgb, CanvasText 42%, transparent);
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
  min-height: 0;
  padding: 20px;
  text-align: center;
}

.ai-result-empty strong {
  font-size: 12px;
}

.ai-loading-indicator {
  animation: ai-loading 700ms linear infinite;
  border: 2px solid color-mix(in srgb, #256f73 22%, transparent);
  border-radius: 50%;
  border-top-color: #256f73;
  height: 24px;
  width: 24px;
}

.ai-process-view {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.ai-waiting-state {
  align-items: center;
  background: color-mix(in srgb, #256f73 6%, Canvas);
  border-bottom: 1px solid color-mix(in srgb, CanvasText 9%, transparent);
  display: flex;
  flex: 0 0 auto;
  gap: 9px;
  padding: 10px;
}

.ai-waiting-state .ai-loading-indicator {
  flex: 0 0 20px;
  height: 20px;
  width: 20px;
}

.ai-waiting-state div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.ai-waiting-state strong {
  font-size: 12px;
}

.ai-waiting-state small {
  color: color-mix(in srgb, CanvasText 58%, transparent);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-process-error {
  background: color-mix(in srgb, #b9433f 8%, Canvas);
  border-bottom: 1px solid color-mix(in srgb, #b9433f 22%, transparent);
  color: #9f3431;
  padding: 10px;
}

.ai-process-error strong {
  font-size: 12px;
}

.ai-process-error p {
  font-size: 11px;
  line-height: 1.45;
  margin: 4px 0 0;
  overflow-wrap: anywhere;
}

.ai-progress-list {
  flex: 1;
  list-style: none;
  margin: 0;
  min-height: 0;
  overflow: auto;
  padding: 0;
}

.ai-progress-list li {
  border-bottom: 1px solid color-mix(in srgb, CanvasText 8%, transparent);
  display: grid;
  gap: 8px;
  grid-template-columns: 8px minmax(0, 1fr);
  padding: 9px 10px;
}

.ai-progress-dot {
  background: #7b858b;
  border-radius: 50%;
  height: 7px;
  margin-top: 4px;
  width: 7px;
}

.ai-progress-dot.ocr {
  background: #9b5f17;
}

.ai-progress-dot.comparing,
.ai-progress-dot.complete {
  background: #256f73;
}

.ai-progress-list li > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.ai-progress-list strong,
.ai-progress-list small {
  font-size: 10px;
}

.ai-progress-list small {
  color: color-mix(in srgb, CanvasText 52%, transparent);
}

.ai-ocr-preview {
  color: color-mix(in srgb, CanvasText 66%, transparent);
  font-size: 10px;
  margin: 2px 0 0;
}

.ai-ocr-preview summary {
  color: #256f73;
  cursor: pointer;
}

.ai-ocr-preview p {
  line-height: 1.5;
  margin: 5px 0 0;
  overflow-wrap: anywhere;
}

.ai-result-summary {
  border-bottom: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
  display: grid;
  flex: 0 0 58px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ai-result-summary div {
  align-content: center;
  display: grid;
  gap: 2px;
  padding: 7px;
  text-align: center;
}

.ai-result-summary div + div {
  border-left: 1px solid color-mix(in srgb, CanvasText 9%, transparent);
}

.ai-result-summary strong,
.ai-result-summary span {
  display: block;
}

.ai-result-summary strong {
  font-size: 15px;
}

.ai-result-summary span {
  color: color-mix(in srgb, CanvasText 54%, transparent);
  font-size: 9px;
}

.ai-result-conclusion {
  border-bottom: 1px solid color-mix(in srgb, CanvasText 9%, transparent);
  color: color-mix(in srgb, CanvasText 70%, transparent);
  flex: 0 0 auto;
  font-size: 11px;
  line-height: 1.45;
  margin: 0;
  padding: 9px 10px;
}

.ai-finding-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.ai-finding-list article {
  border-bottom: 1px solid color-mix(in srgb, CanvasText 9%, transparent);
  display: grid;
  gap: 5px;
  padding: 10px;
}

.ai-finding-list article > header {
  align-items: center;
  display: flex;
  gap: 6px;
}

.ai-finding-list article > header b,
.ai-finding-list article > header small {
  color: color-mix(in srgb, CanvasText 55%, transparent);
  font-size: 10px;
}

.ai-finding-list article > header small {
  margin-left: auto;
}

.ai-finding-list article > strong {
  font-size: 12px;
}

.ai-finding-list article > p {
  color: color-mix(in srgb, CanvasText 62%, transparent);
  font-size: 11px;
  line-height: 1.45;
  margin: 0;
}

.ai-no-findings {
  align-items: center;
  color: #2f7857;
  display: flex;
  flex-direction: column;
  font-size: 12px;
  gap: 8px;
  justify-content: center;
  min-height: 140px;
}

@keyframes ai-loading {
  to {
    transform: rotate(360deg);
  }
}

.paper-surface {
  background:
    linear-gradient(color-mix(in srgb, CanvasText 7%, transparent) 1px, transparent 1px), Canvas;
  background-size: 100% 34px;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  box-shadow: 0 8px 22px rgb(0 0 0 / 10%);
  color: CanvasText;
  font-family: 'Songti SC', 'Noto Serif CJK SC', serif;
  font-size: clamp(12px, var(--doc-zoom), 15px);
  line-height: 2;
  margin: 0 auto;
  max-width: 390px;
  min-height: 100%;
  padding: 34px 34px 26px;
  position: relative;
  width: min(100%, 390px);
}

.paper-surface.scanned {
  background-color: color-mix(in srgb, Canvas 94%, #d9923b 6%);
  filter: contrast(1.04);
}

.doc-title {
  font-size: 18px;
  font-weight: 700;
  text-align: center;
}

.mark {
  border-radius: 4px;
  padding: 1px 4px;
}

.mark.removed {
  background: rgb(185 67 63 / 16%);
  color: #9d3935;
}

.mark.added {
  background: rgb(40 120 92 / 16%);
  color: #28785c;
}

.stamp-area,
.ocr-warning {
  align-items: center;
  border: 1px dashed color-mix(in srgb, CanvasText 28%, transparent);
  color: color-mix(in srgb, CanvasText 46%, transparent);
  display: flex;
  font-family: inherit;
  font-size: 12px;
  height: 70px;
  justify-content: center;
  margin-top: 32px;
}

.ocr-warning {
  border-color: rgb(217 146 59 / 72%);
  color: #9b5f17;
}

@media (max-width: 800px) {
  .document-pair {
    grid-auto-rows: minmax(480px, 70dvh);
    grid-template-columns: 1fr;
    grid-template-rows: none;
    overflow: auto;
  }

  .document-pair .document-page {
    height: min(70dvh, 620px);
  }
}

@container app-content (max-width: 620px) {
  .compare-summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .compare-summary-strip article + article {
    border-left: 0;
  }

  .compare-summary-strip article:nth-child(even) {
    border-left: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
  }

  .compare-summary-strip article:nth-child(n + 3) {
    border-top: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
  }

  .table-panel-header,
  .viewer-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
