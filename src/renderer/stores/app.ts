import { defineStore } from 'pinia'
import { desktopAPI } from '@renderer/services/desktop-api'
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
      await desktopAPI.installUpdate()
    },
    clearError() {
      this.error = null
    },
    applyTheme(theme: ThemePreference) {
      document.documentElement.dataset.theme = theme
    },
  },
})

function friendlyError(error: unknown): string {
  console.error(error)
  return 'An application service is temporarily unavailable. Please try again.'
}
