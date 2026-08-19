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
    openLogDirectory: partialBridge?.openLogDirectory ?? fallback.openLogDirectory,
    getConfig: partialBridge?.getConfig ?? fallback.getConfig,
    setTheme: partialBridge?.setTheme ?? fallback.setTheme,
    getUpdateState: partialBridge?.getUpdateState ?? fallback.getUpdateState,
    checkForUpdates: partialBridge?.checkForUpdates ?? fallback.checkForUpdates,
    installUpdate: partialBridge?.installUpdate ?? fallback.installUpdate,
    onUpdateStateChanged: partialBridge?.onUpdateStateChanged ?? fallback.onUpdateStateChanged,
  }
}
