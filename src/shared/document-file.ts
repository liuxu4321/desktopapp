const pdfSignature = [0x25, 0x50, 0x44, 0x46, 0x2d] as const

export function isPdfFileName(fileName: string): boolean {
  return fileName.trim().toLowerCase().endsWith('.pdf')
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  const lastStart = Math.min(bytes.length - pdfSignature.length, 1024 - pdfSignature.length)
  if (lastStart < 0) return false

  for (let start = 0; start <= lastStart; start += 1) {
    if (pdfSignature.every((byte, offset) => bytes[start + offset] === byte)) return true
  }
  return false
}
