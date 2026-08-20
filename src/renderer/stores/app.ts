import { defineStore } from 'pinia'
import { desktopAPI } from '@renderer/services/desktop-api'
import { resolveThemePreference } from '@shared/theme'
import type {
  AppConfig,
  PlatformInfo,
  SelectedFile,
  ThemePreference,
  UpdateState,
} from '@shared/types'

interface AppState {
  version: string
  platformInfo: PlatformInfo | null
  config: AppConfig
  selectedFile: SelectedFile | null
  selectingFile: boolean
  updateState: UpdateState
  loading: boolean
  error: string | null
}

let systemThemeQuery: MediaQueryList | null = null
let systemThemeListener: ((event: MediaQueryListEvent) => void) | null = null

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    version: '',
    platformInfo: null,
    config: { theme: 'system', releaseChannel: 'stable' },
    selectedFile: null,
    selectingFile: false,
    updateState: {
      status: 'idle',
      channel: 'stable',
      message: 'Updates are ready to check.',
    },
    loading: false,
    error: null,
  }),
  actions: {
    async initialize() {
      this.loading = true
      this.error = null
      try {
        const [version, platformInfo, config, updateState] = await Promise.all([
          desktopAPI.getVersion(),
          desktopAPI.getPlatformInfo(),
          desktopAPI.getConfig(),
          desktopAPI.getUpdateState(),
        ])
        this.version = version
        this.platformInfo = platformInfo
        this.config = config
        this.updateState = updateState
        this.applyTheme(config.theme)
        desktopAPI.onUpdateStateChanged((state) => {
          this.updateState = state
        })
      } catch (error) {
        this.error = friendlyError(error)
      } finally {
        this.loading = false
      }
    },
    async setTheme(theme: ThemePreference) {
      this.config = await desktopAPI.setTheme(theme)
      this.applyTheme(this.config.theme)
    },
    async selectFile() {
      this.error = null
      this.selectingFile = true
      try {
        const selectedFile = await desktopAPI.selectFile()
        if (selectedFile) this.selectedFile = selectedFile
      } catch (error) {
        this.error = friendlyError(error)
      } finally {
        this.selectingFile = false
      }
    },
    async checkForUpdates() {
      this.error = null
      try {
        this.updateState = await desktopAPI.checkForUpdates()
      } catch (error) {
        this.error = friendlyError(error)
      }
    },
    async installUpdate() {
      this.error = null
      try {
        await desktopAPI.installUpdate()
      } catch (error) {
        this.error = friendlyError(error)
      }
    },
    clearError() {
      this.error = null
    },
    applyTheme(theme: ThemePreference) {
      stopSystemThemeListener()

      const root = document.documentElement
      root.dataset.themePreference = theme

      if (theme !== 'system') {
        root.dataset.theme = resolveThemePreference(theme, false)
        return
      }

      systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
      root.dataset.theme = resolveThemePreference(theme, systemThemeQuery.matches)
      systemThemeListener = (event) => {
        root.dataset.theme = resolveThemePreference('system', event.matches)
      }
      systemThemeQuery.addEventListener('change', systemThemeListener)
    },
  },
})

function stopSystemThemeListener(): void {
  if (systemThemeQuery && systemThemeListener) {
    systemThemeQuery.removeEventListener('change', systemThemeListener)
  }
  systemThemeQuery = null
  systemThemeListener = null
}

function friendlyError(error: unknown): string {
  console.error(error)
  return 'An application service is temporarily unavailable. Please try again.'
}
