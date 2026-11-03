import { describe, expect, it, vi } from 'vitest'
import { decimal, Decimal } from '../src/decimal/index.js'
import { isqrt } from '../src/decimal/isqrt.js'
import type { RoundingMode } from '../src/decimal/index.js'
import { ValueError, ZeroDivisionError } from '../src/globals/errors.js'
import { sorted } from '../src/itertools/index.js'
import { max } from '../src/math/index.js'
import { add, compare, eq } from '../src/operators/index.js'
import { protocol } from '../src/operators/protocol.js'

const MODES: RoundingMode[] = ['halfEven', 'halfUp', 'halfDown', 'down', 'up', 'floor', 'ceil']

describe('SPEC-R65 Decimal construction', () => {
  it('SPEC-R65 accepts grammar and scientific notation', () => {
    expect(decimal('1e3').toString()).toBe('1000')
    expect(decimal('1E3').toString()).toBe('1000')
    expect(decimal('  +1.5  ').toString()).toBe('1.5')
    expect(decimal('.5').toString()).toBe('0.5')
    expect(decimal('-.5').toString()).toBe('-0.5')
    expect(decimal(1e23).toString()).toBe('100000000000000000000000')
    expect(decimal(1n).toString()).toBe('1')
    expect(decimal(decimal('2')).toString()).toBe('2')
  })

  it('SPEC-R65 rejects invalid and hang inputs', { timeout: 1000 }, () => {
    for (const bad of ['abc', '', '1.2.3', '1e', '--1', '1e1.5', NaN, Infinity, -Infinity, {}]) {
      const start = performance.now()
      expect(
        () => new Decimal(bad as unknown as import('../src/decimal/index.js').DecimalInput)
      ).toThrow(ValueError)
      expect(performance.now() - start).toBeLessThan(100)
    }
  })

  it('SPEC-R65 exponent bound', () => {
    expect(() => decimal('1e400000000')).toThrow(ValueError)
    expect(() => decimal('1e400000000')).toThrow(/exponent out of range/)
    expect(() => decimal('1e1000001')).toThrow(ValueError)
    expect(() => decimal('1e1000000')).not.toThrow()
  })
})

describe('SPEC-R66 Arithmetic and rounding', () => {
  it('SPEC-R66 exact add/sub/mul and default div', () => {
    expect(decimal('50000000000').add('0.00000000000000000005').toString()).toBe(
      '50000000000.00000000000000000005'
    )
    expect(decimal('0.1').add('0.1').add('0.1').toString()).toBe('0.3')
    expect(decimal('1').sub('0.0000000000000000001').toString()).toBe('0.9999999999999999999')
    expect(decimal('0.0000000000000000000025').mul('400000000000000000000').eq(1)).toBe(true)
    expect(decimal(1).div(3).toString()).toBe('0.33333333333333333333')
    expect(decimal(2).div(3).toString()).toBe('0.66666666666666666667')
    expect(decimal('100').div(3).toString().split('.')[1]).toHaveLength(20)
    expect(
      decimal('1000000000000000000000000000000')
        .div(3)
        .toString()
        .startsWith('333333333333333333333333333333.3')
    ).toBe(true)
    expect(decimal(1).div(3, { precision: 30 }).toString()).toBe('0.333333333333333333333333333333')
    expect(decimal('0.125').div(1, { precision: 2 }).toString()).toBe('0.12')
  })

  it('SPEC-R66 div rounding modes at precision 0 and 2', () => {
    const expectDiv = (
      value: string,
      precision: number,
      expected: Record<RoundingMode, string>
    ) => {
      for (const mode of MODES) {
        expect(decimal(value).div(1, { precision, rounding: mode }).toString()).toBe(expected[mode])
      }
    }

    expectDiv('2.5', 0, {
      halfEven: '2',
      halfUp: '3',
      halfDown: '2',
      down: '2',
      up: '3',
      floor: '2',
      ceil: '3'
    })
    expectDiv('-2.5', 0, {
      halfEven: '-2',
      halfUp: '-3',
      halfDown: '-2',
      down: '-2',
      up: '-3',
      floor: '-3',
      ceil: '-2'
    })
    expectDiv('1.5', 0, {
      halfEven: '2',
      halfUp: '2',
      halfDown: '1',
      down: '1',
      up: '2',
      floor: '1',
      ceil: '2'
    })
    expectDiv('-1.5', 0, {
      halfEven: '-2',
      halfUp: '-2',
      halfDown: '-1',
      down: '-1',
      up: '-2',
      floor: '-2',
      ceil: '-1'
    })
    expectDiv('0.125', 0, {
      halfEven: '0',
      halfUp: '0',
      halfDown: '0',
      down: '0',
      up: '1',
      floor: '0',
      ceil: '1'
    })
    expectDiv('-0.125', 0, {
      halfEven: '0',
      halfUp: '0',
      halfDown: '0',
      down: '0',
      up: '-1',
      floor: '-1',
      ceil: '0'
    })
    expectDiv('0.125', 2, {
      halfEven: '0.12',
      halfUp: '0.13',
      halfDown: '0.12',
      down: '0.12',
      up: '0.13',
      floor: '0.12',
      ceil: '0.13'
    })
    expectDiv('-0.125', 2, {
      halfEven: '-0.12',
      halfUp: '-0.13',
      halfDown: '-0.12',
      down: '-0.12',
      up: '-0.13',
      floor: '-0.13',
      ceil: '-0.12'
    })
    expectDiv('2.5', 2, {
      halfEven: '2.5',
      halfUp: '2.5',
      halfDown: '2.5',
      down: '2.5',
      up: '2.5',
      floor: '2.5',
      ceil: '2.5'
    })
  })

  it('SPEC-R66 div precision RangeError and ZeroDivisionError', () => {
    expect(() => decimal(1).div(3, { precision: -1 })).toThrow(RangeError)
    expect(() => decimal(1).div(3, { precision: 1.5 })).toThrow(RangeError)
    expect(() => decimal(1).div(0)).toThrow(ZeroDivisionError)
  })

  it('SPEC-R66 round with negative precision', () => {
    expect(decimal(15).round(-1).toString()).toBe('20')
    expect(decimal(-15).round(-1, 'halfUp').toString()).toBe('-20')
    expect(decimal(-15).round(-1, 'halfDown').toString()).toBe('-10')
    expect(decimal(15).round(-1, 'halfEven').toString()).toBe('20')
  })
})

describe('SPEC-R67 Zero and normalization', () => {
  it('SPEC-R67 normalizes zero and trailing zeros', () => {
    expect(decimal('0.01').sub('0.01').eq(0)).toBe(true)
    expect(decimal('0.01').sub('0.01').compare(decimal(0))).toBe(0)
    expect(decimal('0.01').sub('0.01').compare(0)).toBe(1)
    expect(decimal('0.01').sub('0.01').toString()).toBe('0')
    expect(decimal('0').mul('1000').toString()).toBe('0')
    expect(decimal('0.00').toString()).toBe('0')
    expect(decimal(-0).toString()).toBe('0')
    expect(decimal(0).negated().toString()).toBe('0')
  })
})

describe('SPEC-R68 sqrt', () => {
  it('SPEC-R68 sqrt values and modes', () => {
    expect(decimal(2).sqrt().toString()).toBe('1.4142135623730950488')
    expect(decimal(10).sqrt().toString()).toBe('3.162277660168379332')
    expect(decimal(0).sqrt().toString()).toBe('0')
    expect(decimal('1e-40').sqrt().toString()).toBe('0.00000000000000000001')
    expect(decimal('1.01').sqrt({ precision: 0, rounding: 'up' }).toString()).toBe('2')
    expect(decimal('1.01').sqrt({ precision: 0, rounding: 'ceil' }).toString()).toBe('2')
    expect(decimal('1.01').sqrt({ precision: 0, rounding: 'halfEven' }).toString()).toBe('1')
  })

  it('SPEC-R68 inexact sqrt rounding modes at precision 0', () => {
    // sqrt(2)≈1.414 and sqrt(1.01)≈1.005; both inexact, fraction below half at p=0.
    const expected: Record<RoundingMode, string> = {
      up: '2',
      down: '1',
      ceil: '2',
      floor: '1',
      halfUp: '1',
      halfDown: '1',
      halfEven: '1'
    }
    for (const rounding of MODES) {
      expect(decimal(2).sqrt({ precision: 0, rounding }).toString()).toBe(expected[rounding])
      expect(decimal('1.01').sqrt({ precision: 0, rounding }).toString()).toBe(expected[rounding])
    }
  })

  it('SPEC-R68 negative sqrt throws and writes no console', () => {
    const spy = vi.spyOn(console, 'log')
    expect(() => decimal(-1).sqrt()).toThrow(ValueError)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('SPEC-R69 Conversion protocol', () => {
  it('SPEC-R69 toString toNumber toJSON valueOf toPrimitive', () => {
    expect(JSON.stringify({ d: decimal('1.5') })).toBe('{"d":"1.5"}')
    expect(String(decimal(2))).toBe('2')
    expect(decimal(5).toNumber()).toBe(5)
    expect(() => decimal(5).valueOf()).toThrow(TypeError)
    expect(() => {
      const a: unknown = decimal(5)
      return (a as number) + 1
    }).toThrow(TypeError)
    expect(() => {
      const a: unknown = decimal(1)
      const b: unknown = decimal(2)
      return (a as number) < (b as number)
    }).toThrow(TypeError)
  })
})

describe('SPEC-R70 Decimal protocol', () => {
  it('SPEC-R70 exact-binary compare and eq with numbers', () => {
    expect(eq(decimal('0.1'), 0.1)).toBe(false)
    expect(eq(decimal(0.5), 0.5)).toBe(true)
    expect(decimal('0.1').eq(0.1)).toBe(false)
    expect(decimal('0.5').eq(0.5)).toBe(true)
    expect(decimal('0.1').add(0.2).eq('0.3')).toBe(true)
    expect(compare(decimal(1), Infinity)).toBe(-1)
    expect(compare(decimal(1), -Infinity)).toBe(1)
    expect(compare(decimal(3), 1)).toBe(1)
    expect(compare(1, decimal(3))).toBe(-1)
    expect(decimal(2n ** 60n).eq(2 ** 60)).toBe(true)
  })

  it('SPEC-R70 public ordering throws on NaN', () => {
    expect(() => decimal(1).lt(NaN)).toThrow(TypeError)
    expect(() => decimal(1).compare(NaN)).toThrow(TypeError)
  })

  it('SPEC-R70 protocol arithmetic and rank', () => {
    expect(Reflect.get(decimal(1), protocol.rank)).toBe(1)
    expect(String(add(decimal('0.1'), '0.2'))).toBe('0.3')
    expect(decimal(3)[protocol.abs]().toString()).toBe('3')
    expect(decimal(-3)[protocol.abs]().toString()).toBe('3')
    expect(Object.prototype.propertyIsEnumerable.call(Decimal.prototype, protocol.add)).toBe(false)
  })

  it('SPEC-R70 lt gt lte gte', () => {
    const a = decimal('0.0000000000000000000025')
    const b = decimal('0.00000000000000000000255')
    expect(a.lt(b)).toBe(true)
    expect(a.lt(1)).toBe(true)
    expect(b.gt(a)).toBe(true)
    expect(a.lte(a)).toBe(true)
    expect(b.gte(a)).toBe(true)
  })
})

describe('Decimal clone and abs', () => {
  it('clone and abs preserve value', () => {
    const a = decimal('-1.5')
    const c = a.clone()
    expect(c.toString()).toBe('-1.5')
    expect(c).not.toBe(a)
    expect(a.abs().toString()).toBe('1.5')
    expect(a.negated().toString()).toBe('1.5')
  })
})

describe('F-055 linear-time parse and normalize', () => {
  it('parses a long digit run under 250ms', { timeout: 2000 }, () => {
    const start = performance.now()
    expect(decimal('1' + '0'.repeat(200000)).toString()).toBe('1' + '0'.repeat(200000))
    expect(performance.now() - start).toBeLessThan(250)
  })

  it('adds 1e1000000 under 250ms', { timeout: 2000 }, () => {
    const start = performance.now()
    expect(decimal(0).add('1e1000000').eq('1e1000000')).toBe(true)
    expect(performance.now() - start).toBeLessThan(250)
  })

  it('divides 1e1000000 under 250ms', { timeout: 2000 }, () => {
    const start = performance.now()
    expect(decimal('1e1000000').div(100).eq('1e999998')).toBe(true)
    expect(performance.now() - start).toBeLessThan(250)
  })

  it('rejects a long invalid digit run under 250ms', { timeout: 2000 }, () => {
    const bad = '1'.repeat(40000) + 'x'
    const start = performance.now()
    expect(() => decimal(bad)).toThrow(ValueError)
    expect(performance.now() - start).toBeLessThan(250)
  })

  it('sqrt of 1e80000 under 250ms', { timeout: 2000 }, () => {
    const start = performance.now()
    expect(decimal('1e80000').sqrt().toString().length).toBeGreaterThan(0)
    expect(performance.now() - start).toBeLessThan(250)
  })

  it('sqrt of 1e1000000 under 250ms', { timeout: 2000 }, () => {
    const start = performance.now()
    expect(decimal('1e1000000').sqrt().toString().length).toBeGreaterThan(0)
    expect(performance.now() - start).toBeLessThan(250)
  })

  it('sqrt of 2e999999 under 250ms', { timeout: 2000 }, () => {
    const start = performance.now()
    expect(decimal('2e999999').sqrt().toString().length).toBeGreaterThan(0)
    expect(performance.now() - start).toBeLessThan(250)
  })
})

describe('isqrt precision-doubling', () => {
  function assertIsqrt(N: bigint): void {
    const x = isqrt(N)
    expect(x * x <= N).toBe(true)
    expect((x + 1n) * (x + 1n) > N).toBe(true)
  }

  it('rejects negative inputs', () => {
    expect(() => isqrt(-1n)).toThrow(RangeError)
    expect(() => isqrt(-1n)).toThrow(/isqrt of a negative number/)
  })

  it('exact floor root on edges and 2000 random bit lengths', () => {
    const edges = [0n, 1n, 2n, 3n, 4n, (1n << 52n) - 1n, 1n << 52n, (1n << 52n) + 1n, 1n << 104n]
    for (let k = 1; k <= 512; k++) {
      const sq = 1n << BigInt(2 * k)
      edges.push(sq - 1n)
      edges.push(sq)
    }
    for (const N of edges) assertIsqrt(N)

    // Seeded LCG for reproducibility.
    let state = 0xc0ffee42
    const rand = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state
    }
    for (let i = 0; i < 2000; i++) {
      const bits = 1 + (rand() % 3000)
      let N = 1n
      for (let b = 0; b < bits; b += 32) {
        N = (N << 32n) | BigInt(rand())
      }
      N &= (1n << BigInt(bits)) - 1n
      if (N === 0n) N = 1n
      assertIsqrt(N)
    }
  })
})

describe('Decimal.MAX_PRECISION', () => {
  it('rejects huge precision before scaling in under 10ms', () => {
    let start = performance.now()
    expect(() => decimal('1').div('3', { precision: 1e8 })).toThrow(RangeError)
    expect(performance.now() - start).toBeLessThan(10)
    start = performance.now()
    expect(() => decimal('2').sqrt({ precision: 1e7 })).toThrow(RangeError)
    expect(performance.now() - start).toBeLessThan(10)
    start = performance.now()
    expect(() => decimal('1.5').round(-3e8)).toThrow(RangeError)
    expect(performance.now() - start).toBeLessThan(10)
  })

  it('round(-5) of 1.5 short-circuits by mode', () => {
    const modes: RoundingMode[] = ['halfEven', 'halfUp', 'halfDown', 'down', 'up', 'floor', 'ceil']
    for (const rounding of modes) {
      const got = decimal('1.5').round(-5, rounding).toString()
      if (rounding === 'up' || rounding === 'ceil') expect(got).toBe('100000')
      else expect(got).toBe('0')
    }
  })

  it('div at precision MAX_PRECISION finishes under 100ms', { timeout: 2000 }, () => {
    const start = performance.now()
    const s = decimal('1').div('3', { precision: Decimal.MAX_PRECISION }).toString()
    expect(performance.now() - start).toBeLessThan(100)
    expect(s.length).toBeGreaterThan(Decimal.MAX_PRECISION)
  })
})

describe('Decimal ValueError truncation and immutable defaultPrecision', () => {
  it('truncates long invalid inputs in ValueError messages', () => {
    const bad = '1'.repeat(40) + 'x'
    expect(() => decimal(bad)).toThrow(ValueError)
    try {
      decimal(bad)
    } catch (e) {
      const msg = (e as Error).message
      expect(msg.startsWith('invalid Decimal string: ')).toBe(true)
      expect(msg.length).toBeLessThan(120)
      expect(msg).toContain('...')
      expect(msg).not.toContain(bad)
    }
  })

  it('truncateForError cuts a 50 MB string before stringify', async () => {
    const { truncateForError } = await import('../src/internal/truncate.js')
    const huge = 'x'.repeat(50 * 1024 * 1024)
    const start = performance.now()
    const out = truncateForError(huge)
    expect(performance.now() - start).toBeLessThan(20)
    expect(out.endsWith('...')).toBe(true)
    expect(out.length).toBeLessThan(100)
  })

  it('defaultPrecision is immutable and stays 20', () => {
    expect(Decimal.defaultPrecision).toBe(20)
    expect(() => {
      // @ts-expect-error assignment must fail at runtime
      Decimal.defaultPrecision = 5
    }).toThrow()
    expect(Decimal.defaultPrecision).toBe(20)
    expect(decimal(1).div(3).toString()).toBe('0.33333333333333333333')
  })
})

describe('magnitude-first Decimal comparison', () => {
  /** Pre-fix scale-by-exponent-gap compare (baseline for agreement). */
  function oldCompareIE(ai: bigint, ae: number, bi: bigint, be: number): -1 | 0 | 1 {
    if (ae === be) return ai < bi ? -1 : ai > bi ? 1 : 0
    if (ae > be) {
      const scaled = ai * 10n ** BigInt(ae - be)
      return scaled < bi ? -1 : scaled > bi ? 1 : 0
    }
    const scaled = bi * 10n ** BigInt(be - ae)
    return ai < scaled ? -1 : ai > scaled ? 1 : 0
  }

  function normalizeIE(i: bigint, e: number): { i: bigint; e: number } {
    if (i === 0n) return { i: 0n, e: 0 }
    const s = i.toString()
    let zeros = 0
    for (let k = s.length - 1; k >= 0 && s[k] === '0'; k--) zeros++
    if (zeros === 0) return { i, e }
    return { i: i / 10n ** BigInt(zeros), e: e + zeros }
  }

  /** Exact binary value of a finite number as decimal `(i, e)` (mirrors Decimal.toExact). */
  function toExact(n: number): { i: bigint; e: number } {
    const dv = new DataView(new ArrayBuffer(8))
    dv.setFloat64(0, n)
    const bits = dv.getBigUint64(0)
    const exp = Number((bits >> 52n) & 0x7ffn)
    const frac = bits & ((1n << 52n) - 1n)
    const m = exp === 0 ? frac : frac | (1n << 52n)
    const k = (exp === 0 ? 1 : exp) - 1075
    const sign = bits >> 63n ? -1n : 1n
    if (k >= 0) {
      return normalizeIE(sign * m * 2n ** BigInt(k), 0)
    }
    return normalizeIE(sign * m * 5n ** BigInt(-k), k)
  }

  function fromIE(i: bigint, e: number): Decimal {
    const n = normalizeIE(i, e)
    return decimal(String(n.i) + 'e' + String(n.e))
  }

  it('1e6 random small-exponent pairs agree with scale-gap compare', { timeout: 60_000 }, () => {
    let state = 0xdec23c3
    const rand = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state
    }
    const randCoeff = (): bigint => {
      const bits = rand() % 40
      let n = BigInt(rand())
      if (bits > 32) n = (n << 32n) | BigInt(rand())
      if (n === 0n) return 0n
      if (rand() & 1) n = -n
      return n
    }
    for (let i = 0; i < 1_000_000; i++) {
      const ai = randCoeff()
      const bi = randCoeff()
      const ae = (rand() % 81) - 40
      const be = (rand() % 81) - 40
      const a = normalizeIE(ai, ae)
      const b = normalizeIE(bi, be)
      const expected = oldCompareIE(a.i, a.e, b.i, b.e)
      expect(fromIE(a.i, a.e).compare(fromIE(b.i, b.e))).toBe(expected)

      if ((i & 15) === 0) {
        // bigint path: #numericCompare uses (bigint, e=0) without re-normalizing
        expect(fromIE(a.i, a.e).compare(bi)).toBe(oldCompareIE(a.i, a.e, bi, 0))
      }
      if ((i & 31) === 0) {
        // number path: exact-binary via toExact
        const n = (rand() % 2001) - 1000 + (rand() % 1000) / 1000
        if (Number.isFinite(n)) {
          const ex = toExact(n)
          expect(fromIE(a.i, a.e).compare(n)).toBe(oldCompareIE(a.i, a.e, ex.i, ex.e))
        }
      }
    }
  })

  it('sorted of 200 extreme-exponent Decimals finishes under 50ms', { timeout: 2000 }, () => {
    const vals = Array.from({ length: 200 }, (_, i) => decimal(i % 2 ? '1e-999999' : '1e999999'))
    const start = performance.now()
    expect(sorted(vals).length).toBe(200)
    expect(performance.now() - start).toBeLessThan(50)
  })

  it('math.max over 900 extreme-exponent Decimals finishes under 50ms', { timeout: 2000 }, () => {
    const vals = Array.from({ length: 900 }, (_, i) => decimal(i % 2 ? '1e-999999' : '1e999999'))
    const start = performance.now()
    expect(max(vals)?.eq('1e999999')).toBe(true)
    expect(performance.now() - start).toBeLessThan(50)
  })
})
