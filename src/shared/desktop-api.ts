import type { DesktopAPI } from './types'

export function createDesktopAPI(
  partialBridge: Partial<DesktopAPI> | undefined,
  fallback: DesktopAPI,
): DesktopAPI {
  return {
    getVersion: partialBridge?.getVersion ?? fallback.getVersion,
    getPlatformInfo: partialBridge?.getPlatformInfo ?? fallback.getPlatformInfo,
    openExternal: partialBridge?.openExternal ?? fallback.openExternal,
    selectFile: partialBridge?.selectFile ?? fallback.selectFile,
    importDocument: partialBridge?.importDocument ?? fallback.importDocument,
    listDocuments: partialBridge?.listDocuments ?? fallback.listDocuments,
    getDocumentPreview: partialBridge?.getDocumentPreview ?? fallback.getDocumentPreview,
    updateDocument: partialBridge?.updateDocument ?? fallback.updateDocument,
    deleteDocument: partialBridge?.deleteDocument ?? fallback.deleteDocument,
    listDocumentProblems: partialBridge?.listDocumentProblems ?? fallback.listDocumentProblems,
    createDocumentProblem: partialBridge?.createDocumentProblem ?? fallback.createDocumentProblem,
    updateDocumentProblem: partialBridge?.updateDocumentProblem ?? fallback.updateDocumentProblem,
    deleteDocumentProblem: partialBridge?.deleteDocumentProblem ?? fallback.deleteDocumentProblem,
    getAiProviderSettings: partialBridge?.getAiProviderSettings ?? fallback.getAiProviderSettings,
    updateAiProviderSettings:
      partialBridge?.updateAiProviderSettings ?? fallback.updateAiProviderSettings,
    compareDocuments: partialBridge?.compareDocuments ?? fallback.compareDocuments,
    getLatestDocumentComparison:
      partialBridge?.getLatestDocumentComparison ?? fallback.getLatestDocumentComparison,
    getLatestCandidateComparison:
      partialBridge?.getLatestCandidateComparison ?? fallback.getLatestCandidateComparison,
    onDocumentComparisonProgress:
      partialBridge?.onDocumentComparisonProgress ?? fallback.onDocumentComparisonProgress,
    openLogDirectory: partialBridge?.openLogDirectory ?? fallback.openLogDirectory,
    getConfig: partialBridge?.getConfig ?? fallback.getConfig,
    setTheme: partialBridge?.setTheme ?? fallback.setTheme,
    getUpdateState: partialBridge?.getUpdateState ?? fallback.getUpdateState,
    checkForUpdates: partialBridge?.checkForUpdates ?? fallback.checkForUpdates,
    installUpdate: partialBridge?.installUpdate ?? fallback.installUpdate,
    onUpdateStateChanged: partialBridge?.onUpdateStateChanged ?? fallback.onUpdateStateChanged,
  }
}
