import { unbox } from '../internal/kind.ts'
import { assertNotHugeSparse } from '../internal/sparse.ts'
import { Ancestors, guardDepth } from '../internal/walk.ts'

/**
 * The value JSON writes for `holder[key]`: through `toJSON`, then unboxed. JSON unboxes numbers,
 * strings, booleans and bigints but writes a boxed symbol as an object.
 */
function jsonValue(holder: Record<PropertyKey, unknown>, key: string): unknown {
  let value = holder[key]
  if (
    (typeof value === 'object' && value !== null) ||
    typeof value === 'function' ||
    typeof value === 'bigint'
  ) {
    const toJSON = (value as { toJSON?: unknown }).toJSON
    if (typeof toJSON === 'function') value = toJSON.call(value, key)
  }
  if (typeof value !== 'object' || value === null) return value
  const primitive = unbox(value)
  return typeof primitive === 'symbol' ? value : primitive
}

function write(value: unknown, path: Ancestors, out: string[]): boolean {
  switch (typeof value) {
    case 'string':
      out.push(JSON.stringify(value))
      return true
    case 'number':
      out.push(Number.isFinite(value) ? String(value) : 'null')
      return true
    case 'boolean':
      out.push(value ? 'true' : 'false')
      return true
    case 'bigint':
      throw new TypeError('stableStringify cannot serialize a bigint')
    case 'object':
      if (value === null) {
        out.push('null')
        return true
      }
      break
    default:
      return false
  }
  if (path.has(value)) throw new TypeError('stableStringify cannot serialize a cyclic structure')
  path.enter(value)
  try {
    if (Array.isArray(value)) {
      assertNotHugeSparse(value)
      const length = value.length
      out.push('[')
      for (let i = 0; i < length; i++) {
        if (i > 0) out.push(',')
        if (
          !write(jsonValue(value as unknown as Record<PropertyKey, unknown>, String(i)), path, out)
        ) {
          out.push('null')
        }
      }
      out.push(']')
      return true
    }
    const record = value as Record<PropertyKey, unknown>
    out.push('{')
    let first = true
    for (const key of Object.keys(record).sort()) {
      const mark = out.length
      out.push(first ? '' : ',', JSON.stringify(key), ':')
      if (write(jsonValue(record, key), path, out)) first = false
      else out.length = mark
    }
    out.push('}')
    return true
  } finally {
    path.leave(value)
  }
}

/**
 * `JSON.stringify` with every object's keys sorted, so equal data always gives the same text (for
 * cache keys, signatures and snapshots). It follows `JSON.stringify` otherwise. A value's own or
 * inherited `toJSON` is called with its key, as JSON's contract has it, so Dates write their ISO
 * string and types such as `Decimal` write their JSON form. Boxed primitives unbox, `undefined`,
 * functions and symbols are dropped from objects and become `null` in arrays, and non-finite
 * numbers become `null`. A cycle or a bigint throws `TypeError`, nesting past 1000 levels throws
 * `RangeError`, and so does a huge sparse array. As in JSON, a `Map`, a `Set` or a class instance
 * without `toJSON` writes only its own enumerable keys, often `'{}'`, so equal text does not imply
 * equal data for those kinds.
 * @param value Any value.
 * @returns The JSON text, or `undefined` for a value JSON cannot write (`undefined`, a function, a
 * symbol).
 * @example
 * ```ts
 * stableStringify({ b: 1, a: [true, { d: 2, c: 3 }] }) // '{"a":[true,{"c":3,"d":2}],"b":1}'
 * ```
 */
export function stableStringify(value: unknown): string | undefined {
  const out: string[] = []
  const ok = guardDepth(() => write(jsonValue({ '': value }, ''), new Ancestors(), out))
  return ok ? out.join('') : undefined
}
