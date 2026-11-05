/**
 * Bounded power-of-ten cache: large exponents must not pin unbounded tables.
 * Own file so the fork starts with a cold decimal module (vitest pool: forks).
 */
import { describe, expect, it } from 'vitest'
import { decimal } from '../src/decimal/index.js'
import { getPow10CachedDigits, pow10 } from '../src/decimal/pow10.js'

describe('bounded power-of-ten cache', () => {
  it('extreme add/div leave fewer than 20_000 cached decimal digits', () => {
    const sum = decimal('1e-9999').add(1)
    expect(sum.toString()).toBe('1.' + '0'.repeat(9998) + '1')
    const q = decimal('1e9998').div(decimal('9'.repeat(9999)), { precision: 10000 })
    expect(q.toString().startsWith('0.1')).toBe(true)
    expect(getPow10CachedDigits()).toBeLessThan(20_000)
  })

  it('pow10 matches 10n ** BigInt(k) on 2000 random exponents', () => {
    // Deterministic LCG so the suite is replayable without Math.random.
    let state = 0xdec1a1
    const next = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state
    }
    for (let n = 0; n < 2000; n++) {
      const k = next() % 10_001
      expect(pow10(k)).toBe(10n ** BigInt(k))
    }
  })
})
