import { describe, expect, it } from 'vitest'
import { hasPdfSignature, isPdfFileName } from '@shared/document-file'

describe('document file validation', () => {
  it('accepts PDF file names case-insensitively', () => {
    expect(isPdfFileName('contract.pdf')).toBe(true)
    expect(isPdfFileName('SCAN.PDF')).toBe(true)
    expect(isPdfFileName('contract.docx')).toBe(false)
    expect(isPdfFileName('contract.pdf.exe')).toBe(false)
  })

  it('finds a PDF signature near the beginning of a file', () => {
    expect(hasPdfSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe(true)
    expect(hasPdfSignature(new Uint8Array([0, 0, 0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true)
    expect(hasPdfSignature(new Uint8Array([0x50, 0x44, 0x46]))).toBe(false)
  })
})
