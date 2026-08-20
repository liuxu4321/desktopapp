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
      this.setState({ status: 'checking', message: '正在检查新版本...' })
    })

    autoUpdater.on('update-available', (info) => {
      this.setState({
        status: 'available',
        message: `发现新版本 v${info.version}，正在下载...`,
        version: info.version,
      })
    })

    autoUpdater.on('update-not-available', () => {
      this.checkInProgress = false
      this.setState({ status: 'not-available', message: '当前已是最新版本。' })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.setState({
        status: 'downloading',
        message: '正在下载新版本...',
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
        message: '新版本已下载完成，可以重启应用并安装。',
        version: info.version,
      })
    })

    autoUpdater.on('error', (error) => {
      this.checkInProgress = false
      this.setState({
        status: 'error',
        message: '检查更新失败，请确认网络连接后重试。',
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
        message: '当前平台请通过应用商店或系统包管理器进行升级。',
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
    this.setState({ status: 'checking', message: '开发环境：正在模拟检查更新...' })
    await wait(350)
    this.setState({
      status: 'available',
      message: '开发环境：发现模拟新版本，正在下载...',
      version: '0.1.1-mock',
    })
    await wait(350)
    this.setState({
      status: 'downloading',
      message: '开发环境：正在下载模拟更新...',
      progress: { percent: 65, transferred: 65, total: 100, bytesPerSecond: 1024 },
    })
    await wait(350)
    this.checkInProgress = false
    this.setState({
      status: 'downloaded',
      message: '开发环境：模拟更新已下载，正式安装包中可重启安装。',
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
