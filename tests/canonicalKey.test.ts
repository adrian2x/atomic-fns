import { describe, expect, it } from 'vitest'
import { canonicalKey } from '../src/internal/canonicalKey.js'
import { deepEqual } from '../src/operators/index.js'

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, xs: readonly T[]): T {
  if (xs.length === 0) throw new RangeError('empty pick')
  const index = Math.floor(rng() * xs.length)
  for (const [i, v] of xs.entries()) {
    if (i === index) return v
  }
  return xs[0]
}

function genValue(rng: () => number, depth: number): unknown {
  if (depth <= 0 || rng() < 0.35) {
    return pick(rng, [
      null,
      undefined,
      true,
      false,
      0,
      -0,
      NaN,
      1,
      -2.5,
      42n,
      -7n,
      '',
      'a',
      'hello',
      new Date(0),
      new Date(1_700_000_000_000),
      /abc/gi,
      /x/,
      new Number(1),
      new String('z'),
      new Boolean(true),
      new Uint8Array([1, 2, 3]),
      new Int16Array([9, 8]),
      new ArrayBuffer(4),
      new Map([[1, 'a']]),
      new Map([['k', 2]]),
      new Set([1, 2, 3]),
      new Set(['a', 'b'])
    ])
  }
  const roll = rng()
  if (roll < 0.25) {
    const n = Math.floor(rng() * 4)
    return Array.from({ length: n }, () => genValue(rng, depth - 1))
  }
  if (roll < 0.4) {
    const n = Math.floor(rng() * 3)
    const a: unknown[] = []
    a.length = n + 1
    for (let i = 0; i < n; i++) {
      if (rng() < 0.7) a[i] = genValue(rng, depth - 1)
    }
    return a
  }
  if (roll < 0.55) {
    const o = Object.create(null) as Record<string, unknown>
    const n = Math.floor(rng() * 3)
    for (let i = 0; i < n; i++) {
      o[`k${String(i)}`] = genValue(rng, depth - 1)
    }
    return o
  }
  if (roll < 0.7) {
    const o: Record<string, unknown> = {}
    const n = Math.floor(rng() * 3)
    for (let i = 0; i < n; i++) {
      o[`k${String(i)}`] = genValue(rng, depth - 1)
      if (rng() < 0.15) o[`u${String(i)}`] = undefined
    }
    return o
  }
  if (roll < 0.85) {
    const m = new Map<unknown, unknown>()
    const n = Math.floor(rng() * 3)
    for (let i = 0; i < n; i++) {
      m.set(pick(rng, [i, `s${String(i)}`, true, null]), genValue(rng, depth - 1))
    }
    return m
  }
  const s = new Set<unknown>()
  const n = Math.floor(rng() * 3)
  for (let i = 0; i < n; i++) {
    s.add(pick(rng, [i, `s${String(i)}`, true, null, -0, 0, NaN]))
  }
  return s
}

describe('canonicalKey', () => {
  it('agrees with deepEqual on 3000 random keyed pairs', () => {
    const rng = mulberry32(0xc0ffee)
    let checked = 0
    for (let i = 0; i < 3000; i++) {
      const a = genValue(rng, 3)
      let b: unknown
      if (rng() < 0.5) {
        b = genValue(rng, 3)
      } else if (a === undefined) {
        b = undefined
      } else {
        b = structuredClone(a)
      }
      const ka = canonicalKey(a)
      const kb = canonicalKey(b)
      if (ka === undefined || kb === undefined) continue
      checked++
      expect(deepEqual(a, b)).toBe(ka === kb)
    }
    expect(checked).toBeGreaterThan(500)
  })

  it('distinguishes null-prototype from plain objects; unifies -0 and 0', () => {
    expect(canonicalKey(Object.assign(Object.create(null), { a: 1 }))).not.toBe(
      canonicalKey({ a: 1 })
    )
    expect(canonicalKey(-0)).toBe(canonicalKey(0))
    expect(canonicalKey(NaN)).toBe(canonicalKey(Number.NaN))
    expect(canonicalKey(new Date(5))).toBe(canonicalKey(new Date(5)))
    expect(canonicalKey(/ab/g)).toBe(canonicalKey(new RegExp('ab', 'g')))
  })

  it('agrees with deepEqual on boxed Number signed zero and exact-prototype built-ins', () => {
    const nNeg = new Number(-0)
    const nPos = new Number(0)
    expect(deepEqual(nNeg, nPos)).toBe(false)
    expect(canonicalKey(nNeg)).not.toBe(canonicalKey(nPos))
    expect(canonicalKey(nNeg)).toBeDefined()
    expect(canonicalKey(nPos)).toBeDefined()

    class SubDate extends Date {}
    class SubRegExp extends RegExp {}
    class SubUint8 extends Uint8Array {}
    const t = 1_700_000_000_000
    expect(deepEqual(new Date(t), new SubDate(t))).toBe(false)
    expect(canonicalKey(new SubDate(t))).toBeUndefined()
    expect(canonicalKey(new Date(t))).toBeDefined()
    expect(deepEqual(/ab/g, new SubRegExp('ab', 'g'))).toBe(false)
    expect(canonicalKey(new SubRegExp('ab', 'g'))).toBeUndefined()
    expect(canonicalKey(/ab/g)).toBeDefined()
    const bytes = [1, 2, 3]
    expect(deepEqual(new Uint8Array(bytes), new SubUint8(bytes))).toBe(false)
    expect(canonicalKey(new SubUint8(bytes))).toBeUndefined()
    expect(canonicalKey(new Uint8Array(bytes))).toBeDefined()

    // Property: when both sides key, key equality iff deepEqual (incl. boxed / subclasses).
    const samples: unknown[] = [
      new Number(-0),
      new Number(0),
      new Number(1),
      new Date(t),
      new SubDate(t),
      /x/i,
      new SubRegExp('x', 'i'),
      new Uint8Array([9]),
      new SubUint8([9]),
      { n: new Number(-0) },
      { n: new Number(0) },
      { d: new Date(t) },
      { d: new SubDate(t) }
    ]
    for (const a of samples) {
      for (const b of samples) {
        const ka = canonicalKey(a)
        const kb = canonicalKey(b)
        if (ka === undefined || kb === undefined) continue
        expect(deepEqual(a, b)).toBe(ka === kb)
      }
    }
  })
})
