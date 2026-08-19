import { describe, expect, it } from 'vitest'
import { ipcChannels } from '@shared/ipc'
import { appConfigSchema, externalUrlSchema, themePreferenceSchema } from '@shared/schemas'

describe('IPC contracts and schemas', () => {
  it('keeps IPC channel strings centralized', () => {
    expect(new Set(Object.values(ipcChannels)).size).toBe(Object.values(ipcChannels).length)
    expect(ipcChannels.updaterCheck).toBe('updater:check')
  })

  it('accepts only supported theme values', () => {
    expect(themePreferenceSchema.parse('dark')).toBe('dark')
    expect(() => themePreferenceSchema.parse('blue')).toThrow()
  })

  it('applies safe config defaults', () => {
    expect(appConfigSchema.parse({})).toEqual({ theme: 'system', releaseChannel: 'stable' })
  })

  it('allows only approved external protocols', () => {
    expect(externalUrlSchema.parse('https://example.com')).toBe('https://example.com')
    expect(externalUrlSchema.parse('mailto:support@example.com')).toBe('mailto:support@example.com')
    expect(() => externalUrlSchema.parse('file:///etc/passwd')).toThrow()
    expect(() => externalUrlSchema.parse('javascript:alert(1)')).toThrow()
  })
})
