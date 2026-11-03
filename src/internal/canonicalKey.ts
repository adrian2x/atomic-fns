/**
 * Stable structural key for Heap tie-breaking. Distinct encodings for bigint, -0, NaN,
 * and undefined. Returns `undefined` for class instances, functions, symbols, and
 * non-plain collections (caller falls back to pairwise multiset matching).
 */

import { enterNesting, exitNesting, guardNesting } from './nesting.js'

function isPlainObject(x: object): boolean {
  const proto: unknown = Object.getPrototypeOf(x)
  return proto === Object.prototype || proto === null
}

function canonicalKeyInner(value: unknown): string | undefined {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  const t = typeof value
  if (t === 'boolean') return value === true ? 'b:true' : 'b:false'
  if (t === 'string') return `s:${JSON.stringify(value)}`
  if (t === 'number') {
    if (Object.is(value, -0)) return 'n:-0'
    if (Number.isNaN(value)) return 'n:NaN'
    return `n:${(value as number).toString()}`
  }
  if (t === 'bigint') return `bi:${(value as bigint).toString()}`
  if (t === 'symbol' || t === 'function') return undefined
  if (t !== 'object') return undefined

  if (Array.isArray(value)) {
    enterNesting()
    try {
      const parts: string[] = []
      for (const el of value) {
        const k = canonicalKeyInner(el)
        if (k === undefined) return undefined
        parts.push(k)
      }
      return `[${parts.join(',')}]`
    } finally {
      exitNesting()
    }
  }

  if (!isPlainObject(value)) return undefined

  enterNesting()
  try {
    const keys = Object.keys(value).toSorted()
    const parts: string[] = []
    for (const key of keys) {
      const k = canonicalKeyInner((value as Record<string, unknown>)[key])
      if (k === undefined) return undefined
      parts.push(`${JSON.stringify(key)}:${k}`)
    }
    return `{${parts.join(',')}}`
  } finally {
    exitNesting()
  }
}

/** Canonical structural key, or `undefined` when the value is not JSON-like. */
export function canonicalKey(value: unknown): string | undefined {
  return guardNesting(() => canonicalKeyInner(value))
}
