import type { UpdateState } from './types'

export function canStartUpdateCheck(state: UpdateState): boolean {
  return !['checking', 'downloading'].includes(state.status)
}

export function hasUpdateAvailable(state: UpdateState): boolean {
  return ['available', 'downloading', 'downloaded'].includes(state.status)
}

export function createIdleUpdateState(
  channel: UpdateState['channel'],
  canAutoUpdate: boolean,
): UpdateState {
  return {
    status: 'idle',
    channel,
    message: canAutoUpdate
      ? '可以检查是否有新版本。'
      : '当前平台请通过应用商店或系统包管理器进行升级。',
  }
}
