import { describe, expect, it } from 'vitest'
import { ValueError } from '../src/globals/index.js'
import { Duration, type DurationObject, type DurationUnit } from '../src/i18n/duration.js'

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
    const before = { ...d.values }
    const n = d.normalize()
    expect(d.values).toEqual(before)
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
    expect(() => new Duration('P1D' as unknown as number)).toThrow(/use Duration\.fromISO/)
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

  it("SPEC-R94 fromISO('P') throws ValueError", () => {
    expect(() => Duration.fromISO('P')).toThrow(ValueError)
    expect(() => Duration.fromISO('-P')).toThrow(ValueError)
  })

  it('SPEC-R94 fromISO parses a valid duration', () => {
    expect(Duration.fromISO('P1DT2H').toObject()).toEqual({ days: 1, hours: 2 })
    expect(Duration.fromISO('PT30M').minutes).toBe(30)
  })

  it("SPEC-R94 format('en') uses Intl.DurationFormat", () => {
    expect(new Duration({ hours: 1, minutes: 30 }).format('en')).toBe('1 hr, 30 min')
  })

  it('SPEC-R94 values is frozen and the Duration is immutable', () => {
    const d = new Duration({ years: 2, hours: 3 })
    expect(Object.isFrozen(d.values)).toBe(true)
    expect(() => {
      // @ts-expect-error values is readonly
      d.values.years = 9
    }).toThrow(TypeError)
    expect(() => {
      // @ts-expect-error values is readonly
      d.values.days = 1
    }).toThrow(TypeError)
    expect(d.years).toBe(2)
    expect(d.days).toBe(0)
    expect(d.toObject()).toEqual({ years: 2, hours: 3 })
  })

  it('SPEC-R94 values does not alias the constructor input or other Durations', () => {
    const input = { hours: 1 }
    const d = new Duration(input)
    input.hours = 5
    expect(d.hours).toBe(1)

    const copy = new Duration(d)
    expect(copy.values).not.toBe(d.values)
    expect(Object.isFrozen(copy.values)).toBe(true)

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

  it('SPEC-R94 format throws RangeError on mixed signs', () => {
    expect(() => new Duration({ hours: 1, minutes: -30 }).format('en')).toThrow(RangeError)
    expect(() => new Duration({ hours: 1, minutes: -30 }).format('en')).toThrow(
      'cannot format a duration with mixed signs'
    )
    expect(() => new Duration({ years: -1, quarters: 1 }).format('en')).toThrow(RangeError)
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

  it('SPEC-R94 rescale and totals', () => {
    expect(
      new Duration({ days: 14 })
        .subtract(new Duration(7 * 86_400_000).rescale())
        .rescale()
        .toISOString()
    ).toBe('P1W')
    const exactYear = new Duration({ years: 100 }, true)
      .subtract(new Duration(7 * 86_400_000).rescale())
      .rescale()
      .toObject()
    expect(exactYear).toEqual({
      years: 99,
      months: 11,
      weeks: 3,
      days: 2,
      hours: 10,
      minutes: 29,
      seconds: 6
    })
    for (const v of Object.values(exactYear)) {
      expect(Number.isInteger(v)).toBe(true)
    }
    expect(new Duration({ hours: 2.3 }).rescale().toObject()).toEqual({ hours: 2, minutes: 18 })
    expect(new Duration(-1500).rescale().toObject()).toEqual({ seconds: -1, milliseconds: -500 })
    expect(new Duration({ minutes: -90 }).rescale().toObject()).toEqual({
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

  it('SPEC-R94 fromISO accept vectors', () => {
    expect(Duration.fromISO('P0D').toISOString()).toBe('PT0S')
    expect(Duration.fromISO('PT0S').toISOString()).toBe('PT0S')
    expect(Duration.fromISO('-PT0S').toISOString()).toBe('PT0S')
    expect(Duration.fromISO('+P1D').toObject()).toEqual({ days: 1 })
    expect(Duration.fromISO('-P1DT2H').toObject()).toEqual({ days: -1, hours: -2 })
    expect(Duration.fromISO('p1d').toObject()).toEqual({ days: 1 })
    expect(Duration.fromISO('P1dT2h').toObject()).toEqual({ days: 1, hours: 2 })
    expect(Duration.fromISO('pt1h').toObject()).toEqual({ hours: 1 })
    expect(Duration.fromISO('PT1,5H').toObject()).toEqual({ hours: 1.5 })
    expect(Duration.fromISO('PT1.5S').toObject()).toEqual({ seconds: 1.5 })
    expect(Duration.fromISO('P1W2D').toObject()).toEqual({ weeks: 1, days: 2 })
    expect(Duration.fromISO('PT0.123456789S').toISOString()).toBe('PT0.123456789S')
    expect(Duration.fromISO('PT0.0001S').toISOString()).toBe('PT0.0001S')
    expect(Duration.fromISO('PT0.000000001S').toISOString()).toBe('PT0.000000001S')
    expect(Duration.fromISO('PT0.999999999S').toISOString()).toBe('PT0.999999999S')
    expect(() => Duration.fromISO('PT59.999999999M')).not.toThrow()
    expect(() => Duration.fromISO('PT0.999999999H')).not.toThrow()
    expect(() => Duration.fromISO('PT9007199254740991S')).not.toThrow()
    expect(new Duration({ milliseconds: 4e-7 }).toISOString()).toBe('PT0S')
    expect(new Duration({ milliseconds: -4e-7 }).toISOString()).toBe('PT0S')
    expect(new Duration({ seconds: 1e-9 }).toISOString()).toBe('PT0.000000001S')
  })

  it('SPEC-R94 fromISO reject vectors', () => {
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
      'P1M1Y',
      'PT1000000000000.123456789S'
    ]) {
      expect(() => Duration.fromISO(s)).toThrow(ValueError)
    }
    const long = 'x'.repeat(100)
    let message = ''
    try {
      Duration.fromISO(long)
    } catch (e) {
      message = e instanceof Error ? e.message : ''
    }
    expect(message.length).toBe(71)
    expect(message.endsWith('..."')).toBe(true)
  })

  it('SPEC-R94 fromISO round trip', () => {
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
      const once = Duration.fromISO(s).toISOString()
      expect(Duration.fromISO(once).toISOString()).toBe(once)
    }
    expect(() => Duration.fromISO(new Duration({ milliseconds: 1e21 }).toISOString())).toThrow(
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
    expect(new Duration({ minutes: 59.9999999999 }).format('en')).toBe('60 min')
    expect(new Duration({ hours: -1, minutes: -30 }).format('en')).toBe('-1 hr, 30 min')
    expect(new Duration({}).format('en')).toBe('0 sec')
    expect(() => new Duration({ hours: 1, minutes: -30 }).format('en')).toThrow(RangeError)
    expect(new Duration({}).format('en', { style: 'digital' })).toBe('0:00:00')
    expect(() => new Duration({ days: 1e16 }).format('en')).toThrow(RangeError)
  })

  it('SPEC-R94 instance is frozen', () => {
    expect(Object.isFrozen(new Duration({ hours: 1 }))).toBe(true)
  })
})
