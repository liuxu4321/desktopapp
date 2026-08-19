// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { createDesktopAPI } from '../src/shared/desktop-api'
import type { DesktopAPI } from '../src/shared/types'

function createFallbackAPI(): DesktopAPI {
  return {
    async getVersion() {
      return 'fallback'
    },
    async getPlatformInfo() {
      return {
        platform: 'browser',
        name: 'macos',
        arch: 'preview',
        versions: { electron: 'n/a', chrome: 'n/a', node: 'n/a' },
        canAutoUpdate: false,
      }
    },
    async openExternal() {},
    selectFile: vi.fn(async () => null),
    async openLogDirectory() {},
    async getConfig() {
      return { theme: 'system', releaseChannel: 'stable' }
    },
    async setTheme(theme) {
      return { theme, releaseChannel: 'stable' }
    },
    async getUpdateState() {
      return { status: 'not-available', channel: 'stable', message: 'Unavailable' }
    },
    async checkForUpdates() {
      return { status: 'not-available', channel: 'stable', message: 'Unavailable' }
    },
    async installUpdate() {},
    onUpdateStateChanged() {
      return () => undefined
    },
  }
}

describe('desktop API adapter', () => {
  it('falls back per method when a partial preload bridge is present', async () => {
    const fallback = createFallbackAPI()
    const bridgeGetVersion = vi.fn(async () => 'desktop')
    const api = createDesktopAPI({ getVersion: bridgeGetVersion }, fallback)

    await expect(api.getVersion()).resolves.toBe('desktop')
    await expect(api.selectFile()).resolves.toBeNull()
    expect(bridgeGetVersion).toHaveBeenCalledOnce()
    expect(fallback.selectFile).toHaveBeenCalledOnce()
  })
})
