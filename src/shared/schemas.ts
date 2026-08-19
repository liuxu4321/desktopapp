import { z } from 'zod'

export const themePreferenceSchema = z.enum(['light', 'dark', 'system'])
export const releaseChannelSchema = z.enum(['stable', 'beta'])

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
