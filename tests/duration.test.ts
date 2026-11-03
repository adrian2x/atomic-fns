import { describe, expect, it } from 'vitest'
import { ValueError } from '../src/globals/index.js'
import { Duration } from '../src/i18n/duration.js'

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
    expect(new Duration({ quarters: 0.5 }).format('en')).toBe('1 mth, 2 wks')
  })

  it('SPEC-R94 format carries fractional milliseconds into microseconds and nanoseconds', () => {
    expect(new Duration({ milliseconds: 1.5 }).format('en', { style: 'long' })).toBe(
      '1 millisecond, 500 microseconds'
    )
    expect(new Duration({ milliseconds: 1.000001 }).format('en', { style: 'long' })).toBe(
      '1 millisecond, 1 nanosecond'
    )
    expect(new Duration({ milliseconds: 0.0000004 }).format('en', { style: 'long' })).toBe('')
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
})
