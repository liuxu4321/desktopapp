import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DocumentDatabase } from '../src/main/services/document-database'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  )
})

describe('DocumentDatabase', () => {
  it('persists document and problem CRUD with cascade deletion', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'document-database-'))
    temporaryDirectories.push(directory)
    const database = new DocumentDatabase(join(directory, 'documents.sqlite'))

    const importedAt = '2026-08-19T08:00:00.000Z'
    database.createDocument({
      id: 'STD-TEST-1',
      role: 'standard',
      name: '标准文书.pdf',
      storageKey: 'standard/STD-TEST-1/original.pdf',
      size: 1024,
      pageCount: 2,
      kind: 'native-pdf',
      importedAt,
    })
    database.createDocument({
      id: 'DOC-TEST-1',
      role: 'candidate',
      name: '待比对文书.pdf',
      storageKey: 'candidate/DOC-TEST-1/original.pdf',
      size: 2048,
      pageCount: 3,
      kind: 'scanned-pdf',
      importedAt,
    })

    expect(database.listDocuments()).toHaveLength(2)
    expect(database.getDocument('DOC-TEST-1').compareStatus).toBe('待比对')

    const updated = database.updateDocument({
      id: 'DOC-TEST-1',
      name: '已重命名.pdf',
      compareStatus: '有问题',
    })
    expect(updated).toMatchObject({ name: '已重命名.pdf', compareStatus: '有问题' })

    database.replaceDocumentPages('DOC-TEST-1', [
      { page: 1, text: '第一条 合同目的', source: 'native' },
      { page: 2, text: '第二条 付款期限为45日', source: 'ocr', confidence: 0.92 },
    ])
    expect(database.getDocumentPages('DOC-TEST-1')).toEqual([
      { page: 1, text: '第一条 合同目的', source: 'native' },
      { page: 2, text: '第二条 付款期限为45日', source: 'ocr', confidence: 0.92 },
    ])

    const comparison = database.saveComparison({
      standardDocumentId: 'STD-TEST-1',
      candidateDocumentId: 'DOC-TEST-1',
      conclusion: 'has_issue',
      summary: '发现一项付款期限变化。',
      model: 'qwen-plus',
      findings: [
        {
          type: '关键字段变化',
          title: '付款期限变化',
          detail: '付款期限由30日调整为45日。',
          standardValue: '30日',
          candidateValue: '45日',
          standardPage: 2,
          candidatePage: 2,
          severity: 'high',
          confidence: 0.97,
        },
      ],
    })
    expect(database.getLatestComparison('STD-TEST-1', 'DOC-TEST-1')).toEqual(comparison)
    expect(database.getLatestCandidateComparison('DOC-TEST-1')).toEqual(comparison)
    expect(comparison.findings[0]).toMatchObject({
      title: '付款期限变化',
      candidateValue: '45日',
      candidatePage: 2,
    })

    const problem = database.createProblem({
      documentId: 'DOC-TEST-1',
      type: '关键字段变化',
      summary: '金额与标准文书不一致',
      page: 2,
      severity: 'high',
      confidence: 0.96,
    })
    expect(database.listProblems()).toEqual([problem])

    const revisedProblem = database.updateProblem({
      id: problem.id,
      summary: '合同金额与标准文书不一致',
      confidence: 0.98,
    })
    expect(revisedProblem).toMatchObject({
      summary: '合同金额与标准文书不一致',
      confidence: 0.98,
    })

    expect(database.deleteDocument('DOC-TEST-1')).toBe('candidate/DOC-TEST-1/original.pdf')
    expect(database.listProblems()).toEqual([])
    expect(database.getLatestComparison('STD-TEST-1', 'DOC-TEST-1')).toBeNull()
    expect(database.getLatestCandidateComparison('DOC-TEST-1')).toBeNull()
    expect(database.getDocumentPages('DOC-TEST-1')).toEqual([])
    expect(database.deleteProblem(problem.id)).toBe(false)

    database.close()
  })
})
