export interface DocumentRaster {
  data: Uint8ClampedArray
  height: number
  width: number
}

const CHANNELS_PER_PIXEL = 4

export function enhanceDocumentRaster(source: DocumentRaster): DocumentRaster {
  const pixelCount = source.width * source.height
  if (pixelCount <= 0 || source.data.length !== pixelCount * CHANNELS_PER_PIXEL) {
    throw new RangeError('Invalid document raster dimensions.')
  }

  const result = new Uint8ClampedArray(source.data)
  const luminance = new Uint8ClampedArray(pixelCount)
  const histogram = new Uint32Array(256)

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * CHANNELS_PER_PIXEL
    const value = getLuminance(result[offset], result[offset + 1], result[offset + 2])
    luminance[pixel] = value
    histogram[value] = (histogram[value] ?? 0) + 1
  }

  const measuredLow = findPercentile(histogram, pixelCount, 0.01)
  const measuredHigh = findPercentile(histogram, pixelCount, 0.99)
  const padding = Math.max(64 - (measuredHigh - measuredLow), 0) / 2
  const low = Math.max(measuredLow - padding, 0)
  const high = Math.min(measuredHigh + padding, 255)
  const range = Math.max(high - low, 1)

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * CHANNELS_PER_PIXEL
    const originalLuminance = luminance[pixel] ?? 0
    const normalized = clamp((originalLuminance - low) / range, 0, 1)
    const adjustedLuminance = Math.round(Math.pow(normalized, 0.96) * 255)
    const delta = adjustedLuminance - originalLuminance

    result[offset] = clampByte((result[offset] ?? 0) + delta)
    result[offset + 1] = clampByte((result[offset + 1] ?? 0) + delta)
    result[offset + 2] = clampByte((result[offset + 2] ?? 0) + delta)
    luminance[pixel] = adjustedLuminance
  }

  sharpenLuminanceEdges(result, luminance, source.width, source.height)
  return { data: result, width: source.width, height: source.height }
}

function sharpenLuminanceEdges(
  data: Uint8ClampedArray,
  luminance: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const original = new Uint8ClampedArray(data)
  const amount = 0.42

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = y * width + x
      const average =
        ((luminance[pixel] ?? 0) * 4 +
          (luminance[pixel - 1] ?? 0) +
          (luminance[pixel + 1] ?? 0) +
          (luminance[pixel - width] ?? 0) +
          (luminance[pixel + width] ?? 0)) /
        8
      const edge = ((luminance[pixel] ?? 0) - average) * amount
      const offset = pixel * CHANNELS_PER_PIXEL

      data[offset] = clampByte((original[offset] ?? 0) + edge)
      data[offset + 1] = clampByte((original[offset + 1] ?? 0) + edge)
      data[offset + 2] = clampByte((original[offset + 2] ?? 0) + edge)
    }
  }
}

function getLuminance(red = 0, green = 0, blue = 0): number {
  return Math.round(red * 0.299 + green * 0.587 + blue * 0.114)
}

function findPercentile(histogram: Uint32Array, total: number, ratio: number): number {
  const target = Math.max(1, Math.ceil(total * ratio))
  let cumulative = 0
  for (let value = 0; value < histogram.length; value += 1) {
    cumulative += histogram[value] ?? 0
    if (cumulative >= target) return value
  }
  return 255
}

function clampByte(value: number): number {
  return Math.round(clamp(value, 0, 255))
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
