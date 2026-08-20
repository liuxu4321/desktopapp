import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { OpenDialogOptions } from 'electron'
import log from 'electron-log/main'
import { ipcChannels, type IpcChannel, type IpcInvokeMap } from '@shared/ipc'
import {
  compareDocumentsSchema,
  createDocumentProblemSchema,
  documentIdSchema,
  documentImportRoleSchema,
  documentProblemIdSchema,
  themePreferenceSchema,
  updateDocumentProblemSchema,
  updateDocumentSchema,
  updateAiProviderSettingsSchema,
} from '@shared/schemas'
import { canUseBuiltInAutoUpdate, getPlatformName } from '@shared/platform'
import {
  getAiProviderSettings,
  getConfig,
  setThemePreference,
  updateAiProviderSettings,
} from '@main/services/config'
import {
  compareDocuments,
  getLatestCandidateComparison,
  getLatestDocumentComparison,
} from '@main/services/document-comparison'
import { importDocumentFromDialog } from '@main/services/document-import'
import {
  createDocumentProblem,
  deleteDocument,
  deleteDocumentProblem,
  getDocumentPreview,
  listDocumentProblems,
  listDocuments,
  updateDocument,
  updateDocumentProblem,
} from '@main/services/document-store'
import { assertAllowedExternalUrl } from '@main/services/url'
import type { UpdateService } from '@main/updater'

type HandlerResult<C extends keyof IpcInvokeMap> =
  Promise<IpcInvokeMap[C]['result']> | IpcInvokeMap[C]['result']

function handle<C extends keyof IpcInvokeMap>(
  channel: C,
  listener: (...args: IpcInvokeMap[C]['args']) => HandlerResult<C>,
): void {
  ipcMain.handle(channel as IpcChannel, (_event, ...args: IpcInvokeMap[C]['args']) =>
    listener(...args),
  )
}

export function registerIpcHandlers(updateService: UpdateService): void {
  handle(ipcChannels.appGetVersion, () => app.getVersion())

  handle(ipcChannels.appGetPlatformInfo, () => ({
    platform: process.platform,
    name: getPlatformName(process.platform),
    arch: process.arch,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
    canAutoUpdate: canUseBuiltInAutoUpdate(process.platform),
  }))

  handle(ipcChannels.appOpenExternal, async (url) => {
    const allowedUrl = assertAllowedExternalUrl(url)
    await shell.openExternal(allowedUrl)
  })

  ipcMain.handle(ipcChannels.appSelectFile, async (event) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      properties: ['openFile'],
      securityScopedBookmarks: false,
    }
    const result = parentWindow
      ? await dialog.showOpenDialog(parentWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    if (!filePath) return null

    const { basename } = await import('node:path')
    const { stat } = await import('node:fs/promises')
    const fileStat = await stat(filePath)
    return {
      name: basename(filePath),
      path: filePath,
      size: fileStat.size,
    }
  })

  ipcMain.handle(ipcChannels.documentsImport, async (event, role) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender)
    return importDocumentFromDialog(parentWindow, documentImportRoleSchema.parse(role))
  })

  handle(ipcChannels.documentsList, () => listDocuments())
  handle(ipcChannels.documentsGetPreview, (id) => getDocumentPreview(documentIdSchema.parse(id)))
  handle(ipcChannels.documentsUpdate, (input) => {
    const parsed = updateDocumentSchema.parse(input)
    return updateDocument({
      id: parsed.id,
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.compareStatus !== undefined ? { compareStatus: parsed.compareStatus } : {}),
    })
  })
  handle(ipcChannels.documentsDelete, (id) => deleteDocument(documentIdSchema.parse(id)))
  handle(ipcChannels.documentProblemsList, () => listDocumentProblems())
  handle(ipcChannels.documentProblemsCreate, (input) =>
    createDocumentProblem(createDocumentProblemSchema.parse(input)),
  )
  handle(ipcChannels.documentProblemsUpdate, (input) => {
    const parsed = updateDocumentProblemSchema.parse(input)
    return updateDocumentProblem({
      id: parsed.id,
      ...(parsed.type !== undefined ? { type: parsed.type } : {}),
      ...(parsed.summary !== undefined ? { summary: parsed.summary } : {}),
      ...(parsed.page !== undefined ? { page: parsed.page } : {}),
      ...(parsed.severity !== undefined ? { severity: parsed.severity } : {}),
      ...(parsed.confidence !== undefined ? { confidence: parsed.confidence } : {}),
    })
  })
  handle(ipcChannels.documentProblemsDelete, (id) =>
    deleteDocumentProblem(documentProblemIdSchema.parse(id)),
  )
  handle(ipcChannels.aiSettingsGet, () => getAiProviderSettings())
  handle(ipcChannels.aiSettingsUpdate, (input) => {
    const parsed = updateAiProviderSettingsSchema.parse(input)
    return updateAiProviderSettings({
      baseUrl: parsed.baseUrl,
      compareModel: parsed.compareModel,
      ocrModel: parsed.ocrModel,
      ...(parsed.apiKey !== undefined ? { apiKey: parsed.apiKey } : {}),
      ...(parsed.clearApiKey !== undefined ? { clearApiKey: parsed.clearApiKey } : {}),
    })
  })
  ipcMain.handle(ipcChannels.documentsCompare, (event, input) =>
    compareDocuments(compareDocumentsSchema.parse(input), (progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(ipcChannels.documentsCompareProgress, progress)
      }
    }),
  )
  handle(ipcChannels.documentComparisonLatest, (input) =>
    getLatestDocumentComparison(compareDocumentsSchema.parse(input)),
  )
  handle(ipcChannels.candidateComparisonLatest, (candidateDocumentId) => {
    const parsed = documentIdSchema.parse(candidateDocumentId)
    if (!parsed.startsWith('DOC-')) throw new Error('待比对文书编号无效。')
    return getLatestCandidateComparison(parsed)
  })

  handle(ipcChannels.appOpenLogDirectory, async () => {
    const file = log.transports.file.getFile()
    await shell.openPath(file.path.replace(/[/\\][^/\\]+$/, ''))
  })

  handle(ipcChannels.configGet, () => getConfig())

  handle(ipcChannels.configSetTheme, (theme) =>
    setThemePreference(themePreferenceSchema.parse(theme)),
  )

  handle(ipcChannels.updaterGetState, () => updateService.getState())
  handle(ipcChannels.updaterCheck, () => updateService.checkForUpdates())
  handle(ipcChannels.updaterInstall, () => updateService.quitAndInstall())
}
