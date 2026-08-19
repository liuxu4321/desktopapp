import type { BrowserWindow } from 'electron'
import { app } from 'electron'
import electronUpdater from 'electron-updater'
import log from 'electron-log/main'
import { ipcChannels } from '@shared/ipc'
import { canUseBuiltInAutoUpdate } from '@shared/platform'
import { canStartUpdateCheck, createIdleUpdateState } from '@shared/update-state'
import type { ReleaseChannel, UpdateState } from '@shared/types'

const updateChannel = (
  process.env.UPDATE_CHANNEL === 'beta' ? 'beta' : 'stable'
) satisfies ReleaseChannel
const { autoUpdater } = electronUpdater

export class UpdateService {
  private state: UpdateState = createIdleUpdateState(
    updateChannel,
    canUseBuiltInAutoUpdate(process.platform),
  )

  private window: BrowserWindow | null = null
  private checkInProgress = false

  constructor() {
    autoUpdater.logger = log
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.channel = updateChannel
    autoUpdater.allowPrerelease = updateChannel === 'beta'
  }

  attachWindow(window: BrowserWindow): void {
    this.window = window
  }

  initialize(): void {
    autoUpdater.on('checking-for-update', () => {
      this.setState({ status: 'checking', message: 'Checking for updates...' })
    })

    autoUpdater.on('update-available', (info) => {
      this.setState({
        status: 'available',
        message: `Version ${info.version} is available. Downloading...`,
        version: info.version,
      })
    })

    autoUpdater.on('update-not-available', () => {
      this.checkInProgress = false
      this.setState({ status: 'not-available', message: 'You are running the latest version.' })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.setState({
        status: 'downloading',
        message: 'Downloading update...',
        progress: {
          percent: progress.percent,
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond,
        },
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.checkInProgress = false
      this.setState({
        status: 'downloaded',
        message: 'Update downloaded. Restart to install when you are ready.',
        version: info.version,
      })
    })

    autoUpdater.on('error', (error) => {
      this.checkInProgress = false
      this.setState({
        status: 'error',
        message: 'Update check failed. Please check your network and try again.',
        error: error.message,
      })
      log.warn('Update error', error)
    })
  }

  scheduleStartupCheck(): void {
    setTimeout(() => {
      void this.checkForUpdates()
    }, 15_000)
  }

  getState(): UpdateState {
    return this.state
  }

  async checkForUpdates(): Promise<UpdateState> {
    if (!canUseBuiltInAutoUpdate(process.platform)) {
      this.setState({
        status: 'not-available',
        message: 'Linux builds should be updated through the app store or system package manager.',
      })
      return this.state
    }

    if (!app.isPackaged) {
      return this.runMockUpdateFlow()
    }

    if (this.checkInProgress || !canStartUpdateCheck(this.state)) {
      return this.state
    }

    this.checkInProgress = true
    await autoUpdater.checkForUpdates()
    return this.state
  }

  quitAndInstall(): void {
    if (this.state.status !== 'downloaded' || !app.isPackaged) return
    autoUpdater.quitAndInstall(false, true)
  }

  private async runMockUpdateFlow(): Promise<UpdateState> {
    if (this.checkInProgress) return this.state
    this.checkInProgress = true
    this.setState({ status: 'checking', message: 'Mock update check in development...' })
    await wait(350)
    this.setState({
      status: 'available',
      message: 'Mock beta/stable update available. Simulating download...',
      version: '0.1.1-mock',
    })
    await wait(350)
    this.setState({
      status: 'downloading',
      message: 'Mock update downloading...',
      progress: { percent: 65, transferred: 65, total: 100, bytesPerSecond: 1024 },
    })
    await wait(350)
    this.checkInProgress = false
    this.setState({
      status: 'downloaded',
      message: 'Mock update downloaded. Restart is disabled in development.',
      version: '0.1.1-mock',
      progress: { percent: 100, transferred: 100, total: 100, bytesPerSecond: 0 },
    })
    return this.state
  }

  private setState(next: Partial<UpdateState>): void {
    this.state = {
      ...this.state,
      ...next,
      channel: updateChannel,
    }
    log.info('Update state changed', { status: this.state.status, channel: this.state.channel })
    this.window?.webContents.send(ipcChannels.updaterStateChanged, this.state)
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
