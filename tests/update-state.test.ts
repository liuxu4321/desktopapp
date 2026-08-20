import { describe, expect, it } from 'vitest'
import {
  canStartUpdateCheck,
  createIdleUpdateState,
  hasUpdateAvailable,
} from '@shared/update-state'
import { resolveReleaseChannel, toUpdateManifestChannel } from '@shared/release-channel'

describe('update state helpers', () => {
  it('creates platform-aware idle messages', () => {
    expect(createIdleUpdateState('stable', true).message).toContain('新版本')
    expect(createIdleUpdateState('beta', false).message).toContain('包管理器')
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

  it('shows menu attention while a new version is actionable', () => {
    expect(hasUpdateAvailable({ status: 'available', channel: 'stable', message: 'found' })).toBe(
      true,
    )
    expect(hasUpdateAvailable({ status: 'downloading', channel: 'stable', message: 'busy' })).toBe(
      true,
    )
    expect(hasUpdateAvailable({ status: 'downloaded', channel: 'stable', message: 'ready' })).toBe(
      true,
    )
    expect(
      hasUpdateAvailable({ status: 'not-available', channel: 'stable', message: 'latest' }),
    ).toBe(false)
  })

  it('derives the update channel from packaged prerelease versions', () => {
    expect(resolveReleaseChannel('0.1.0-beta.3')).toBe('beta')
    expect(resolveReleaseChannel('0.1.0')).toBe('stable')
    expect(resolveReleaseChannel('0.1.0-beta.3', 'stable')).toBe('stable')
    expect(toUpdateManifestChannel('beta')).toBe('beta')
    expect(toUpdateManifestChannel('stable')).toBe('latest')
  })
})
