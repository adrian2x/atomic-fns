import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { matches } from '../src/collections/index.js'
import { ValueError } from '../src/globals/index.js'
import {
  Duration,
  durationField,
  type DurationObject,
  type DurationUnit
} from '../src/i18n/duration.js'
import { sorted } from '../src/itertools/index.js'
import { compare, deepEqual, eq, lt } from '../src/operators/index.js'

describe('Duration', () => {
  it('SPEC-R94 total quarters from years', () => {
    expect(new Duration({ years: 1 }).total('quarters')).toBe(4)
    expect(new Duration({ years: 1 }).quarters).toBe(0)
    expect(new Duration({ quarters: 2 }).quarters).toBe(2)
  })

  it('SPEC-R94 ISO folds quarters into months', () => {
    expect(new Duration({ quarters: 2 }).toISOString()).toBe('P6M')
    expect(new Duration({ years: 1, quarters: 1 }).toISOString()).toBe('P1Y3M')
  })

  it('SPEC-R94 normalize leaves the receiver unchanged', () => {
    const d = new Duration({ hours: 1, minutes: 90 })
    const before = d.toObject()
    const n = d.normalize()
    expect(d.toObject()).toEqual(before)
    expect(n.toObject()).toEqual({ hours: 2, minutes: 30 })
  })

  it('SPEC-R94 exact leaves the receiver unchanged and returns a new instance', () => {
    const d = new Duration({ years: 1 })
    expect(d.total('days')).toBe(365)
    const exact = d.exact()
    expect(exact).toBeInstanceOf(Duration)
    expect(exact).not.toBe(d)
    expect(d.total('days')).toBe(365)
    expect(exact.total('days')).toBe(365.2425)
  })

  it('SPEC-R94 exact mode propagates through add subtract negated abs', () => {
    const base = new Duration({ years: 1 }, true)
    expect(base.add({ months: 0 }).total('days')).toBe(365.2425)
    expect(base.subtract({ months: 0 }).total('days')).toBe(365.2425)
    expect(base.negated().total('days')).toBe(-365.2425)
    expect(base.negated().abs().total('days')).toBe(365.2425)
    expect(new Duration({ years: 1 }).add({}).total('days')).toBe(365)
  })

  it('SPEC-R94 constructor rejects ISO strings with ValueError', () => {
    expect(() => new Duration('P1D' as unknown as number)).toThrow(ValueError)
    expect(() => new Duration('P1D' as unknown as number)).toThrow(/use Duration\.from/)
  })

  it('error messages truncate echoed input (no raw newlines)', () => {
    const unit = 'x'.repeat(100_000) + '\n'
    expect(() => durationField(unit)).toThrow(ValueError)
    try {
      durationField(unit)
    } catch (e) {
      const msg = (e as Error).message
      expect(msg.length).toBeLessThan(120)
      expect(msg.includes('\n')).toBe(false)
      expect(msg).toContain('...')
    }
  })

  it('error messages handle bigint, symbol, and emoji code-point cuts', () => {
    expect(() => durationField(10n as never)).toThrow(ValueError)
    try {
      durationField(10n as never)
    } catch (e) {
      expect((e as Error).message).toContain('10')
    }
    expect(() => durationField(Symbol('u') as never)).toThrow(ValueError)
    try {
      durationField(Symbol('u') as never)
    } catch (e) {
      expect((e as Error).message).toMatch(/Symbol/)
    }
    const emojiUnit = `${'x'.repeat(38)}\u{1F600}yyyy`
    expect(() => durationField(emojiUnit)).toThrow(ValueError)
    try {
      durationField(emojiUnit)
    } catch (e) {
      const msg = (e as Error).message
      expect(msg.includes('...')).toBe(true)
      // Truncation must not leave a lone UTF-16 surrogate.
      for (let i = 0; i < msg.length; i++) {
        const c = msg.charCodeAt(i)
        if (c >= 0xd800 && c <= 0xdbff) {
          expect(i + 1 < msg.length).toBe(true)
          const low = msg.charCodeAt(i + 1)
          expect(low >= 0xdc00 && low <= 0xdfff).toBe(true)
          i++
        } else {
          expect(c < 0xdc00 || c > 0xdfff).toBe(true)
        }
      }
    }
  })

  it('SPEC-R94 constructor rejects unsupported input', () => {
    expect(() => new Duration(true as unknown as number)).toThrow(ValueError)
    expect(() => new Duration(null as unknown as number)).toThrow(ValueError)
  })

  it('SPEC-R94 constructor accepts number Duration and DurationObject', () => {
    expect(new Duration(1500).milliseconds).toBe(1500)
    expect(new Duration({ days: 2 }).days).toBe(2)
    expect(new Duration(new Duration({ hours: 3 })).hours).toBe(3)
  })

  it("SPEC-R94 from('P') throws ValueError", () => {
    expect(() => Duration.from('P')).toThrow(ValueError)
    expect(() => Duration.from('-P')).toThrow(ValueError)
  })

  it('SPEC-R94 from parses a valid duration', () => {
    expect(Duration.from('P1DT2H').toObject()).toEqual({ days: 1, hours: 2 })
    expect(Duration.from('PT30M').minutes).toBe(30)
  })

  it("SPEC-R94 format('en') uses Intl.DurationFormat", () => {
    expect(new Duration({ hours: 1, minutes: 30 }).format('en')).toBe('1 hr, 30 min')
  })

  it('SPEC-R94 Duration is frozen and fields are read via getters', () => {
    const d = new Duration({ years: 2, hours: 3 })
    expect(Object.isFrozen(d)).toBe(true)
    expect(d.years).toBe(2)
    expect(d.days).toBe(0)
    expect(d.toObject()).toEqual({ years: 2, hours: 3 })
    const obj = d.toObject()
    obj.years = 9
    expect(d.years).toBe(2)
  })

  it('SPEC-R94 fields do not alias the constructor input or other Durations', () => {
    const input = { hours: 1 }
    const d = new Duration(input)
    input.hours = 5
    expect(d.hours).toBe(1)

    const copy = new Duration(d)
    expect(copy.toObject()).toEqual(d.toObject())
    expect(copy).not.toBe(d)

    const obj = d.toObject()
    obj.hours = 7
    expect(d.hours).toBe(1)
  })

  it('SPEC-R94 format carries fractional parts down before formatting', () => {
    expect(new Duration({ hours: 1.5 }).format('en')).toBe('1 hr, 30 min')
    expect(new Duration({ hours: 1.5 }).format('en', { style: 'long' })).toBe('1 hour, 30 minutes')
    expect(new Duration({ minutes: 2.25 }).format('en')).toBe('2 min, 15 sec')
    expect(new Duration({ days: 1.5 }).format('en')).toBe('1 day, 12 hr')
    expect(new Duration({ years: 1.5 }).format('en')).toBe('1 yr, 6 mths')
    expect(new Duration({ quarters: 0.5 }).format('en')).toBe('1 mth, 15 days, 5 hr')
  })

  it('SPEC-R94 format carries fractional milliseconds into microseconds and nanoseconds', () => {
    expect(new Duration({ milliseconds: 1.5 }).format('en', { style: 'long' })).toBe(
      '1 millisecond, 500 microseconds'
    )
    expect(new Duration({ milliseconds: 1.000001 }).format('en', { style: 'long' })).toBe(
      '1 millisecond, 1 nanosecond'
    )
    expect(new Duration({ milliseconds: 0.0000004 }).format('en', { style: 'long' })).toBe(
      '0 seconds'
    )
  })

  it('SPEC-R94 format absorbs float noise and rounding overflow', () => {
    expect(new Duration({ hours: 2.3 }).format('en')).toBe('2 hr, 18 min')
    expect(new Duration({ hours: 1.1 }).format('en')).toBe('1 hr, 6 min')
    expect(new Duration({ milliseconds: 0.9999999 }).format('en', { style: 'long' })).toBe(
      '1 millisecond'
    )
  })

  it('SPEC-R94 format keeps negative durations negative', () => {
    expect(new Duration({ hours: -1.5 }).format('en')).toBe('-1 hr, 30 min')
    expect(new Duration({ hours: -1.5 }).format('en', { style: 'narrow' })).toBe('-1h 30m')
  })

  it('SPEC-R94 get and singular unit aliases', () => {
    const d = new Duration({ years: 2, quarters: 1, days: 3 })
    expect(d.get('years')).toBe(2)
    expect(d.get('quarter')).toBe(1)
    expect(d.get('days')).toBe(3)
    expect(d.get('months')).toBe(0)
  })

  it('SPEC-R94 toISOString time and empty forms', () => {
    expect(new Duration({ minutes: 5 }).toISOString()).toBe('PT5M')
    expect(new Duration({}).toISOString()).toBe('PT0S')
    expect(new Duration({ milliseconds: 6 }).toISOString()).toBe('PT0.006S')
  })

  it('SPEC-R94 constructor validation rejects bad fields and inputs', () => {
    expect(() => new Duration({ days: Infinity })).toThrow(ValueError)
    expect(() => new Duration({ days: NaN })).toThrow(ValueError)
    expect(() => new Duration({ days: '1' } as unknown as DurationObject)).toThrow(ValueError)
    expect(() => new Duration({ constructor: 5 } as unknown as DurationObject)).toThrow(ValueError)
    expect(() => new Duration({ toString: 5 } as unknown as DurationObject)).toThrow(ValueError)
    expect(() => new Duration({ day: 1 } as unknown as DurationObject)).toThrow(ValueError)
    expect(() => new Duration(NaN)).toThrow(ValueError)
    expect(() => new Duration([] as unknown as DurationObject)).toThrow(ValueError)
    expect(new Duration({ days: undefined }).toObject()).toEqual({})
    const d = new Duration({ days: 1 })
    expect(() => d.get('constructor')).toThrow(ValueError)
    expect(() => d.total('constructor' as DurationUnit)).toThrow(ValueError)
    expect(() => d.get('__proto__')).toThrow(ValueError)
  })

  it('SPEC-R94 stores -0 as 0', () => {
    expect(Object.is(new Duration({ hours: 0 }).negated().hours, 0)).toBe(true)
    expect(Object.is(new Duration({ hours: -0 }).hours, 0)).toBe(true)
  })

  it('SPEC-R94 normalize keeps present fields and balances mixed signs', () => {
    expect(new Duration({ hours: 96, minutes: 0, seconds: -10 }).normalize().toObject()).toEqual({
      hours: 95,
      minutes: 59,
      seconds: 50
    })
    expect(new Duration({ hours: 0, minutes: 90 }).normalize().toObject()).toEqual({
      hours: 1,
      minutes: 30
    })
    expect(new Duration({ minutes: 90 }).normalize().toObject()).toEqual({ minutes: 90 })
    expect(new Duration({ hours: 1, minutes: -30 }).normalize().toObject()).toEqual({
      hours: 0,
      minutes: 30
    })
    expect(new Duration({ years: 2, days: -2 }).normalize().toObject()).toEqual({
      years: 1,
      days: 363
    })
  })

  it('SPEC-R94 round and totals', () => {
    expect(
      new Duration({ days: 14 })
        .subtract(new Duration(7 * 86_400_000).round({ largestUnit: 'years' }))
        .round({ largestUnit: 'years' })
        .toISOString()
    ).toBe('P7D')
    const exactYear = new Duration({ years: 100 }, true)
      .subtract(new Duration(7 * 86_400_000).round({ largestUnit: 'years' }))
      .round({ largestUnit: 'years' })
      .toObject()
    expect(exactYear).toEqual({
      years: 99,
      months: 11,
      days: 23,
      hours: 10,
      minutes: 29,
      seconds: 6
    })
    for (const v of Object.values(exactYear)) {
      expect(Number.isInteger(v)).toBe(true)
    }
    // 400 days -> 1y + 35d remainder; without weeks that remainder is months+days (not 5 weeks).
    expect(new Duration({ days: 400 }).round({ largestUnit: 'years' }).toObject()).toEqual({
      years: 1,
      months: 1,
      days: 4,
      hours: 14
    })
    expect(new Duration({ days: 10 }).round({ largestUnit: 'weeks' }).toObject()).toEqual({
      weeks: 1,
      days: 3
    })
    expect(new Duration({ hours: 2.3 }).round({ largestUnit: 'years' }).toObject()).toEqual({
      hours: 2,
      minutes: 18
    })
    expect(new Duration(-1500).round({ largestUnit: 'years' }).toObject()).toEqual({
      seconds: -1,
      milliseconds: -500
    })
    expect(new Duration({ minutes: -90 }).round({ largestUnit: 'years' }).toObject()).toEqual({
      hours: -1,
      minutes: -30
    })
    expect(new Duration({ hours: 1.5 }).total('minutes')).toBe(90)
    expect(new Duration({ years: 1 }).total('months')).toBe(12)
    expect(new Duration({ months: 1 }).total('days')).toBeCloseTo(30.4166667)
    expect(new Duration({ months: 1 }, true).total('days')).toBe(30.436875)
  })

  it('SPEC-R94 toISOString vectors', () => {
    expect(new Duration({ days: -1 }).toISOString()).toBe('-P1D')
    expect(new Duration({ seconds: -1, milliseconds: -500 }).toISOString()).toBe('-PT1.5S')
    expect(new Duration({ days: 1.5, hours: 1 }).toISOString()).toBe('P1DT13H')
    expect(new Duration({ hours: 1.5 }).toISOString()).toBe('PT1H30M')
    expect(new Duration({ milliseconds: 2812 }).toISOString()).toBe('PT2.812S')
    expect(new Duration({ seconds: 59, milliseconds: 999.6 }).toISOString()).toBe('PT59.9996S')
    expect(new Duration({ seconds: 1, milliseconds: 0.5 }).toISOString()).toBe('PT1.0005S')
    expect(new Duration({ milliseconds: 1e21 }).toISOString()).toBe('PT1000000000000000000S')
    expect(new Duration({ quarters: 1 }).toISOString()).toBe('P3M')
    expect(new Duration({ years: 1, quarters: 1 }).toISOString()).toBe('P1Y3M')
    expect(new Duration({ weeks: 1, days: 2 }).toISOString()).toBe('P1W2D')
    expect(new Duration({}).toISOString()).toBe('PT0S')
    expect(new Duration({ hours: 0 }).toISOString()).toBe('PT0S')
    expect(new Duration({ hours: 1 }).add({ minutes: -30 }).toISOString()).toBe('PT30M')
  })

  it('SPEC-R94 from accept vectors', () => {
    expect(Duration.from('P0D').toISOString()).toBe('PT0S')
    expect(Duration.from('PT0S').toISOString()).toBe('PT0S')
    expect(Duration.from('-PT0S').toISOString()).toBe('PT0S')
    expect(Duration.from('+P1D').toObject()).toEqual({ days: 1 })
    expect(Duration.from('-P1DT2H').toObject()).toEqual({ days: -1, hours: -2 })
    expect(Duration.from('p1d').toObject()).toEqual({ days: 1 })
    expect(Duration.from('P1dT2h').toObject()).toEqual({ days: 1, hours: 2 })
    expect(Duration.from('pt1h').toObject()).toEqual({ hours: 1 })
    expect(Duration.from('PT1,5H').toObject()).toEqual({ hours: 1.5 })
    expect(Duration.from('PT1.5S').toObject()).toEqual({ seconds: 1.5 })
    expect(Duration.from('P1W2D').toObject()).toEqual({ weeks: 1, days: 2 })
    expect(Duration.from('PT0.123456789S').toISOString()).toBe('PT0.123456789S')
    expect(Duration.from('PT0.0001S').toISOString()).toBe('PT0.0001S')
    expect(Duration.from('PT0.000000001S').toISOString()).toBe('PT0.000000001S')
    expect(Duration.from('PT0.999999999S').toISOString()).toBe('PT0.999999999S')
    expect(() => Duration.from('PT59.999999999M')).not.toThrow()
    expect(() => Duration.from('PT0.999999999H')).not.toThrow()
    expect(() => Duration.from('PT9007199254740991S')).not.toThrow()
    expect(new Duration({ milliseconds: 4e-7 }).toISOString()).toBe('PT0S')
    expect(new Duration({ milliseconds: -4e-7 }).toISOString()).toBe('PT0S')
    expect(new Duration({ seconds: 1e-9 }).toISOString()).toBe('PT0.000000001S')
  })

  it('SPEC-R94 from reject vectors', () => {
    for (const s of [
      'P',
      '-P',
      'PT',
      'P1DT',
      'P1.5Y2M',
      'PT1.5H30M',
      'PT1.5M30S',
      'P1.5DT1H',
      'P1.5Y',
      'P1.5D',
      'P-1D',
      '-P-1D',
      'PT-0.5S',
      'PT0.1234567891S',
      'P99999999999999999999D',
      'PT9007199254740993S',
      ' P1D',
      'P1D\n',
      'PT1H1H',
      'PT1S1M',
      'P1D T1H',
      'P1M1Y'
    ]) {
      expect(() => Duration.from(s)).toThrow(ValueError)
    }
    const long = 'x'.repeat(100)
    let message = ''
    try {
      Duration.from(long)
    } catch (e) {
      message = e instanceof Error ? e.message : ''
    }
    expect(message.length).toBeLessThan(120)
    expect(message).toContain('...')
    expect(message.startsWith('invalid ISO 8601 duration ')).toBe(true)
  })

  it('SPEC-R94 from round trip', () => {
    for (const s of [
      'P0D',
      'PT0S',
      '-PT0S',
      '+P1D',
      '-P1DT2H',
      'p1d',
      'P1dT2h',
      'pt1h',
      'PT1,5H',
      'PT1.5S',
      'P1W2D',
      'PT0.123456789S',
      'PT0.0001S',
      'PT0.000000001S',
      'PT0.999999999S',
      'PT59.999999999M',
      'PT0.999999999H',
      'PT9007199254740991S'
    ]) {
      const once = Duration.from(s).toISOString()
      expect(Duration.from(once).toISOString()).toBe(once)
    }
    expect(() => Duration.from(new Duration({ milliseconds: 1e21 }).toISOString())).toThrow(
      ValueError
    )
  })

  it('SPEC-R94 format vectors', () => {
    expect(new Duration({ hours: 1.5 }).format('en')).toBe('1 hr, 30 min')
    expect(new Duration({ years: 1.5 }).format('en')).toBe('1 yr, 6 mths')
    expect(new Duration({ weeks: 1.5 }).format('en')).toBe('1 wk, 3 days, 12 hr')
    expect(new Duration({ days: 1.5 }).format('en')).toBe('1 day, 12 hr')
    expect(new Duration({ minutes: 2.25 }).format('en')).toBe('2 min, 15 sec')
    expect(new Duration({ hours: 2.3 }).format('en')).toBe('2 hr, 18 min')
    expect(new Duration({ hours: 1.1 }).format('en')).toBe('1 hr, 6 min')
    expect(new Duration({ quarters: 1 }).format('en')).toBe('3 mths')
    expect(new Duration({ quarters: 0.5 }).format('en')).toBe('1 mth, 15 days, 5 hr')
    expect(new Duration({ milliseconds: 0.4 }).format('en')).toBe('400 μs')
    expect(new Duration({ milliseconds: 1.000001 }).format('en', { style: 'long' })).toBe(
      '1 millisecond, 1 nanosecond'
    )
    expect(new Duration({ minutes: 59.9999999999 }).format('en')).toBe(
      '59 min, 59 sec, 999 ms, 999 μs, 994 ns'
    )
    expect(new Duration({ hours: -1, minutes: -30 }).format('en')).toBe('-1 hr, 30 min')
    expect(new Duration({}).format('en')).toBe('0 sec')
    expect(new Duration({}).format('en', { style: 'digital' })).toBe('0:00:00')
  })

  it('SPEC-R94 instance is frozen', () => {
    expect(Object.isFrozen(new Duration({ hours: 1 }))).toBe(true)
  })
})

describe('Duration.from keeps every valid fraction', () => {
  it('accepts fractions a binary double cannot carry to 1 ns', () => {
    expect(Duration.from('PT2048.01H').toObject()).toEqual({ hours: 2048.01 })
    expect(Duration.from('PT4096.1H').toObject()).toEqual({ hours: 4096.1 })
    expect(Duration.from('PT262158.1M').toObject()).toEqual({ minutes: 262158.1 })
    expect(Duration.from('PT16777274.1S').toObject()).toEqual({ seconds: 16777274.1 })
    expect(Duration.from('PT33556782.123S').toObject()).toEqual({ seconds: 33556782.123 })
  })

  it('spills digits past double precision into milliseconds', () => {
    expect(Duration.from('PT123456789.123456789S').toObject()).toEqual({
      seconds: 123456789,
      milliseconds: 123.456789
    })
    expect(Duration.from('-PT123456789.123456789S').toObject()).toEqual({
      seconds: -123456789,
      milliseconds: -123.456789
    })
    for (const s of ['PT1000000000000.123456789S', 'PT9007199254740991.999999999S']) {
      expect(Duration.from(s).toISOString()).toBe(s)
    }
    expect(() => Duration.from('PT9007199254740992.5S')).toThrow(ValueError)
  })

  it('reads back its own toISOString output', () => {
    for (const ms of [Date.UTC(2024, 0, 1) + 123, 31_536_000_100, 9_876_543_210_987, 1]) {
      const iso = new Duration(ms).toISOString()
      expect(Duration.from(iso).total('milliseconds')).toBe(ms)
    }
  })

  it('caps a component by value, so leading zeros are fine', () => {
    expect(Duration.from('P00000000000000001Y').toISOString()).toBe('P1Y')
    expect(Duration.from('PT000000000000000000.5S').toISOString()).toBe('PT0.5S')
    expect(Duration.from(`P${'0'.repeat(10_000)}D`).toISOString()).toBe('PT0S')
    expect(() => Duration.from('P00000000000000009007199254740992Y')).toThrow(ValueError)
  })

  it('takes only ASCII letters as designators', () => {
    expect(() => Duration.from('PT1\u017F')).toThrow(ValueError)
    expect(() => Duration.from('pt1\u017f')).toThrow(ValueError)
  })
})

describe('Duration value semantics', () => {
  it('compares by total length through the operators', () => {
    const ten = new Duration(10_000)
    const two = new Duration(2_000)
    expect(deepEqual(ten, two)).toBe(false)
    expect(deepEqual(new Duration({ minutes: 1 }), new Duration({ seconds: 60 }))).toBe(true)
    expect(matches({ d: ten })({ d: new Duration(10_000) })).toBe(true)
    expect(matches({ d: ten })({ d: two })).toBe(false)
    expect(eq(ten, new Duration(10_000))).toBe(true)
    expect(eq(ten, two)).toBe(false)
    expect(eq(ten, 10_000)).toBe(false)
    expect(lt(ten, two)).toBe(false)
    expect(lt(two, ten)).toBe(true)
    expect(compare(ten, new Duration(10_000))).toBe(0)
    expect(sorted([ten, two]).map(String)).toEqual(['PT2S', 'PT10S'])
    expect(deepEqual(new Duration({ months: 1 }), new Duration({ months: 1 }, true))).toBe(false)
  })

  it('serializes as ISO 8601 and refuses implicit conversion', () => {
    const d = new Duration({ hours: 1 })
    expect(JSON.stringify({ d })).toBe('{"d":"PT1H"}')
    expect(() => Number(d)).toThrow(TypeError)
    expect(() => new Duration(10_000) < new Duration(2_000)).toThrow(TypeError)
    expect(String(d)).toBe('PT1H')
  })

  it('toLocaleString delegates to format', () => {
    expect(new Duration({ hours: 1 }).toLocaleString('en')).toBe('1 hr')
    expect(new Duration({ hours: 1 }).toLocaleString('en', { style: 'long' })).toBe('1 hour')
  })
})

describe('Duration.round follows Temporal', () => {
  it('rounds to smallestUnit, half away from zero by default', () => {
    const d = new Duration({ minutes: 90 })
    expect(d.round({ largestUnit: 'hours', smallestUnit: 'hours' }).toObject()).toEqual({
      hours: 2
    })
    expect(d.round({ smallestUnit: 'hours' }).toObject()).toEqual({ hours: 2 })
    expect(d.round('hours').toObject()).toEqual({ hours: 2 })
    expect(new Duration({ minutes: -90 }).round('hours').toObject()).toEqual({ hours: -2 })
    expect(new Duration(1.5).round('milliseconds').toObject()).toEqual({ milliseconds: 2 })
  })

  it('without smallestUnit it only rebalances', () => {
    expect(new Duration(1.5).round({ largestUnit: 'seconds' }).toObject()).toEqual({
      milliseconds: 1.5
    })
  })

  it('applies every roundingMode', () => {
    const vectors = {
      ceil: [2, -1, 2, 3],
      floor: [1, -2, 1, 2],
      expand: [2, -2, 2, 3],
      trunc: [1, -1, 1, 2],
      halfCeil: [2, -1, 1, 3],
      halfFloor: [1, -2, 1, 2],
      halfExpand: [2, -2, 1, 3],
      halfTrunc: [1, -1, 1, 2],
      halfEven: [2, -2, 1, 2]
    } as const
    for (const roundingMode of Object.keys(vectors) as (keyof typeof vectors)[]) {
      const rounded = [1.5, -1.5, 1.25, 2.5].map(
        (hours) => new Duration({ hours }).round({ smallestUnit: 'hours', roundingMode }).hours
      )
      expect([roundingMode, ...rounded]).toEqual([roundingMode, ...vectors[roundingMode]])
    }
    expect(() =>
      new Duration(1).round({ smallestUnit: 'hours', roundingMode: 'nearest' as never })
    ).toThrow(RangeError)
    expect(() =>
      new Duration(1).round({ largestUnit: 'hours', roundingMode: 'nearest' as never })
    ).toThrow(RangeError)
  })

  it('largestUnit defaults to the largest non-zero field, or smallestUnit when larger', () => {
    expect(new Duration({ days: 1, minutes: 1 }).round('hours').toObject()).toEqual({ days: 1 })
    expect(new Duration({ minutes: 90 }).round('minutes').toObject()).toEqual({ minutes: 90 })
    expect(new Duration({ hours: 0, minutes: 90 }).round('minutes').toObject()).toEqual({
      minutes: 90
    })
    expect(new Duration({ quarters: 1, days: 3 }).round('days').toObject()).toEqual({
      months: 3,
      days: 3
    })
    expect(new Duration().round('hours').toObject()).toEqual({})
  })

  it('carries a rounded remainder into the next unit', () => {
    const almostHour = { minutes: 59, seconds: 40 }
    expect(
      new Duration(almostHour).round({ largestUnit: 'hours', smallestUnit: 'minutes' }).toObject()
    ).toEqual({ hours: 1 })
    expect(new Duration(almostHour).round('minutes').toObject()).toEqual({ minutes: 60 })
    expect(
      new Duration({ hours: 23, minutes: 40 })
        .round({ largestUnit: 'days', smallestUnit: 'hours' })
        .toObject()
    ).toEqual({ days: 1 })
    expect(
      new Duration({ minutes: -59, seconds: -40 })
        .round({ largestUnit: 'hours', smallestUnit: 'minutes' })
        .toObject()
    ).toEqual({ hours: -1 })
  })

  it('weeks join the slice when either end names them', () => {
    expect(
      new Duration({ days: 100 }).round({ largestUnit: 'months', smallestUnit: 'weeks' }).toObject()
    ).toEqual({ months: 3, weeks: 1 })
    expect(new Duration({ days: 10 }).round('weeks').toObject()).toEqual({ weeks: 1 })
  })

  it('names the real problem when the units cannot work', () => {
    const d = new Duration({ days: 1 })
    expect(() => d.round({})).toThrow(/smallestUnit or largestUnit/)
    expect(() => d.round({ largestUnit: 'hours', smallestUnit: 'days' })).toThrow(
      'largestUnit must not be smaller than smallestUnit'
    )
    expect(() => d.round({ largestUnit: 'weeks', smallestUnit: 'months' })).toThrow(
      'largestUnit must not be smaller than smallestUnit'
    )
    expect(() => d.round('quarters')).toThrow('quarters cannot be a rounding unit')
  })

  it('keeps the conversion mode', () => {
    expect(
      new Duration({ months: 1 }, true)
        .round({ largestUnit: 'days', smallestUnit: 'minutes' })
        .toObject()
    ).toEqual({ days: 30, hours: 10, minutes: 29 })
  })
})

describe('Duration with mixed signs', () => {
  it('format balances them first', () => {
    expect(new Duration({ hours: 1 }).subtract({ minutes: 30 }).format('en')).toBe('30 min')
    expect(new Duration({ years: 1 }).subtract({ months: 1 }).format('en')).toBe('11 mths')
    expect(new Duration({ hours: 1 }).add({ minutes: -30 }).format('en')).toBe('30 min')
    expect(new Duration({ hours: -1, minutes: 30 }).format('en')).toBe('-30 min')
    expect(new Duration({ years: -1, quarters: 1 }).format('en')).toBe('-9 mths')
    expect(new Duration({ hours: 1, minutes: -60 }).format('en')).toBe('0 sec')
  })

  it('abs keeps the length', () => {
    const d = new Duration({ hours: 1 }).subtract({ minutes: 30 })
    expect(d.abs().total('minutes')).toBe(30)
    expect(d.negated().abs().total('minutes')).toBe(30)
    expect(new Duration({ hours: 1, seconds: -30 }).abs().toObject()).toEqual({
      hours: 0,
      seconds: 3570
    })
  })
})

describe('Duration field precision', () => {
  it('reads a decimal as written, not as its binary expansion', () => {
    expect(new Duration({ years: 1.1 }).format('en')).toBe('1 yr, 1 mth, 6 days, 2 hr')
    expect(new Duration({ years: 1.1 }).toISOString()).toBe('P1Y1M6DT2H')
    expect(new Duration({ months: 12.1 }).toISOString()).toBe('P12M3DT1H')
    expect(new Duration({ weeks: 100.1 }).toISOString()).toBe('P100WT16H48M')
    expect(new Duration({ days: 1000.1 }).toISOString()).toBe('P1000DT2H24M')
    expect(new Duration({ hours: 100000.1 }).toISOString()).toBe('PT100000H6M')
    expect(new Duration({ minutes: 1000000.1 }).toISOString()).toBe('PT1000000M6S')
  })

  it('reads a repeating fraction as the round count it stands for', () => {
    expect(new Duration({ years: 1 / 3 }).toISOString()).toBe('P4M')
    expect(new Duration({ years: 2 / 3 }).toISOString()).toBe('P8M')
    expect(new Duration({ years: 1000 / 3 }).toISOString()).toBe('P333Y4M')
    expect(new Duration({ months: 1 / 3 }).toISOString()).toBe('P10DT3H20M')
  })

  it('keeps every nanosecond a field holds, whatever the unit', () => {
    expect(new Duration({ years: 3e-10 }).total('milliseconds')).toBe(9.4608)
    expect(new Duration({ years: 1.0000000004 }).total('milliseconds')).toBe(31536000012.6144)
    expect(new Duration({ quarters: 4e-10 }).total('milliseconds')).toBe(3.1536)
    expect(new Duration({ quarters: 4e-10 }).toISOString()).toBe('PT0.0031536S')
    expect(new Duration({ seconds: 1e15 + 0.25 }).total('seconds')).toBe(1e15 + 0.25)
    expect(new Duration({ minutes: 59.9999999999 }).toISOString()).toBe('PT59M59.999999994S')
  })

  it('total works past MAX_VALUE nanoseconds', () => {
    expect(new Duration({ seconds: 1e300 }).total('seconds')).toBe(1e300)
    expect(new Duration({ years: 1e292 }).total('years')).toBe(1e292)
    expect(new Duration({ quarters: 1e308 }).total('quarters')).toBe(1e308)
    expect(new Duration(Number.MAX_VALUE).total('days') / (Number.MAX_VALUE / 86_400_000)).toBe(1)
    expect(new Duration({ years: 1e308 }).total('milliseconds')).toBe(Infinity)
    expect(new Duration(Number.MAX_VALUE).round({ largestUnit: 'milliseconds' }).milliseconds).toBe(
      Number.MAX_VALUE
    )
  })

  it('folds quarters into months in bigint', () => {
    expect(new Duration({ quarters: 2 ** 52 + 1 }).toISOString()).toBe('P13510798882111491M')
    expect(new Duration({ quarters: 1e308 }).toISOString()).toBe(`P3${'0'.repeat(308)}M`)
    expect(new Duration({ quarters: 1e308 }).format('en')).toBe(`P3${'0'.repeat(308)}M`)
  })
})

describe('Duration.format with values past the Intl.DurationFormat range', () => {
  it('falls back to ISO 8601, as engines without the API do', () => {
    expect(new Duration({ years: 2 ** 32 }).format('en')).toBe('P4294967296Y')
    expect(Duration.from('P9007199254740991Y').format('en')).toBe('P9007199254740991Y')
    expect(new Duration({ days: 1e16 }).format('en')).toBe('P10000000000000000D')
    expect(new Duration(Number.MAX_VALUE).format('en')).toBe(
      new Duration(Number.MAX_VALUE).toISOString()
    )
  })

  it('still rejects a bad tag, with or without the API', () => {
    const native = Reflect.get(Intl, 'DurationFormat') as unknown
    const d = new Duration({ hours: 1 })
    expect(() => d.format('not a locale')).toThrow(RangeError)
    expect(() => d.format('a'.repeat(256))).toThrow(/255/)
    try {
      Reflect.deleteProperty(Intl, 'DurationFormat')
      expect(d.format('en')).toBe('PT1H')
      expect(() => d.format('not a locale')).toThrow(RangeError)
      expect(() => d.format('a'.repeat(256))).toThrow(/255/)
    } finally {
      Object.defineProperty(Intl, 'DurationFormat', {
        value: native,
        configurable: true,
        writable: true
      })
    }
  })
})

describe('Duration input shapes', () => {
  it('rejects objects that are not field bags', () => {
    class Fields {
      hours = 1
    }
    for (const input of [new Date(0), new Map([['hours', 1]]), new Fields()]) {
      expect(() => new Duration(input as never)).toThrow(ValueError)
      expect(() => Duration.from(input as never)).toThrow(ValueError)
    }
    expect(new Duration({}).toISOString()).toBe('PT0S')
    expect(new Duration(Object.create(null) as DurationObject).toISOString()).toBe('PT0S')
    expect(new Duration(JSON.parse('{"hours":1}') as DurationObject).toISOString()).toBe('PT1H')
    expect(new Duration(runInNewContext('({ hours: 1 })') as DurationObject).hours).toBe(1)
  })

  it('requires an operand in from, add, and subtract', () => {
    const d = new Duration({ hours: 1 })
    const missing = undefined as never
    expect(() => Duration.from(missing)).toThrow(ValueError)
    expect(() => d.add(missing)).toThrow(ValueError)
    expect(() => d.subtract(missing)).toThrow(ValueError)
    expect(new Duration(undefined).toISOString()).toBe('PT0S')
  })

  it('reads a Duration from another copy of the library', async () => {
    vi.resetModules()
    const { Duration: Foreign } = await import('../src/i18n/duration.js')
    expect(Foreign).not.toBe(Duration)
    const foreign = new Foreign({ hours: 1 }, true)
    expect(new Duration(foreign).toObject()).toEqual({ hours: 1 })
    expect(Duration.from(foreign).toISOString()).toBe('PT1H')
    expect(new Duration({ hours: 1 }).add(foreign).toObject()).toEqual({ hours: 2 })
    expect(new Duration(new Foreign({ months: 1 }, true)).total('days')).toBe(30.436875)
    expect(eq(new Duration({ hours: 1 }), foreign)).toBe(true)
    expect(deepEqual(new Duration({ hours: 2 }), foreign)).toBe(false)
  })
})
