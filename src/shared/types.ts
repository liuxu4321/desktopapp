export type PlatformName = 'windows' | 'macos' | 'linux'

export type RuntimePlatform = string

export type ThemePreference = 'light' | 'dark' | 'system'

export type ReleaseChannel = 'stable' | 'beta'

export interface PlatformInfo {
  platform: RuntimePlatform
  name: PlatformName
  arch: string
  versions: {
    electron: string
    chrome: string
    node: string
  }
  canAutoUpdate: boolean
}

export interface SelectedFile {
  name: string
  path: string
  size: number
}

export type DocumentImportRole = 'standard' | 'candidate'

export type DocumentKind = 'native-pdf' | 'scanned-pdf' | 'mixed-pdf' | 'unknown-pdf'

export type DocumentCompareStatus = '待比对' | '比对中' | '待查看' | '有问题'

export type DocumentProblemType = 'OCR疑点' | '关键字段变化' | '页数不一致' | '条款缺失'

export type DocumentProblemSeverity = 'high' | 'medium' | 'low'

export type DocumentTextSource = 'native' | 'ocr'

export type AiComparisonConclusion = 'no_issue' | 'has_issue' | 'needs_review'

export interface DocumentTextPage {
  page: number
  text: string
  source: DocumentTextSource
  confidence?: number
}

export interface DocumentRecord {
  id: string
  role: DocumentImportRole
  name: string
  size: number
  pageCount: number
  kind: DocumentKind
  compareStatus?: DocumentCompareStatus
  importedAt: string
  updatedAt: string
}

export interface ImportedDocument {
  id: string
  role: DocumentImportRole
  name: string
  size: number
  pageCount: number
  kind: DocumentKind
  status: 'imported'
  compareStatus?: DocumentCompareStatus
  importedAt: string
  updatedAt: string
  previewUrl: string
}

export interface UpdateDocumentInput {
  id: string
  name?: string
  compareStatus?: DocumentCompareStatus
}

export interface DocumentProblemRecord {
  id: string
  documentId: string
  fileName: string
  type: DocumentProblemType
  summary: string
  page: number
  severity: DocumentProblemSeverity
  confidence: number
  createdAt: string
  updatedAt: string
}

export interface CreateDocumentProblemInput {
  documentId: string
  type: DocumentProblemType
  summary: string
  page: number
  severity: DocumentProblemSeverity
  confidence: number
}

export interface UpdateDocumentProblemInput {
  id: string
  type?: DocumentProblemType
  summary?: string
  page?: number
  severity?: DocumentProblemSeverity
  confidence?: number
}

export interface AiProviderSettings {
  apiKeyConfigured: boolean
  baseUrl: string
  compareModel: string
  ocrModel: string
}

export interface UpdateAiProviderSettingsInput {
  apiKey?: string
  clearApiKey?: boolean
  baseUrl: string
  compareModel: string
  ocrModel: string
}

export interface CompareDocumentsInput {
  standardDocumentId: string
  candidateDocumentId: string
}

export type DocumentComparisonProgressStage =
  'preparing' | 'extracting' | 'ocr' | 'comparing' | 'saving' | 'complete'

export interface DocumentComparisonProgress {
  candidateDocumentId: string
  stage: DocumentComparisonProgressStage
  message: string
  documentRole?: DocumentImportRole
  page?: number
  totalPages?: number
  textPreview?: string
}

export interface AiComparisonFinding {
  id: string
  type: DocumentProblemType
  title: string
  detail: string
  standardValue?: string
  candidateValue?: string
  standardPage?: number
  candidatePage?: number
  severity: DocumentProblemSeverity
  confidence: number
}

export interface AiComparisonResult {
  id: string
  standardDocumentId: string
  candidateDocumentId: string
  conclusion: AiComparisonConclusion
  summary: string
  model: string
  findings: AiComparisonFinding[]
  createdAt: string
}

export interface AppConfig {
  theme: ThemePreference
  releaseChannel: ReleaseChannel
}

export interface DesktopAPI {
  getVersion(): Promise<string>
  getPlatformInfo(): Promise<PlatformInfo>
  openExternal(url: string): Promise<void>
  selectFile(): Promise<SelectedFile | null>
  importDocument(role: DocumentImportRole): Promise<ImportedDocument | null>
  listDocuments(): Promise<DocumentRecord[]>
  getDocumentPreview(id: string): Promise<string>
  updateDocument(input: UpdateDocumentInput): Promise<DocumentRecord>
  deleteDocument(id: string): Promise<boolean>
  listDocumentProblems(): Promise<DocumentProblemRecord[]>
  createDocumentProblem(input: CreateDocumentProblemInput): Promise<DocumentProblemRecord>
  updateDocumentProblem(input: UpdateDocumentProblemInput): Promise<DocumentProblemRecord>
  deleteDocumentProblem(id: string): Promise<boolean>
  getAiProviderSettings(): Promise<AiProviderSettings>
  updateAiProviderSettings(input: UpdateAiProviderSettingsInput): Promise<AiProviderSettings>
  compareDocuments(input: CompareDocumentsInput): Promise<AiComparisonResult>
  getLatestDocumentComparison(input: CompareDocumentsInput): Promise<AiComparisonResult | null>
  getLatestCandidateComparison(candidateDocumentId: string): Promise<AiComparisonResult | null>
  onDocumentComparisonProgress(callback: (progress: DocumentComparisonProgress) => void): () => void
  openLogDirectory(): Promise<void>
  getConfig(): Promise<AppConfig>
  setTheme(theme: ThemePreference): Promise<AppConfig>
  getUpdateState(): Promise<UpdateState>
  checkForUpdates(): Promise<UpdateState>
  installUpdate(): Promise<void>
  onUpdateStateChanged(callback: (state: UpdateState) => void): () => void
}

export interface WindowBounds {
  x?: number | undefined
  y?: number | undefined
  width: number
  height: number
}

export type UpdateStatus =
  'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface UpdateState {
  status: UpdateStatus
  channel: ReleaseChannel
  message: string
  version?: string
  progress?: UpdateProgress
  error?: string
}
