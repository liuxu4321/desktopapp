import { contextBridge, ipcRenderer } from 'electron'
import { ipcChannels } from '@shared/ipc'
import type { DesktopAPI } from './api'
import type { DocumentComparisonProgress, UpdateState } from '@shared/types'

const api: DesktopAPI = {
  getVersion: () => ipcRenderer.invoke(ipcChannels.appGetVersion),
  getPlatformInfo: () => ipcRenderer.invoke(ipcChannels.appGetPlatformInfo),
  openExternal: (url) => ipcRenderer.invoke(ipcChannels.appOpenExternal, url),
  selectFile: () => ipcRenderer.invoke(ipcChannels.appSelectFile),
  importDocument: (role) => ipcRenderer.invoke(ipcChannels.documentsImport, role),
  listDocuments: () => ipcRenderer.invoke(ipcChannels.documentsList),
  getDocumentPreview: (id) => ipcRenderer.invoke(ipcChannels.documentsGetPreview, id),
  updateDocument: (input) => ipcRenderer.invoke(ipcChannels.documentsUpdate, input),
  deleteDocument: (id) => ipcRenderer.invoke(ipcChannels.documentsDelete, id),
  listDocumentProblems: () => ipcRenderer.invoke(ipcChannels.documentProblemsList),
  createDocumentProblem: (input) => ipcRenderer.invoke(ipcChannels.documentProblemsCreate, input),
  updateDocumentProblem: (input) => ipcRenderer.invoke(ipcChannels.documentProblemsUpdate, input),
  deleteDocumentProblem: (id) => ipcRenderer.invoke(ipcChannels.documentProblemsDelete, id),
  getAiProviderSettings: () => ipcRenderer.invoke(ipcChannels.aiSettingsGet),
  updateAiProviderSettings: (input) => ipcRenderer.invoke(ipcChannels.aiSettingsUpdate, input),
  compareDocuments: (input) => ipcRenderer.invoke(ipcChannels.documentsCompare, input),
  getLatestDocumentComparison: (input) =>
    ipcRenderer.invoke(ipcChannels.documentComparisonLatest, input),
  getLatestCandidateComparison: (candidateDocumentId) =>
    ipcRenderer.invoke(ipcChannels.candidateComparisonLatest, candidateDocumentId),
  onDocumentComparisonProgress: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      progress: DocumentComparisonProgress,
    ): void => {
      callback(progress)
    }
    ipcRenderer.on(ipcChannels.documentsCompareProgress, listener)
    return () => ipcRenderer.removeListener(ipcChannels.documentsCompareProgress, listener)
  },
  openLogDirectory: () => ipcRenderer.invoke(ipcChannels.appOpenLogDirectory),
  getConfig: () => ipcRenderer.invoke(ipcChannels.configGet),
  setTheme: (theme) => ipcRenderer.invoke(ipcChannels.configSetTheme, theme),
  getUpdateState: () => ipcRenderer.invoke(ipcChannels.updaterGetState),
  checkForUpdates: () => ipcRenderer.invoke(ipcChannels.updaterCheck),
  installUpdate: () => ipcRenderer.invoke(ipcChannels.updaterInstall),
  onUpdateStateChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: UpdateState): void => {
      callback(state)
    }
    ipcRenderer.on(ipcChannels.updaterStateChanged, listener)
    return () => {
      ipcRenderer.removeListener(ipcChannels.updaterStateChanged, listener)
    }
  },
}

contextBridge.exposeInMainWorld('desktopAPI', api)
