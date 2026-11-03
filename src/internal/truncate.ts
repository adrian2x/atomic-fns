const MAX_ECHO = 40

/**
 * JSON-serialize `value` for an error message and truncate to 40 characters plus `...`.
 * Escapes control characters so messages never embed raw newlines from caller input.
 */
export function truncateForError(value: unknown): string {
  const s = value === undefined ? 'undefined' : JSON.stringify(value)
  return s.length > MAX_ECHO ? `${s.slice(0, MAX_ECHO)}...` : s
}
