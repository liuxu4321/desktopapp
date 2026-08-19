import type { AppConfig, PlatformInfo, SelectedFile, ThemePreference, UpdateState } from './types'

export const ipcChannels = {
  appGetVersion: 'app:get-version',
  appGetPlatformInfo: 'app:get-platform-info',
  appOpenExternal: 'app:open-external',
  appSelectFile: 'app:select-file',
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
