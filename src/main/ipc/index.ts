import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { OpenDialogOptions } from 'electron'
import log from 'electron-log/main'
import { ipcChannels, type IpcChannel, type IpcInvokeMap } from '@shared/ipc'
import { themePreferenceSchema } from '@shared/schemas'
import { canUseBuiltInAutoUpdate, getPlatformName } from '@shared/platform'
import { getConfig, setThemePreference } from '@main/services/config'
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
