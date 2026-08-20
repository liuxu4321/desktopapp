import type { ReleaseChannel } from './types'

export function resolveReleaseChannel(version: string, configuredChannel?: string): ReleaseChannel {
  if (configuredChannel === 'beta' || configuredChannel === 'stable') {
    return configuredChannel
  }

  const prereleaseChannel = version.split('-', 2)[1]?.split('.', 1)[0]
  return prereleaseChannel === 'beta' ? 'beta' : 'stable'
}

export function toUpdateManifestChannel(channel: ReleaseChannel): 'latest' | 'beta' {
  return channel === 'beta' ? 'beta' : 'latest'
}
