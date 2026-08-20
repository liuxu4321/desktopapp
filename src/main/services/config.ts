import Store from 'electron-store'
import log from 'electron-log/main'
import { safeStorage } from 'electron'
import {
  appConfigSchema,
  releaseChannelSchema,
  updateAiProviderSettingsSchema,
  windowBoundsSchema,
} from '@shared/schemas'
import type {
  AiProviderSettings,
  AppConfig,
  ThemePreference,
  UpdateAiProviderSettingsInput,
  WindowBounds,
} from '@shared/types'

interface StoredAiSettings {
  apiKey?: string
  baseUrl: string
  compareModel: string
  ocrModel: string
}

interface StoreShape {
  config: AppConfig
  ai: StoredAiSettings
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

const defaultAiSettings: StoredAiSettings = {
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  compareModel: 'qwen-plus',
  ocrModel: 'qwen3.5-ocr',
}

const store = new Store<StoreShape>({
  name: 'settings',
  clearInvalidConfig: true,
  defaults: {
    config: defaultConfig,
    ai: defaultAiSettings,
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

export function getAiProviderSettings(): AiProviderSettings {
  const settings = getStoredAiSettings()
  return {
    apiKeyConfigured: Boolean(settings.apiKey),
    baseUrl: settings.baseUrl,
    compareModel: settings.compareModel,
    ocrModel: settings.ocrModel,
  }
}

export function updateAiProviderSettings(input: UpdateAiProviderSettingsInput): AiProviderSettings {
  const parsed = updateAiProviderSettingsSchema.parse(input)
  const current = getStoredAiSettings()
  const next: StoredAiSettings = {
    baseUrl: parsed.baseUrl.replace(/\/$/, ''),
    compareModel: parsed.compareModel,
    ocrModel: parsed.ocrModel,
    ...(parsed.clearApiKey
      ? {}
      : parsed.apiKey
        ? { apiKey: protectApiKey(parsed.apiKey) }
        : current.apiKey
          ? { apiKey: current.apiKey }
          : {}),
  }
  store.set('ai', next)
  return getAiProviderSettings()
}

export function getDashScopeApiKey(): string {
  const protectedValue = getStoredAiSettings().apiKey
  if (!protectedValue) throw new Error('请先在设置中配置 DashScope API Key。')
  return unprotectApiKey(protectedValue)
}

function getStoredAiSettings(): StoredAiSettings {
  const value = store.get('ai')
  if (!value || typeof value !== 'object') return defaultAiSettings
  return {
    baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl : defaultAiSettings.baseUrl,
    compareModel:
      typeof value.compareModel === 'string' ? value.compareModel : defaultAiSettings.compareModel,
    ocrModel: typeof value.ocrModel === 'string' ? value.ocrModel : defaultAiSettings.ocrModel,
    ...(typeof value.apiKey === 'string' ? { apiKey: value.apiKey } : {}),
  }
}

function protectApiKey(apiKey: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return `encrypted:${safeStorage.encryptString(apiKey).toString('base64')}`
  }
  log.warn('OS encryption is unavailable; storing the DashScope API key without encryption')
  return `plain:${Buffer.from(apiKey, 'utf8').toString('base64')}`
}

function unprotectApiKey(value: string): string {
  const separator = value.indexOf(':')
  if (separator < 0) throw new Error('DashScope API Key 存储格式无效，请在设置中重新填写。')
  const mode = value.slice(0, separator)
  const buffer = Buffer.from(value.slice(separator + 1), 'base64')
  if (mode === 'encrypted') return safeStorage.decryptString(buffer)
  if (mode === 'plain') return buffer.toString('utf8')
  throw new Error('DashScope API Key 存储格式无效，请在设置中重新填写。')
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
