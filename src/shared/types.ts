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

export interface AppConfig {
  theme: ThemePreference
  releaseChannel: ReleaseChannel
}

export interface DesktopAPI {
  getVersion(): Promise<string>
  getPlatformInfo(): Promise<PlatformInfo>
  openExternal(url: string): Promise<void>
  selectFile(): Promise<SelectedFile | null>
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
