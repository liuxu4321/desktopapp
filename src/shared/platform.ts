import type { PlatformName, RuntimePlatform } from './types'

export function getPlatformName(platform: RuntimePlatform): PlatformName {
  if (platform === 'win32') return 'windows'
  if (platform === 'darwin') return 'macos'
  return 'linux'
}

export function canUseBuiltInAutoUpdate(platform: RuntimePlatform): boolean {
  return platform === 'win32' || platform === 'darwin'
}
