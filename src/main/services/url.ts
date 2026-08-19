import { externalUrlSchema } from '@shared/schemas'

export function assertAllowedExternalUrl(url: string): string {
  return externalUrlSchema.parse(url)
}
