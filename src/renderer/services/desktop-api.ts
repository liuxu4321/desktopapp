import type { AppConfig, DesktopAPI, PlatformInfo, SelectedFile, UpdateState } from '@shared/types'
import { createDesktopAPI } from '@shared/desktop-api'

let previewConfig: AppConfig = { theme: 'system', releaseChannel: 'stable' }

const previewPlatform: PlatformInfo = {
  platform: 'browser',
  name: getPreviewPlatformName(),
  arch: 'preview',
  versions: {
    electron: 'not available',
    chrome: navigator.userAgent,
    node: 'not available',
  },
  canAutoUpdate: false,
}

const previewUpdateState: UpdateState = {
  status: 'not-available',
  channel: 'stable',
  message: 'Updates are only available in the desktop application.',
}

const previewAPI: DesktopAPI = {
  getVersion: async () => 'browser-preview',
  getPlatformInfo: async () => previewPlatform,
  openExternal: async (url) => {
    const parsed = new URL(url)
    if (!['https:', 'mailto:'].includes(parsed.protocol))
      throw new Error('Unsupported URL protocol.')
    window.open(parsed.toString(), '_blank', 'noopener,noreferrer')
  },
  selectFile: selectBrowserFile,
  openLogDirectory: async () => undefined,
  getConfig: async () => ({ ...previewConfig }),
  setTheme: async (theme) => {
    previewConfig = { ...previewConfig, theme }
    return { ...previewConfig }
  },
  getUpdateState: async () => ({ ...previewUpdateState }),
  checkForUpdates: async () => ({ ...previewUpdateState }),
  installUpdate: async () => undefined,
  onUpdateStateChanged: () => () => undefined,
}

const bridge = window.desktopAPI as Partial<DesktopAPI> | undefined

export const desktopAPI = createDesktopAPI(bridge, previewAPI)

export const isBrowserPreview = bridge === undefined

function selectBrowserFile(): Promise<SelectedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.hidden = true

    const finish = (): void => {
      const file = input.files?.[0]
      input.remove()
      resolve(
        file
          ? {
              name: file.name,
              path: `Browser selection: ${file.name}`,
              size: file.size,
            }
          : null,
      )
    }

    input.addEventListener('change', finish, { once: true })
    input.addEventListener('cancel', finish, { once: true })
    document.body.append(input)
    input.click()
  })
}

function getPreviewPlatformName(): PlatformInfo['name'] {
  const userAgent = navigator.userAgent.toLocaleLowerCase()
  if (userAgent.includes('win')) return 'windows'
  if (userAgent.includes('linux')) return 'linux'
  return 'macos'
}
