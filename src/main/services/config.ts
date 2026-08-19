import Store from 'electron-store'
import log from 'electron-log/main'
import { appConfigSchema, releaseChannelSchema, windowBoundsSchema } from '@shared/schemas'
import type { AppConfig, ThemePreference, WindowBounds } from '@shared/types'

interface StoreShape {
  config: AppConfig
  windowBounds: WindowBounds
}

const defaultConfig: AppConfig = {
  theme: 'system',
  releaseChannel: releaseChannelSchema.catch('stable').parse(process.env.UPDATE_CHANNEL),
}

const defaultWindowBounds: WindowBounds = {
  width: 1100,
  height: 720,
}

const store = new Store<StoreShape>({
  name: 'settings',
  clearInvalidConfig: true,
  defaults: {
    config: defaultConfig,
    windowBounds: defaultWindowBounds,
  },
})

export function getConfig(): AppConfig {
  const parsed = appConfigSchema.safeParse(store.get('config'))
  if (!parsed.success) {
    log.warn('Invalid app config detected; falling back to defaults')
    store.set('config', defaultConfig)
    return defaultConfig
  }
  return parsed.data
}

export function setThemePreference(theme: ThemePreference): AppConfig {
  const next = { ...getConfig(), theme }
  store.set('config', next)
  return next
}

export function getSavedWindowBounds(): WindowBounds {
  const parsed = windowBoundsSchema.safeParse(store.get('windowBounds'))
  return parsed.success ? parsed.data : defaultWindowBounds
}

export function saveWindowBounds(bounds: WindowBounds): void {
  const parsed = windowBoundsSchema.safeParse(bounds)
  if (parsed.success) {
    store.set('windowBounds', parsed.data)
  }
}
