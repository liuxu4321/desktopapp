import { describe, expect, it } from 'vitest'
import { DOCUMENT_COMPARISON_SYSTEM_PROMPT } from '../src/shared/document-comparison-prompt'

describe('document comparison system prompt', () => {
  it('focuses on service content and ignores party and amount differences', () => {
    expect(DOCUMENT_COMPARISON_SYSTEM_PROMPT).toContain('完全忽略合同主体及身份信息')
    expect(DOCUMENT_COMPARISON_SYSTEM_PROMPT).toContain('完全忽略金额和结算类内容')
    expect(DOCUMENT_COMPARISON_SYSTEM_PROMPT).toContain('服务范围和项目边界')
    expect(DOCUMENT_COMPARISON_SYSTEM_PROMPT).toContain('属于付款结算内容，忽略')
    expect(DOCUMENT_COMPARISON_SYSTEM_PROMPT).toContain('"findings":[]')
    expect(DOCUMENT_COMPARISON_SYSTEM_PROMPT).toContain('OCR疑点')
    expect(DOCUMENT_COMPARISON_SYSTEM_PROMPT).toContain('"findings"')
  })
})
