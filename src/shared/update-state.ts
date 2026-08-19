import type { UpdateState } from './types'

export function canStartUpdateCheck(state: UpdateState): boolean {
  return !['checking', 'downloading'].includes(state.status)
}

export function createIdleUpdateState(
  channel: UpdateState['channel'],
  canAutoUpdate: boolean,
): UpdateState {
  return {
    status: 'idle',
    channel,
    message: canAutoUpdate
      ? 'Updates are ready to check.'
      : 'Linux builds should be updated through the app store or system package manager.',
  }
}
