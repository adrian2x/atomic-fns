/**
 * Short, bounded echoes of caller strings for error messages.
 */

/** UTF-16 units of caller input an error message repeats. */
const MAX_ECHO = 40

/**
 * `value` for an error message: its first {@link MAX_ECHO} UTF-16 code units, cut on a code point
 * boundary, then JSON-encoded, plus `...` when cut. Only the kept prefix is encoded, so a huge
 * string never pays a full encode. Encoding escapes control characters, so a message never embeds
 * a raw newline from caller input; an escape takes more than one unit of the result.
 */
export function truncateForError(value: string): string {
  if (value.length <= MAX_ECHO) return JSON.stringify(value)
  let end = 0
  for (const ch of value) {
    if (end + ch.length > MAX_ECHO) break
    end += ch.length
  }
  return `${JSON.stringify(value.slice(0, end))}...`
}
