import { describe, expect, it } from 'vitest'
import { enhanceDocumentRaster } from '../src/shared/document-image-enhancement'

describe('document image enhancement', () => {
  it('stretches a low-contrast grayscale document while keeping alpha', () => {
    const result = enhanceDocumentRaster({
      width: 3,
      height: 1,
      data: new Uint8ClampedArray([90, 90, 90, 255, 150, 150, 150, 255, 220, 220, 220, 180]),
    })

    expect(result.data[0]).toBeLessThan(90)
    expect(result.data[8]).toBeGreaterThan(220)
    expect(result.data[11]).toBe(180)
  })

  it('preserves color differences in stamp pixels', () => {
    const result = enhanceDocumentRaster({
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([180, 70, 70, 255, 245, 245, 245, 255]),
    })

    expect(result.data[0] ?? 0).toBeGreaterThan(result.data[1] ?? 0)
    expect(result.data[0] ?? 0).toBeGreaterThan(result.data[2] ?? 0)
  })

  it('keeps a blank white page white', () => {
    const result = enhanceDocumentRaster({
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]),
    })

    expect(Array.from(result.data)).toEqual([255, 255, 255, 255, 255, 255, 255, 255])
  })

  it('rejects mismatched dimensions', () => {
    expect(() =>
      enhanceDocumentRaster({ width: 2, height: 2, data: new Uint8ClampedArray(4) }),
    ).toThrow(RangeError)
  })
})
