import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { dialog } from 'electron'
import type { BrowserWindow, OpenDialogOptions } from 'electron'
import { getDocumentDatabase, getDocumentDataDirectory } from './document-store'
import type { DocumentImportRole, DocumentKind, ImportedDocument } from '@shared/types'

interface PdfInspection {
  pageCount: number
  kind: DocumentKind
}

export async function importDocumentFromDialog(
  parentWindow: BrowserWindow | null,
  role: DocumentImportRole,
): Promise<ImportedDocument | null> {
  const options: OpenDialogOptions = {
    filters: [{ name: 'PDF documents', extensions: ['pdf'] }],
    properties: ['openFile'],
    securityScopedBookmarks: false,
  }
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null

  const sourcePath = result.filePaths[0]
  if (!sourcePath || extname(sourcePath).toLocaleLowerCase() !== '.pdf') return null

  const id = createDocumentId(role)
  const importedAt = new Date().toISOString()
  const storageKey = join(role, id, 'original.pdf')
  const taskDirectory = join(getDocumentDataDirectory(), role, id)
  const storedPath = join(taskDirectory, 'original.pdf')
  let persisted = false

  try {
    await mkdir(taskDirectory, { recursive: true })
    await copyFile(sourcePath, storedPath)

    const [fileStat, pdfBuffer] = await Promise.all([stat(storedPath), readFile(storedPath)])
    const inspection = inspectPdf(pdfBuffer)

    const compareStatus = role === 'candidate' ? '待比对' : undefined
    getDocumentDatabase().createDocument({
      id,
      role,
      name: basename(sourcePath),
      storageKey,
      size: fileStat.size,
      pageCount: inspection.pageCount,
      kind: inspection.kind,
      ...(compareStatus ? { compareStatus } : {}),
      importedAt,
    })
    persisted = true

    return {
      id,
      role,
      name: basename(sourcePath),
      size: fileStat.size,
      pageCount: inspection.pageCount,
      kind: inspection.kind,
      status: 'imported',
      ...(compareStatus ? { compareStatus } : {}),
      importedAt,
      updatedAt: importedAt,
      previewUrl: createPdfDataUrl(pdfBuffer),
    }
  } catch (error) {
    if (persisted) getDocumentDatabase().deleteDocument(id)
    await rm(taskDirectory, { force: true, recursive: true })
    throw error
  }
}

function createDocumentId(role: DocumentImportRole): string {
  const prefix = role === 'standard' ? 'STD' : 'DOC'
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`
}

function inspectPdf(buffer: Buffer): PdfInspection {
  const text = buffer.toString('latin1')
  const pageMatches = text.match(/\/Type\s*\/Page\b/g)
  const pageCount = Math.max(pageMatches?.length ?? 1, 1)
  const hasTextMarkers = /\/Font\b|BT\s|ET\s|\/ToUnicode\b/.test(text)
  const imageMatches = text.match(/\/Subtype\s*\/Image\b/g)
  const imageCount = imageMatches?.length ?? 0

  if (hasTextMarkers && imageCount > pageCount) {
    return { pageCount, kind: 'mixed-pdf' }
  }
  if (hasTextMarkers) {
    return { pageCount, kind: 'native-pdf' }
  }
  if (imageCount > 0) {
    return { pageCount, kind: 'scanned-pdf' }
  }
  return { pageCount, kind: 'unknown-pdf' }
}

function createPdfDataUrl(buffer: Buffer): string {
  return `data:application/pdf;base64,${buffer.toString('base64')}`
}
