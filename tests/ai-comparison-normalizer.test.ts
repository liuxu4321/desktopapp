import { describe, expect, it } from 'vitest'
import { normalizeAiComparisonPayload } from '../src/shared/ai-comparison-normalizer'
import { aiComparisonOutputSchema } from '../src/shared/schemas'

describe('AI comparison result normalization', () => {
  it('maps service-specific finding types to persisted categories', () => {
    const normalized = normalizeAiComparisonPayload({
      conclusion: '存在差异',
      summary: '服务内容发生变化。',
      findings: [
        {
          type: '服务内容差异',
          title: '服务范围缩减',
          detail: '待比对文书删除了现场培训服务。',
          candidatePage: '第4页',
          severity: '高风险',
          confidence: '96%',
        },
        {
          type: '验收条款缺少',
          title: '验收要求缺失',
          detail: '未包含标准文书中的验收时限。',
          candidatePage: 6,
          severity: '中',
          confidence: 0.88,
        },
      ],
    })

    const parsed = aiComparisonOutputSchema.parse(normalized)
    expect(parsed.conclusion).toBe('has_issue')
    expect(parsed.findings[0]).toMatchObject({
      type: '关键字段变化',
      candidatePage: 4,
      severity: 'high',
      confidence: 0.96,
    })
    expect(parsed.findings[1]?.type).toBe('条款缺失')
  })

  it('normalizes OCR and page-count aliases', () => {
    const normalized = normalizeAiComparisonPayload({
      conclusion: '待复核',
      summary: '扫描内容需要复核。',
      findings: [
        {
          type: '文字识别不清',
          title: '服务标准无法识别',
          detail: '扫描区域模糊。',
          severity: '一般',
          confidence: 68,
        },
        {
          type: '缺页问题',
          title: '附件页缺失',
          detail: '服务清单附件缺少一页。',
          severity: '严重',
          confidence: 0.99,
        },
      ],
    })

    const parsed = aiComparisonOutputSchema.parse(normalized)
    expect(parsed.conclusion).toBe('needs_review')
    expect(parsed.findings.map((finding) => finding.type)).toEqual(['OCR疑点', '页数不一致'])
  })
})
