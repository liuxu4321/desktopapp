import type { ThemePreference } from './types'

export type ResolvedTheme = Exclude<ThemePreference, 'system'>

export function resolveThemePreference(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference !== 'system') return preference
  return prefersDark ? 'dark' : 'light'
}
