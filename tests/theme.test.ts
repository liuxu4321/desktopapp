import { describe, expect, it } from 'vitest'
import { resolveThemePreference } from '@shared/theme'

describe('theme preference', () => {
  it('resolves the system preference from the operating system appearance', () => {
    expect(resolveThemePreference('system', true)).toBe('dark')
    expect(resolveThemePreference('system', false)).toBe('light')
  })

  it('keeps explicit theme selections independent of the operating system', () => {
    expect(resolveThemePreference('dark', false)).toBe('dark')
    expect(resolveThemePreference('light', true)).toBe('light')
  })
})
