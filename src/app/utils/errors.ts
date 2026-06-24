import type { EnvelopePayloadDto } from '../domain/contracts'

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export const getPayloadError = (payload: EnvelopePayloadDto): string | null => {
  const rawError = payload.error
  if (typeof rawError !== 'object' || rawError === null || Array.isArray(rawError)) {
    return null
  }

  const message = (rawError as Record<string, unknown>).message
  return typeof message === 'string' ? message : null
}
