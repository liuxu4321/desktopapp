import { contextBridge, ipcRenderer } from 'electron'
import { ipcChannels } from '@shared/ipc'
import type { DesktopAPI } from './api'
import type { UpdateState } from '@shared/types'

const api: DesktopAPI = {
  getVersion: () => ipcRenderer.invoke(ipcChannels.appGetVersion),
  getPlatformInfo: () => ipcRenderer.invoke(ipcChannels.appGetPlatformInfo),
  openExternal: (url) => ipcRenderer.invoke(ipcChannels.appOpenExternal, url),
  selectFile: () => ipcRenderer.invoke(ipcChannels.appSelectFile),
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
