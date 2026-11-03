import { afterEach, describe, expect, it, vi } from 'vitest'
import { ValueError } from '../src/globals/index.js'
import { Duration } from '../src/i18n/duration.js'

describe('Duration', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

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

  it('SPEC-R94 format falls back to toISOString when DurationFormat is absent', () => {
    vi.stubGlobal('Intl', { ...Intl, DurationFormat: undefined })
    const d = new Duration({ hours: 1, minutes: 30 })
    expect(d.format('en')).toBe(d.toISOString())
    expect(d.format('en')).toBe('PT1H30M')
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
