import { describe, expect, it } from 'vitest'
import { ensureVisibleWindowBounds } from '@main/window-bounds'
import type { Display } from 'electron'

const display = {
  workArea: { x: 0, y: 0, width: 1440, height: 900 },
} as Display

describe('window bounds', () => {
  it('keeps visible saved bounds', () => {
    expect(
      ensureVisibleWindowBounds({ x: 100, y: 100, width: 900, height: 620 }, [display]),
    ).toEqual({
      x: 100,
      y: 100,
      width: 900,
      height: 620,
    })
  })

  it('falls back when bounds are off screen', () => {
    expect(
      ensureVisibleWindowBounds({ x: 9000, y: 9000, width: 900, height: 620 }, [display]),
    ).toEqual({
      width: 1100,
      height: 720,
    })
  })
})
