function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function messageFrom(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined
  return typeof value.message === 'string' ? value.message : undefined
}

/** Prefer the message returned by H3 over the generic fetch status text. */
export function apiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (!isRecord(error)) return fallback
  const data = error.data
  const nestedMessage = messageFrom(data)
  const nestedStatus = isRecord(data) && typeof data.statusMessage === 'string' ? data.statusMessage : undefined
  const message = typeof error.message === 'string' ? error.message : undefined
  const status = typeof error.statusMessage === 'string' ? error.statusMessage : undefined
  return nestedMessage ?? nestedStatus ?? message ?? status ?? fallback
}

export function useLoadError(error: Readonly<Ref<unknown>>) {
  return computed(() => (error.value ? { message: apiErrorMessage(error.value) } : null))
}
