import { describe, expect, it } from 'vitest'
import { canStartUpdateCheck, createIdleUpdateState } from '@shared/update-state'

describe('update state helpers', () => {
  it('creates platform-aware idle messages', () => {
    expect(createIdleUpdateState('stable', true).message).toContain('ready')
    expect(createIdleUpdateState('beta', false).message).toContain('package manager')
  })

  it('prevents duplicate checks while busy', () => {
    expect(canStartUpdateCheck({ status: 'idle', channel: 'stable', message: 'ready' })).toBe(true)
    expect(canStartUpdateCheck({ status: 'checking', channel: 'stable', message: 'busy' })).toBe(
      false,
    )
    expect(canStartUpdateCheck({ status: 'downloading', channel: 'stable', message: 'busy' })).toBe(
      false,
    )
  })
})
