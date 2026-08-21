import type {
  AiComparisonResult,
  AiProviderSettings,
  AppConfig,
  ComparisonBatch,
  CompareDocumentsInput,
  CreateComparisonBatchInput,
  CreateDocumentProblemInput,
  DocumentProblemRecord,
  DocumentRecord,
  DocumentImportRole,
  ImportedDocument,
  PlatformInfo,
  SelectedFile,
  ThemePreference,
  UpdateDocumentInput,
  UpdateDocumentProblemInput,
  UpdateAiProviderSettingsInput,
  UpdateState,
} from './types'

export const ipcChannels = {
  appGetVersion: 'app:get-version',
  appGetPlatformInfo: 'app:get-platform-info',
  appOpenExternal: 'app:open-external',
  appSelectFile: 'app:select-file',
  documentsImport: 'documents:import',
  documentsList: 'documents:list',
  documentsGetPreview: 'documents:get-preview',
  documentsUpdate: 'documents:update',
  documentsDelete: 'documents:delete',
  documentProblemsList: 'document-problems:list',
  documentProblemsCreate: 'document-problems:create',
  documentProblemsUpdate: 'document-problems:update',
  documentProblemsDelete: 'document-problems:delete',
  aiSettingsGet: 'ai-settings:get',
  aiSettingsUpdate: 'ai-settings:update',
  documentsCompare: 'documents:compare',
  documentsCompareProgress: 'documents:compare-progress',
  comparisonBatchStart: 'comparison-batch:start',
  comparisonBatchLatest: 'comparison-batch:latest',
  comparisonBatchRetry: 'comparison-batch:retry',
  comparisonBatchCancel: 'comparison-batch:cancel',
  comparisonBatchProgress: 'comparison-batch:progress',
  documentComparisonLatest: 'document-comparison:latest',
  candidateComparisonLatest: 'candidate-comparison:latest',
  appOpenLogDirectory: 'app:open-log-directory',
  configGet: 'config:get',
  configSetTheme: 'config:set-theme',
  updaterGetState: 'updater:get-state',
  updaterCheck: 'updater:check',
  updaterInstall: 'updater:install',
  updaterStateChanged: 'updater:state-changed',
} as const

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels]

export interface IpcInvokeMap {
  [ipcChannels.appGetVersion]: {
    args: []
    result: string
  }
  [ipcChannels.appGetPlatformInfo]: {
    args: []
    result: PlatformInfo
  }
  [ipcChannels.appOpenExternal]: {
    args: [url: string]
    result: void
  }
  [ipcChannels.appSelectFile]: {
    args: []
    result: SelectedFile | null
  }
  [ipcChannels.documentsImport]: {
    args: [role: DocumentImportRole]
    result: ImportedDocument[]
  }
  [ipcChannels.documentsList]: {
    args: []
    result: DocumentRecord[]
  }
  [ipcChannels.documentsGetPreview]: {
    args: [id: string]
    result: string
  }
  [ipcChannels.documentsUpdate]: {
    args: [input: UpdateDocumentInput]
    result: DocumentRecord
  }
  [ipcChannels.documentsDelete]: {
    args: [id: string]
    result: boolean
  }
  [ipcChannels.documentProblemsList]: {
    args: []
    result: DocumentProblemRecord[]
  }
  [ipcChannels.documentProblemsCreate]: {
    args: [input: CreateDocumentProblemInput]
    result: DocumentProblemRecord
  }
  [ipcChannels.documentProblemsUpdate]: {
    args: [input: UpdateDocumentProblemInput]
    result: DocumentProblemRecord
  }
  [ipcChannels.documentProblemsDelete]: {
    args: [id: string]
    result: boolean
  }
  [ipcChannels.aiSettingsGet]: {
    args: []
    result: AiProviderSettings
  }
  [ipcChannels.aiSettingsUpdate]: {
    args: [input: UpdateAiProviderSettingsInput]
    result: AiProviderSettings
  }
  [ipcChannels.documentsCompare]: {
    args: [input: CompareDocumentsInput]
    result: AiComparisonResult
  }
  [ipcChannels.comparisonBatchStart]: {
    args: [input: CreateComparisonBatchInput]
    result: ComparisonBatch
  }
  [ipcChannels.comparisonBatchLatest]: {
    args: []
    result: ComparisonBatch | null
  }
  [ipcChannels.comparisonBatchRetry]: {
    args: [batchId: string]
    result: ComparisonBatch
  }
  [ipcChannels.comparisonBatchCancel]: {
    args: [batchId: string]
    result: ComparisonBatch
  }
  [ipcChannels.documentComparisonLatest]: {
    args: [input: CompareDocumentsInput]
    result: AiComparisonResult | null
  }
  [ipcChannels.candidateComparisonLatest]: {
    args: [candidateDocumentId: string]
    result: AiComparisonResult | null
  }
  [ipcChannels.appOpenLogDirectory]: {
    args: []
    result: void
  }
  [ipcChannels.configGet]: {
    args: []
    result: AppConfig
  }
  [ipcChannels.configSetTheme]: {
    args: [theme: ThemePreference]
    result: AppConfig
  }
  [ipcChannels.updaterGetState]: {
    args: []
    result: UpdateState
  }
  [ipcChannels.updaterCheck]: {
    args: []
    result: UpdateState
  }
  [ipcChannels.updaterInstall]: {
    args: []
    result: void
  }
}
