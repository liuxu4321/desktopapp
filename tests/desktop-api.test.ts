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
    importDocument: vi.fn(async () => []),
    listDocuments: vi.fn(async () => []),
    getDocumentPreview: vi.fn(async () => ''),
    updateDocument: vi.fn(async () => {
      throw new Error('Not implemented in fallback test.')
    }),
    deleteDocument: vi.fn(async () => false),
    listDocumentProblems: vi.fn(async () => []),
    createDocumentProblem: vi.fn(async () => {
      throw new Error('Not implemented in fallback test.')
    }),
    updateDocumentProblem: vi.fn(async () => {
      throw new Error('Not implemented in fallback test.')
    }),
    deleteDocumentProblem: vi.fn(async () => false),
    getAiProviderSettings: vi.fn(async () => ({
      apiKeyConfigured: false,
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      compareModel: 'qwen-plus',
      ocrModel: 'qwen3.5-ocr',
    })),
    updateAiProviderSettings: vi.fn(async (input) => ({
      apiKeyConfigured: Boolean(input.apiKey),
      baseUrl: input.baseUrl,
      compareModel: input.compareModel,
      ocrModel: input.ocrModel,
    })),
    compareDocuments: vi.fn(async () => {
      throw new Error('Not implemented in fallback test.')
    }),
    startComparisonBatch: vi.fn(async () => {
      throw new Error('Not implemented in fallback test.')
    }),
    getLatestComparisonBatch: vi.fn(async () => null),
    retryComparisonBatch: vi.fn(async () => {
      throw new Error('Not implemented in fallback test.')
    }),
    cancelComparisonBatch: vi.fn(async () => {
      throw new Error('Not implemented in fallback test.')
    }),
    getLatestDocumentComparison: vi.fn(async () => null),
    getLatestCandidateComparison: vi.fn(async () => null),
    onDocumentComparisonProgress: vi.fn(() => () => undefined),
    onComparisonBatchProgress: vi.fn(() => () => undefined),
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
