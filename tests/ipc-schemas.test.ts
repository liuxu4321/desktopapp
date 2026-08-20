import { describe, expect, it } from 'vitest'
import { ipcChannels } from '@shared/ipc'
import {
  appConfigSchema,
  aiComparisonOutputSchema,
  createComparisonBatchSchema,
  createDocumentProblemSchema,
  documentIdSchema,
  externalUrlSchema,
  themePreferenceSchema,
  updateDocumentSchema,
  updateAiProviderSettingsSchema,
} from '@shared/schemas'

describe('IPC contracts and schemas', () => {
  it('keeps IPC channel strings centralized', () => {
    expect(new Set(Object.values(ipcChannels)).size).toBe(Object.values(ipcChannels).length)
    expect(ipcChannels.updaterCheck).toBe('updater:check')
  })

  it('accepts only supported theme values', () => {
    expect(themePreferenceSchema.parse('dark')).toBe('dark')
    expect(() => themePreferenceSchema.parse('blue')).toThrow()
  })

  it('applies safe config defaults', () => {
    expect(appConfigSchema.parse({})).toEqual({ theme: 'system', releaseChannel: 'stable' })
  })

  it('allows only approved external protocols', () => {
    expect(externalUrlSchema.parse('https://example.com')).toBe('https://example.com')
    expect(externalUrlSchema.parse('mailto:support@example.com')).toBe('mailto:support@example.com')
    expect(() => externalUrlSchema.parse('file:///etc/passwd')).toThrow()
    expect(() => externalUrlSchema.parse('javascript:alert(1)')).toThrow()
  })

  it('validates document mutations at the IPC boundary', () => {
    expect(documentIdSchema.parse('DOC-TEST-1')).toBe('DOC-TEST-1')
    expect(() => documentIdSchema.parse('../documents.sqlite')).toThrow()
    expect(() => updateDocumentSchema.parse({ id: 'DOC-TEST-1' })).toThrow()
    expect(() =>
      createDocumentProblemSchema.parse({
        documentId: 'DOC-TEST-1',
        type: 'OCR疑点',
        summary: '文字识别置信度偏低',
        page: 1,
        severity: 'medium',
        confidence: 1.2,
      }),
    ).toThrow()
  })

  it('validates unique candidate IDs for a comparison batch', () => {
    expect(
      createComparisonBatchSchema.parse({
        standardDocumentId: 'STD-TEST-1',
        candidateDocumentIds: ['DOC-TEST-1', 'DOC-TEST-2'],
      }).candidateDocumentIds,
    ).toHaveLength(2)
    expect(() =>
      createComparisonBatchSchema.parse({
        standardDocumentId: 'STD-TEST-1',
        candidateDocumentIds: ['DOC-TEST-1', 'DOC-TEST-1'],
      }),
    ).toThrow()
    expect(() =>
      createComparisonBatchSchema.parse({
        standardDocumentId: 'DOC-WRONG-ROLE',
        candidateDocumentIds: ['DOC-TEST-1'],
      }),
    ).toThrow()
  })

  it('restricts AI settings and validates structured comparison output', () => {
    expect(
      updateAiProviderSettingsSchema.parse({
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        compareModel: 'qwen-plus',
        ocrModel: 'qwen3.5-ocr',
      }).compareModel,
    ).toBe('qwen-plus')
    expect(() =>
      updateAiProviderSettingsSchema.parse({
        baseUrl: 'https://example.com/v1',
        compareModel: 'qwen-plus',
        ocrModel: 'qwen3.5-ocr',
      }),
    ).toThrow()
    expect(
      aiComparisonOutputSchema.parse({
        conclusion: 'has_issue',
        summary: '发现一项差异。',
        findings: [
          {
            type: '关键字段变化',
            title: '付款期限变化',
            detail: '由30日调整为45日。',
            standardValue: null,
            candidatePage: 3,
            severity: 'high',
            confidence: 0.95,
          },
        ],
      }).findings,
    ).toHaveLength(1)
    expect(() =>
      aiComparisonOutputSchema.parse({
        conclusion: 'no_issue',
        summary: '没有问题。',
        findings: [
          {
            type: '关键字段变化',
            title: '不应存在',
            detail: '无问题结论不能包含差异项。',
            severity: 'low',
            confidence: 0.8,
          },
        ],
      }),
    ).toThrow()
  })
})
