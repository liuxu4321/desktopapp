import { z } from 'zod'

export const themePreferenceSchema = z.enum(['light', 'dark', 'system'])
export const releaseChannelSchema = z.enum(['stable', 'beta'])
export const documentImportRoleSchema = z.enum(['standard', 'candidate'])
export const documentCompareStatusSchema = z.enum(['待比对', '比对中', '待查看', '有问题'])
export const documentProblemTypeSchema = z.enum([
  'OCR疑点',
  '关键字段变化',
  '页数不一致',
  '条款缺失',
])
export const documentProblemSeveritySchema = z.enum(['high', 'medium', 'low'])
export const documentIdSchema = z.string().regex(/^(STD|DOC)-[A-Z0-9-]+$/)
export const documentProblemIdSchema = z.string().regex(/^PRB-[A-Z0-9-]+$/)
export const aiComparisonConclusionSchema = z.enum(['no_issue', 'has_issue', 'needs_review'])

export const updateDocumentSchema = z
  .object({
    id: documentIdSchema,
    name: z.string().trim().min(1).max(255).optional(),
    compareStatus: documentCompareStatusSchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.compareStatus !== undefined, {
    message: 'At least one document field must be updated.',
  })

export const createDocumentProblemSchema = z.object({
  documentId: documentIdSchema,
  type: documentProblemTypeSchema,
  summary: z.string().trim().min(1).max(2000),
  page: z.number().int().positive(),
  severity: documentProblemSeveritySchema,
  confidence: z.number().min(0).max(1),
})

export const updateDocumentProblemSchema = z
  .object({
    id: documentProblemIdSchema,
    type: documentProblemTypeSchema.optional(),
    summary: z.string().trim().min(1).max(2000).optional(),
    page: z.number().int().positive().optional(),
    severity: documentProblemSeveritySchema.optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .refine(
    (value) =>
      value.type !== undefined ||
      value.summary !== undefined ||
      value.page !== undefined ||
      value.severity !== undefined ||
      value.confidence !== undefined,
    { message: 'At least one problem field must be updated.' },
  )

export const updateAiProviderSettingsSchema = z.object({
  apiKey: z.string().trim().min(8).max(512).optional(),
  clearApiKey: z.boolean().optional(),
  baseUrl: z
    .string()
    .url()
    .startsWith('https://')
    .max(500)
    .refine((value) => {
      const hostname = new URL(value).hostname
      return (
        hostname === 'dashscope.aliyuncs.com' ||
        hostname === 'dashscope-intl.aliyuncs.com' ||
        hostname === 'dashscope-us.aliyuncs.com' ||
        hostname.endsWith('.maas.aliyuncs.com')
      )
    }, 'Only Alibaba Cloud DashScope endpoints are allowed.'),
  compareModel: z.string().trim().min(1).max(100),
  ocrModel: z.string().trim().min(1).max(100),
})

export const compareDocumentsSchema = z
  .object({
    standardDocumentId: documentIdSchema,
    candidateDocumentId: documentIdSchema,
  })
  .refine((value) => value.standardDocumentId.startsWith('STD-'), {
    message: 'The standard document ID must use the STD prefix.',
  })
  .refine((value) => value.candidateDocumentId.startsWith('DOC-'), {
    message: 'The candidate document ID must use the DOC prefix.',
  })

export const aiComparisonFindingOutputSchema = z.object({
  type: documentProblemTypeSchema,
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().min(1).max(2000),
  standardValue: z.string().trim().max(1000).nullable().optional(),
  candidateValue: z.string().trim().max(1000).nullable().optional(),
  standardPage: z.number().int().positive().nullable().optional(),
  candidatePage: z.number().int().positive().nullable().optional(),
  severity: documentProblemSeveritySchema,
  confidence: z.number().min(0).max(1),
})

export const aiComparisonOutputSchema = z
  .object({
    conclusion: aiComparisonConclusionSchema,
    summary: z.string().trim().min(1).max(2000),
    findings: z.array(aiComparisonFindingOutputSchema).max(100),
  })
  .refine((value) => value.conclusion !== 'no_issue' || value.findings.length === 0, {
    message: 'A no_issue conclusion cannot contain findings.',
  })

export const appConfigSchema = z.object({
  theme: themePreferenceSchema.default('system'),
  releaseChannel: releaseChannelSchema.default('stable'),
})

export const externalUrlSchema = z
  .string()
  .url()
  .refine((value) => ['https:', 'mailto:'].includes(new URL(value).protocol), {
    message: 'Only https and mailto URLs can be opened externally.',
  })

export const updateStatusSchema = z.enum([
  'idle',
  'checking',
  'available',
  'not-available',
  'downloading',
  'downloaded',
  'error',
])

export const updateProgressSchema = z.object({
  percent: z.number().min(0).max(100),
  transferred: z.number().nonnegative(),
  total: z.number().nonnegative(),
  bytesPerSecond: z.number().nonnegative(),
})

export const updateStateSchema = z.object({
  status: updateStatusSchema,
  channel: releaseChannelSchema,
  message: z.string().min(1),
  version: z.string().optional(),
  progress: updateProgressSchema.optional(),
  error: z.string().optional(),
})

export const windowBoundsSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().int().min(640),
  height: z.number().int().min(480),
})
