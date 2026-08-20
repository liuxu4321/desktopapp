import { aiComparisonOutputSchema } from '@shared/schemas'
import { normalizeAiComparisonPayload } from '@shared/ai-comparison-normalizer'
import { getAiProviderSettings, getDashScopeApiKey } from './config'

export interface DashScopeComparisonOutput {
  conclusion: 'no_issue' | 'has_issue' | 'needs_review'
  summary: string
  findings: Array<{
    type: 'OCR疑点' | '关键字段变化' | '页数不一致' | '条款缺失'
    title: string
    detail: string
    standardValue?: string
    candidateValue?: string
    standardPage?: number
    candidatePage?: number
    severity: 'high' | 'medium' | 'low'
    confidence: number
  }>
}

export async function recognizeDocumentPage(imageDataUrl: string): Promise<string> {
  const settings = getAiProviderSettings()
  const payload = await requestDashScope('/responses', {
    model: settings.ocrModel,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_image', image_url: imageDataUrl },
          {
            type: 'input_text',
            text: '请完整识别这一页文书中的全部文字，保持标题、段落和条款编号顺序。不要总结，不要解释；无法确认的字符使用 [?] 标记。',
          },
        ],
      },
    ],
    ocr_options: { task: 'document_parsing' },
  })
  const text = readOcrText(payload).trim()
  if (!text) throw new Error('DashScope OCR 未返回可用文字。')
  return text
}

export async function requestStructuredComparison(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ model: string; output: DashScopeComparisonOutput }> {
  const settings = getAiProviderSettings()
  const payload = await requestDashScope('/chat/completions', {
    model: settings.compareModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })
  const content = readChatContent(payload)
  const normalized = normalizeAiComparisonPayload(parseJsonObject(content))
  const parsedResult = aiComparisonOutputSchema.safeParse(normalized)
  if (!parsedResult.success) {
    throw new Error('大模型返回的结构化结果不完整，请重新分析。')
  }
  const parsed = parsedResult.data
  return {
    model: settings.compareModel,
    output: {
      conclusion: parsed.conclusion,
      summary: parsed.summary,
      findings: parsed.findings.map((finding) => ({
        type: finding.type,
        title: finding.title,
        detail: finding.detail,
        severity: finding.severity,
        confidence: finding.confidence,
        ...(typeof finding.standardValue === 'string'
          ? { standardValue: finding.standardValue }
          : {}),
        ...(typeof finding.candidateValue === 'string'
          ? { candidateValue: finding.candidateValue }
          : {}),
        ...(typeof finding.standardPage === 'number' ? { standardPage: finding.standardPage } : {}),
        ...(typeof finding.candidatePage === 'number'
          ? { candidatePage: finding.candidatePage }
          : {}),
      })),
    },
  }
}

async function requestDashScope(path: string, body: unknown): Promise<unknown> {
  const settings = getAiProviderSettings()
  const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getDashScopeApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  })
  const responseText = await response.text()
  if (!response.ok) {
    throw new Error(`DashScope 请求失败（${response.status}）：${readRemoteError(responseText)}`)
  }
  try {
    return JSON.parse(responseText) as unknown
  } catch {
    throw new Error('DashScope 返回了无法解析的响应。')
  }
}

function readChatContent(payload: unknown): string {
  if (!isRecord(payload)) throw new Error('DashScope 比对响应格式无效。')
  const choices = payload.choices
  if (!Array.isArray(choices) || !isRecord(choices[0])) {
    throw new Error('DashScope 比对响应缺少结果。')
  }
  const message = choices[0].message
  if (!isRecord(message) || typeof message.content !== 'string') {
    throw new Error('DashScope 比对响应缺少结构化内容。')
  }
  return message.content
}

function readOcrText(payload: unknown): string {
  if (!isRecord(payload)) return ''
  if (typeof payload.output_text === 'string') return payload.output_text
  if (!Array.isArray(payload.output)) return ''
  const parts: string[] = []
  for (const output of payload.output) {
    if (!isRecord(output) || !Array.isArray(output.content)) continue
    for (const content of output.content) {
      if (!isRecord(content)) continue
      if (typeof content.ocr_result === 'string') parts.push(content.ocr_result)
      else if (typeof content.text === 'string') parts.push(content.text)
    }
  }
  return parts.join('\n')
}

function parseJsonObject(value: string): unknown {
  const withoutFence = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = withoutFence.indexOf('{')
  const end = withoutFence.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('大模型未返回 JSON 对象。')
  try {
    return JSON.parse(withoutFence.slice(start, end + 1)) as unknown
  } catch {
    throw new Error('大模型返回的 JSON 格式无效。')
  }
}

function readRemoteError(value: string): string {
  try {
    const parsed = JSON.parse(value) as unknown
    if (isRecord(parsed) && isRecord(parsed.error) && typeof parsed.error.message === 'string') {
      return parsed.error.message.slice(0, 300)
    }
  } catch {
    // Fall through to the sanitized response text.
  }
  return value.replace(/\s+/g, ' ').slice(0, 300) || '未知错误'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
