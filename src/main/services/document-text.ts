import { readFile } from 'node:fs/promises'
import { createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { recognizeDocumentPage } from './dashscope-client'
import { getDocumentDatabase, getDocumentFilePath } from './document-store'
import type { DocumentTextPage } from '@shared/types'

const MIN_NATIVE_TEXT_LENGTH = 20
const MAX_OCR_PAGES = 50

export interface DocumentTextProgress {
  stage: 'extracting' | 'ocr'
  message: string
  page: number
  totalPages: number
  textPreview?: string
}

export async function getOrExtractDocumentText(
  documentId: string,
  reportProgress?: (progress: DocumentTextProgress) => void,
): Promise<DocumentTextPage[]> {
  const database = getDocumentDatabase()
  const documentRecord = database.getDocument(documentId)
  const cached = database.getDocumentPages(documentId)
  if (cached.length === documentRecord.pageCount && cached.every((page) => page.text.trim())) {
    for (const page of cached) {
      reportProgress?.({
        stage: page.source === 'ocr' ? 'ocr' : 'extracting',
        message:
          page.source === 'ocr'
            ? `第 ${page.page} 页 OCR 缓存已读取`
            : `第 ${page.page} 页文本层已读取`,
        page: page.page,
        totalPages: documentRecord.pageCount,
        textPreview: createTextPreview(page.text),
      })
    }
    return cached
  }

  const pdfBuffer = await readFile(getDocumentFilePath(documentId))
  const loadingTask = getDocument({ data: new Uint8Array(pdfBuffer), useSystemFonts: true })
  const pdf = await loadingTask.promise
  const pages: DocumentTextPage[] = []
  let ocrPageCount = 0

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const nativeText = extractTextItems(textContent.items)
      if (nativeText.replace(/\s/g, '').length >= MIN_NATIVE_TEXT_LENGTH) {
        pages.push({ page: pageNumber, text: nativeText, source: 'native' })
        reportProgress?.({
          stage: 'extracting',
          message: `第 ${pageNumber} 页文本提取完成`,
          page: pageNumber,
          totalPages: pdf.numPages,
          textPreview: createTextPreview(nativeText),
        })
        continue
      }

      ocrPageCount += 1
      if (ocrPageCount > MAX_OCR_PAGES) {
        throw new Error(`扫描页超过 ${MAX_OCR_PAGES} 页，请拆分文书后再进行 AI 比对。`)
      }
      reportProgress?.({
        stage: 'ocr',
        message: `正在识别第 ${pageNumber} 页扫描内容`,
        page: pageNumber,
        totalPages: pdf.numPages,
      })
      const viewport = page.getViewport({ scale: 2 })
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      await page.render({
        canvas,
        canvasContext: canvas.getContext('2d'),
        viewport,
      }).promise
      const imageDataUrl = `data:image/jpeg;base64,${canvas.toBuffer('image/jpeg', 85).toString('base64')}`
      const ocrText = await recognizeDocumentPage(imageDataUrl)
      pages.push({ page: pageNumber, text: ocrText, source: 'ocr' })
      reportProgress?.({
        stage: 'ocr',
        message: `第 ${pageNumber} 页 OCR 识别完成`,
        page: pageNumber,
        totalPages: pdf.numPages,
        textPreview: createTextPreview(ocrText),
      })
    }
  } finally {
    await pdf.destroy()
  }

  database.replaceDocumentPages(documentId, pages)
  return pages
}

function createTextPreview(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > 600 ? `${normalized.slice(0, 600)}...` : normalized
}

function extractTextItems(items: unknown[]): string {
  const parts: string[] = []
  for (const item of items) {
    if (!isRecord(item) || typeof item.str !== 'string') continue
    parts.push(item.str)
    if (item.hasEOL === true) parts.push('\n')
    else parts.push(' ')
  }
  return parts
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
