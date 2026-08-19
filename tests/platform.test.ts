import { describe, expect, it } from 'vitest'
import { canUseBuiltInAutoUpdate, getPlatformName } from '@shared/platform'

describe('platform helpers', () => {
  it('normalizes platform names', () => {
    expect(getPlatformName('win32')).toBe('windows')
    expect(getPlatformName('darwin')).toBe('macos')
    expect(getPlatformName('linux')).toBe('linux')
  })

  it('enables built-in updates only on Windows and macOS', () => {
    expect(canUseBuiltInAutoUpdate('win32')).toBe(true)
    expect(canUseBuiltInAutoUpdate('darwin')).toBe(true)
    expect(canUseBuiltInAutoUpdate('linux')).toBe(false)
  })
})
