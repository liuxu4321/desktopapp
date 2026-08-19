import type { Display } from 'electron'
import type { WindowBounds } from '@shared/types'

const fallbackBounds: WindowBounds = { width: 1100, height: 720 }

export function ensureVisibleWindowBounds(bounds: WindowBounds, displays: Display[]): WindowBounds {
  const normalized = {
    ...fallbackBounds,
    ...bounds,
    width: Math.max(bounds.width, 640),
    height: Math.max(bounds.height, 480),
  }

  const x = normalized.x
  const y = normalized.y
  if (x === undefined || y === undefined) {
    return normalized
  }

  const isVisible = displays.some((display) => {
    const area = display.workArea
    const right = x + normalized.width
    const bottom = y + normalized.height
    return x < area.x + area.width && right > area.x && y < area.y + area.height && bottom > area.y
  })

  return isVisible ? normalized : fallbackBounds
}
