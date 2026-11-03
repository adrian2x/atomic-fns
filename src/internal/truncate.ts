const MAX_ECHO = 40

function echoString(value: unknown): string {
  if (typeof value === 'bigint' || typeof value === 'symbol') {
    return JSON.stringify(String(value))
  }
  if (typeof value === 'undefined') {
    return JSON.stringify('undefined')
  }
  if (typeof value === 'function') {
    return JSON.stringify(String(value))
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return JSON.stringify(String(value))
  }
  try {
    return JSON.stringify(value)
  } catch {
    return JSON.stringify(Object.prototype.toString.call(value))
  }
}

/** Cut to at most `max` UTF-16 code units on a Unicode code-point boundary (no ellipsis). */
function cutToLimit(s: string, max: number): string {
  if (s.length <= max) return s
  let units = 0
  let end = 0
  for (const ch of s) {
    const next = units + ch.length
    if (next > max) break
    units = next
    end += ch.length
  }
  return s.slice(0, end)
}

/** Truncate a serialized form on a Unicode code-point boundary to at most `max` UTF-16 code units, then add `...`. */
function cutCodePoints(s: string, max: number): string {
  if (s.length <= max) return s
  return `${cutToLimit(s, max)}...`
}

/**
 * Serialize `value` for an error message and truncate to 40 code units plus `...`, on a
 * code-point boundary. Strings are cut to the limit first, then JSON.stringified (so a huge
 * string never pays full stringify cost). Other values keep stringify-then-cut. Values
 * JSON.stringify cannot represent (bigint, symbol, undefined, functions, non-finite numbers)
 * use `String(value)` quoted. Escapes control characters so messages never embed raw newlines
 * from caller input.
 */
export function truncateForError(value: unknown): string {
  if (typeof value === 'string') {
    const cut = cutToLimit(value, MAX_ECHO)
    const encoded = JSON.stringify(cut)
    return cut.length < value.length ? `${encoded}...` : encoded
  }
  return cutCodePoints(echoString(value), MAX_ECHO)
}
