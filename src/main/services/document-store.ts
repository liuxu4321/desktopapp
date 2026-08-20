import { mkdirSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { app } from 'electron'
import { DocumentDatabase } from './document-database'
import type {
  CreateDocumentProblemInput,
  DocumentProblemRecord,
  DocumentRecord,
  UpdateDocumentInput,
  UpdateDocumentProblemInput,
} from '@shared/types'

let database: DocumentDatabase | null = null

export function getDocumentDatabase(): DocumentDatabase {
  if (database) return database
  const dataDirectory = getDocumentDataDirectory()
  mkdirSync(dataDirectory, { recursive: true })
  database = new DocumentDatabase(join(dataDirectory, 'documents.sqlite'))
  return database
}

export function closeDocumentDatabase(): void {
  database?.close()
  database = null
}

export function listDocuments(): DocumentRecord[] {
  return getDocumentDatabase().listDocuments()
}

export async function getDocumentPreview(id: string): Promise<string> {
  const storedPath = getDocumentFilePath(id)
  const buffer = await readFile(storedPath)
  return `data:application/pdf;base64,${buffer.toString('base64')}`
}

export function getDocumentFilePath(id: string): string {
  return resolveStorageKey(getDocumentDatabase().getDocumentStorageKey(id))
}

export function updateDocument(input: UpdateDocumentInput): DocumentRecord {
  return getDocumentDatabase().updateDocument(input)
}

export async function deleteDocument(id: string): Promise<boolean> {
  const storageKey = getDocumentDatabase().deleteDocument(id)
  if (!storageKey) return false
  const storedPath = resolveStorageKey(storageKey)
  await rm(dirname(storedPath), { force: true, recursive: true })
  return true
}

export function listDocumentProblems(): DocumentProblemRecord[] {
  return getDocumentDatabase().listProblems()
}

export function createDocumentProblem(input: CreateDocumentProblemInput): DocumentProblemRecord {
  return getDocumentDatabase().createProblem(input)
}

export function updateDocumentProblem(input: UpdateDocumentProblemInput): DocumentProblemRecord {
  return getDocumentDatabase().updateProblem(input)
}

export function deleteDocumentProblem(id: string): boolean {
  return getDocumentDatabase().deleteProblem(id)
}

export function getDocumentDataDirectory(): string {
  return join(app.getPath('userData'), 'document-compare')
}

export function resolveStorageKey(storageKey: string): string {
  const root = resolve(getDocumentDataDirectory())
  const storedPath = resolve(root, storageKey)
  const pathFromRoot = relative(root, storedPath)
  if (pathFromRoot.startsWith('..') || pathFromRoot === '') {
    throw new Error('Invalid document storage path.')
  }
  return storedPath
}
