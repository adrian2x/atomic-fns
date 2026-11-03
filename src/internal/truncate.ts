const MAX_ECHO = 40

/** Append to `out` until `limit` UTF-16 units; returns whether the limit was hit. */
function appendCapped(out: { s: string; n: number }, chunk: string, limit: number): boolean {
  const room = limit - out.n
  if (room <= 0) return true
  if (chunk.length <= room) {
    out.s += chunk
    out.n += chunk.length
    return false
  }
  let units = 0
  let end = 0
  for (const ch of chunk) {
    const next = units + ch.length
    if (next > room) break
    units = next
    end += ch.length
  }
  out.s += chunk.slice(0, end)
  out.n += units
  return true
}

/**
 * Serialize `value` like JSON.stringify into `out`, stopping once `limit` UTF-16 units are
 * written. Never builds a full unbounded string for large/DAG inputs.
 */
function writeEcho(
  value: unknown,
  out: { s: string; n: number },
  limit: number,
  stack: object[]
): boolean {
  if (typeof value === 'bigint' || typeof value === 'symbol') {
    return appendCapped(out, JSON.stringify(String(value)), limit)
  }
  if (typeof value === 'undefined') {
    return appendCapped(out, JSON.stringify('undefined'), limit)
  }
  if (typeof value === 'function') {
    return appendCapped(out, JSON.stringify(String(value)), limit)
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return appendCapped(out, JSON.stringify(String(value)), limit)
  }
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return appendCapped(out, JSON.stringify(value), limit)
  }
  if (value === null) {
    return appendCapped(out, 'null', limit)
  }
  if (typeof value !== 'object') {
    return appendCapped(out, JSON.stringify(Object.prototype.toString.call(value)), limit)
  }

  if (stack.includes(value)) {
    return appendCapped(out, JSON.stringify(Object.prototype.toString.call(value)), limit)
  }

  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    try {
      const mapped = (value as { toJSON: () => unknown }).toJSON()
      stack.push(value)
      const hit = writeEcho(mapped, out, limit, stack)
      stack.pop()
      return hit
    } catch {
      return appendCapped(out, JSON.stringify(Object.prototype.toString.call(value)), limit)
    }
  }

  if (Array.isArray(value)) {
    if (appendCapped(out, '[', limit)) return true
    stack.push(value)
    for (let i = 0; i < value.length; i++) {
      if (i > 0 && appendCapped(out, ',', limit)) {
        stack.pop()
        return true
      }
      if (writeEcho(value[i], out, limit, stack)) {
        stack.pop()
        return true
      }
    }
    stack.pop()
    return appendCapped(out, ']', limit)
  }

  if (appendCapped(out, '{', limit)) return true
  stack.push(value)
  let first = true
  for (const key of Object.keys(value)) {
    if (!first && appendCapped(out, ',', limit)) {
      stack.pop()
      return true
    }
    first = false
    if (appendCapped(out, JSON.stringify(key), limit)) {
      stack.pop()
      return true
    }
    if (appendCapped(out, ':', limit)) {
      stack.pop()
      return true
    }
    if (writeEcho((value as Record<string, unknown>)[key], out, limit, stack)) {
      stack.pop()
      return true
    }
  }
  stack.pop()
  return appendCapped(out, '}', limit)
}

function echoString(value: unknown): string {
  const out = { s: '', n: 0 }
  writeEcho(value, out, MAX_ECHO + 8, [])
  return out.s
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
 * string never pays full stringify cost). Other values are walked with a size-capped writer
 * that stops after the truncation limit (never builds the full JSON). Values JSON cannot
 * represent (bigint, symbol, undefined, functions, non-finite numbers) use `String(value)`
 * quoted. Escapes control characters so messages never embed raw newlines from caller input.
 */
export function truncateForError(value: unknown): string {
  if (typeof value === 'string') {
    const cut = cutToLimit(value, MAX_ECHO)
    const encoded = JSON.stringify(cut)
    return cut.length < value.length ? `${encoded}...` : encoded
  }
  return cutCodePoints(echoString(value), MAX_ECHO)
}
