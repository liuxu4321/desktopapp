import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { dialog } from 'electron'
import type { BrowserWindow, OpenDialogOptions } from 'electron'
import { getDocumentDatabase, getDocumentDataDirectory } from './document-store'
import { hasPdfSignature } from '@shared/document-file'
import type { DocumentImportRole, DocumentKind, ImportedDocument } from '@shared/types'

interface PdfInspection {
  pageCount: number
  kind: DocumentKind
}

export async function importDocumentFromDialog(
  parentWindow: BrowserWindow | null,
  role: DocumentImportRole,
): Promise<ImportedDocument[]> {
  const options: OpenDialogOptions = {
    filters: [{ name: 'PDF documents', extensions: ['pdf'] }],
    properties: ['openFile', 'multiSelections'],
    securityScopedBookmarks: false,
  }
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return []

  if (result.filePaths.some((filePath) => extname(filePath).toLowerCase() !== '.pdf')) {
    throw new Error('Only PDF documents can be imported.')
  }

  const importedDocuments: ImportedDocument[] = []
  try {
    for (const sourcePath of result.filePaths) {
      importedDocuments.push(await importPdfDocument(sourcePath, role))
    }
    return importedDocuments
  } catch (error) {
    await rollbackImportedDocuments(importedDocuments)
    throw error
  }
}

async function importPdfDocument(
  sourcePath: string,
  role: DocumentImportRole,
): Promise<ImportedDocument> {
  const [fileStat, pdfBuffer] = await Promise.all([stat(sourcePath), readFile(sourcePath)])
  if (!hasPdfSignature(pdfBuffer)) throw new Error('Only valid PDF documents can be imported.')

  const id = createDocumentId(role)
  const importedAt = new Date().toISOString()
  const storageKey = join(role, id, 'original.pdf')
  const taskDirectory = join(getDocumentDataDirectory(), role, id)
  const storedPath = join(taskDirectory, 'original.pdf')
  let persisted = false

  try {
    await mkdir(taskDirectory, { recursive: true })
    await copyFile(sourcePath, storedPath)

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

async function rollbackImportedDocuments(documents: ImportedDocument[]): Promise<void> {
  for (const document of documents) {
    try {
      getDocumentDatabase().deleteDocument(document.id)
      await rm(join(getDocumentDataDirectory(), document.role, document.id), {
        force: true,
        recursive: true,
      })
    } catch {
      // Keep the original import error; cleanup can be retried by deleting the record later.
    }
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
