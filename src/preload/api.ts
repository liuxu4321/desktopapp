import type { DesktopAPI } from '@shared/types'

export type { DesktopAPI } from '@shared/types'

declare global {
  interface Window {
    desktopAPI?: DesktopAPI
  }
}
