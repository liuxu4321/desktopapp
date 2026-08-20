const supportedFindingTypes = ['OCR疑点', '关键字段变化', '页数不一致', '条款缺失'] as const

export function normalizeAiComparisonPayload(value: unknown): unknown {
  if (!isRecord(value)) return value
  const findings = Array.isArray(value.findings)
    ? value.findings.map(normalizeFinding).filter((finding) => finding !== null)
    : value.findings
  return {
    ...value,
    conclusion: normalizeConclusion(value.conclusion),
    findings,
  }
}

function normalizeFinding(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null
  return {
    ...value,
    type: normalizeFindingType(value.type),
    severity: normalizeSeverity(value.severity),
    confidence: normalizeConfidence(value.confidence),
    standardPage: normalizePage(value.standardPage),
    candidatePage: normalizePage(value.candidatePage),
  }
}

function normalizeFindingType(value: unknown): (typeof supportedFindingTypes)[number] {
  if (typeof value === 'string' && supportedFindingTypes.includes(value as never)) {
    return value as (typeof supportedFindingTypes)[number]
  }
  const text = typeof value === 'string' ? value.toLocaleLowerCase() : ''
  if (/ocr|识别|模糊|不清/.test(text)) return 'OCR疑点'
  if (/页数|缺页|页面|页码/.test(text)) return '页数不一致'
  if (/缺失|缺少|遗漏|删除|未包含|条款/.test(text)) return '条款缺失'
  return '关键字段变化'
}

function normalizeSeverity(value: unknown): unknown {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  if (typeof value !== 'string') return value
  if (/高|严重|重大/.test(value)) return 'high'
  if (/低|轻微|提示/.test(value)) return 'low'
  if (/中|一般|注意/.test(value)) return 'medium'
  return value
}

function normalizeConclusion(value: unknown): unknown {
  if (value === 'no_issue' || value === 'has_issue' || value === 'needs_review') return value
  if (typeof value !== 'string') return value
  if (/无问题|没有问题|一致|通过/.test(value)) return 'no_issue'
  if (/待复核|需复核|不确定|无法确认/.test(value)) return 'needs_review'
  if (/有问题|存在差异|异常|风险/.test(value)) return 'has_issue'
  return value
}

function normalizeConfidence(value: unknown): unknown {
  if (typeof value === 'number') return value > 1 && value <= 100 ? value / 100 : value
  if (typeof value !== 'string') return value
  const parsed = Number.parseFloat(value.replace('%', ''))
  if (!Number.isFinite(parsed)) return value
  return value.includes('%') || parsed > 1 ? parsed / 100 : parsed
}

function normalizePage(value: unknown): unknown {
  if (value === null || value === undefined || typeof value === 'number') return value
  if (typeof value !== 'string') return value
  const match = value.match(/\d+/)
  return match ? Number(match[0]) : value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
