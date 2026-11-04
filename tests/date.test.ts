import vm from 'node:vm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  addDuration,
  asDate,
  dayOfYear,
  daysInMonth,
  daysInYear,
  IntlDate,
  isLeapYear,
  lastDayOfMonth,
  maxDate,
  minDate,
  weekOfYear,
  weeksInYear,
  type DurationObject
} from '../src/i18n/date/index.js'
import { Duration } from '../src/i18n/duration.js'
import { compare, eq } from '../src/operators/index.js'
import { protocol } from '../src/operators/protocol.js'
import { ValueError } from '../src/globals/index.js'

vi.useFakeTimers()
// 08:00Z is June 15 in every zone in npm run test:tz (Kiritimati UTC+14 through LA UTC-7)
vi.setSystemTime(new Date('2026-06-15T08:00:00Z'))

const mockDate = (
  val?: ConstructorParameters<typeof IntlDate>[0],
  { utc = false, locale = 'en-US' } = {}
) => new IntlDate(val, { locale, utc })

describe('IntlDate', () => {
  it('now uses fixed system time', () => {
    const testDate = mockDate()
    expect(testDate.year).toBe(2026)
    expect(testDate.month).toBe(6)
    expect(testDate.day).toBe(15)
  })

  it('SPEC-R92 UTC view reads UTC fields of the current instant', () => {
    const date = new Date('2026-06-15T08:00:00Z')
    const testDate = IntlDate.UTC(undefined)
    expect(testDate.year).toBe(date.getUTCFullYear())
    expect(testDate.month).toBe(date.getUTCMonth() + 1)
    expect(testDate.day).toBe(date.getUTCDate())
    expect(testDate.hour).toBe(date.getUTCHours())
    expect(testDate.minute).toBe(date.getUTCMinutes())
    expect(testDate.second).toBe(date.getUTCSeconds())
  })

  it('clone', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date)
    expect(testDate.isSame(testDate.clone())).toBe(true)
    expect(testDate.clone().isSame(date)).toBe(true)
  })

  it('isValid', () => {
    expect(mockDate().isValid()).toBe(true)
    expect(mockDate('').isValid()).toBe(false)
    expect(mockDate(null).isValid()).toBe(false)
    expect(Number.isNaN(mockDate(null).getTime())).toBe(true)
  })

  it('SPEC-R92 seconds via explicit UTC (not TZ-dependent)', () => {
    const date = IntlDate.UTC(IntlDate.unix(946684800))
    expect(date.year).toBe(2000)
    expect(date.month).toBe(1)
    expect(date.day).toBe(1)
    expect(date.hour).toBe(0)
    expect(date.dayOfWeek).toBe(6)
    expect(date.dayOfYear()).toBe(1)
  })

  it('create from Object', () => {
    const date = mockDate({ year: 1964, month: 7, day: 2 })
    expect(date.year).toBe(1964)
    expect(date.month).toBe(7)
    expect(date.day).toBe(2)
  })

  it('SPEC-R92 partial object defaults month and day to 1', () => {
    const date = new IntlDate({ year: 2022 })
    expect(date.isValid()).toBe(true)
    expect(date.year).toBe(2022)
    expect(date.month).toBe(1)
    expect(date.day).toBe(1)
  })

  it('SPEC-R92 year 50 is literal, not 1950', () => {
    const date = new IntlDate({ year: 50, month: 1, day: 1 })
    expect(date.year).toBe(50)
  })

  it('SPEC-R92 UTC instant equality across input types', () => {
    const epoch = new Date(0)
    expect(IntlDate.UTC(epoch).getTime()).toBe(0)
    expect(IntlDate.UTC(0).getTime()).toBe(0)
    expect(IntlDate.UTC('1970-01-01T00:00:00.000Z').getTime()).toBe(0)
    const noon = IntlDate.UTC('2022-06-01T12:00:00')
    expect(noon.hour).toBe(12)
    expect(noon.getTime()).toBe(Date.UTC(2022, 5, 1, 12, 0, 0))
  })

  it('create from string', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date.toISOString())
    expect(testDate.year).toBe(1964)
    expect(testDate.month).toBe(7)
    expect(testDate.day).toBe(2)
  })

  it('toDate', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date.toISOString())
    expect(testDate.toDate()).toBeInstanceOf(Date)
    expect(testDate.toDate().getTime()).toBe(date.getTime())
  })

  it('timestamp', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date.toISOString())
    expect(testDate.timestamp()).toBe(testDate.toSeconds())
    expect(testDate.timestamp()).toBe(testDate.unix())
  })

  it('toSeconds floors positive epochs', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date.toISOString())
    expect(testDate.toSeconds()).toBe(Math.floor(date.getTime() / 1000))
  })

  it('SPEC-R95 toSeconds floors negatives', () => {
    expect(new IntlDate(-1500).toSeconds()).toBe(-2)
  })

  it('toISOString', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date.toISOString())
    expect(testDate.toISOString()).toBe(date.toISOString())
  })

  it('toISODate', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date.toISOString())
    expect(testDate.toISODate()).toBe(date.toISOString().slice(0, 10))
  })

  it('toISOTime', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate(date.toISOString())
    expect(testDate.toISOTime()).toBe(date.toISOString().slice(11))
  })

  it('toString', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate('1964-07-02')
    expect(testDate.toString()).toBe(date.toLocaleString('en-US'))
  })

  it('inspect', () => {
    const date = IntlDate.UTC(IntlDate.unix(946684800))
    expect(date.inspect()).toBe('new IntlDate("2000-01-01T00:00:00.000Z")')
  })

  it('toObject', () => {
    const obj = mockDate().toObject()
    expect(obj.year).toBe(2026)
    expect(obj.month).toBe(6)
    expect(obj.day).toBe(15)
  })

  it('isLeapYear', () => {
    let testDate = mockDate('2020-02-29')
    expect(testDate.isLeapYear()).toBe(true)
    expect(testDate.month).toBe(2)
    expect(testDate.day).toBe(29)

    testDate = mockDate('2016-02-29')
    expect(testDate.isLeapYear()).toBe(true)
    expect(testDate.month).toBe(2)
    expect(testDate.day).toBe(29)
  })

  it('daysInMonth', () => {
    const date = new Date(2020, 1, 1, 16, 1, 1, 1)
    const d = mockDate(date, { utc: true })
    expect(d.daysInMonth()).toBe(29)
  })

  it('daysInYear', () => {
    const date = new Date(2020, 1, 1, 16, 1, 1, 1)
    const d = mockDate(date, { utc: true })
    expect(d.daysInYear()).toBe(366)
  })

  it('weeksInYear', () => {
    // Absolute instant so the UTC wall date is 2020-02-01 in every host TZ
    const d = mockDate(new Date(Date.UTC(2020, 1, 1, 16, 1, 1, 1)), { utc: true })
    expect(d.week()).toBe(5)
    expect(d.isoWeek()).toBe(5)
    expect(d.weeksInYear()).toBe(52)
    expect(d.isoWeeksInYear()).toBe(53)
    expect(d.weekYear()).toBe(2020)
    expect(d.isoWeekYear()).toBe(2020)
  })

  it('isBefore', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate('1964-07-02')
    expect(testDate.isBefore(date)).toBe(false)
    expect(testDate.isBefore(new Date())).toBe(true)
  })

  it('isAfter', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate()
    expect(testDate.isAfter(date)).toBe(true)
    expect(testDate.isAfter(new Date())).toBe(false)
  })

  it('isSame', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate('1964-07-02')
    expect(testDate.isSame(testDate)).toBe(true)
    expect(testDate.isSame(date)).toBe(true)
  })

  it('SPEC-R95 isSame compares instants only across locales', () => {
    const a = new IntlDate('2020-01-15T12:00:00Z', { locale: 'en-US' })
    const b = new IntlDate('2020-01-15T12:00:00Z', { locale: 'ja-JP' })
    expect(a.isSame(b)).toBe(true)
    expect(a.eq(b)).toBe(true)
  })

  it('compare', () => {
    const date = new Date(1964, 6, 2)
    const testDate = mockDate('1964-07-02')
    expect(testDate.compare(testDate)).toBe(0)
    expect(testDate.compare(date)).toBe(0)
    expect(testDate.compare(new Date())).toBeLessThan(0)
    expect(mockDate().compare(date)).toBeGreaterThan(0)
  })

  it('SPEC-R95 invalid date compare: invalid after valid; two invalid kind tie-break', () => {
    const valid = mockDate('2020-01-01')
    const invalidA = mockDate(null)
    const invalidB = mockDate('')
    expect(invalidA[protocol.compare](valid)).toBe(1)
    expect(valid[protocol.compare](invalidA)).toBe(-1)
    expect(invalidA[protocol.compare](invalidB)).toBeUndefined()
    expect(() => compare(invalidA, invalidB)).not.toThrow()
    expect(compare(invalidA, invalidB)).not.toBeNaN()
    expect(eq(invalidA, invalidB)).toBe(false)
  })

  it('min', () => {
    const start = new Date(1964, 6, 2)
    const end = mockDate()
    expect(IntlDate.min([start, end])).toBe(start)
  })

  it('max', () => {
    const start = new Date(1964, 6, 2)
    const end = mockDate()
    expect(IntlDate.max([start, end])).toBe(end)
  })

  it('SPEC-R85 diff in quarters is month diff / 3 truncated toward zero', () => {
    const jul = mockDate('2022-07-01')
    const jan = mockDate('2022-01-01')
    expect(jul.diff(jan, 'quarters')).toBe(2)
    expect(jan.diff(jul, 'quarters')).toBe(-2)
    expect(jul.diff(jan, 'quarter')).toBe(2)
    expect(mockDate('2022-03-01').diff(jan, 'quarters')).toBe(0)
    expect(Object.is(mockDate('2022-03-01').diff(jan, 'quarters'), 0)).toBe(true)
    expect(jul.diff(jan, 'months')).toBe(6)
  })

  it('diff across full Date range stays finite for calendar units', () => {
    const lo = new IntlDate(-8.64e15)
    const hi = new IntlDate(8.64e15)
    for (const unit of ['months', 'weeks', 'years', 'quarters'] as const) {
      for (const exact of [false, true]) {
        const fwd = lo.diff(hi, unit, exact)
        const back = hi.diff(lo, unit, exact)
        expect(Number.isFinite(fwd)).toBe(true)
        expect(Number.isFinite(back)).toBe(true)
        expect(Number.isNaN(fwd)).toBe(false)
        if (!exact) {
          expect(fwd).toBe(-back)
        }
      }
    }
  })

  it('SPEC-R95 min/max parse strings like the constructor', () => {
    expect(IntlDate.min(['2022-03-01', '2021-12-31', '2022-01-01'])).toBe('2021-12-31')
    expect(IntlDate.max(['2022-03-01', '2021-12-31', '2022-01-01'])).toBe('2022-03-01')
    expect(IntlDate.min(['2022-03-01', new Date(2022, 0, 1)])).toStrictEqual(new Date(2022, 0, 1))
    expect(IntlDate.max([new Date(2022, 0, 1), '2022-03-01'])).toBe('2022-03-01')
    // lexical order of these strings differs from chronological order
    expect(IntlDate.min(['2022-1-15', '2022-01-02'])).toBe('2022-01-02')
    expect(IntlDate.max([0, 5, -3])).toBe(5)
    expect(IntlDate.min([0, 5, -3])).toBe(-3)
  })

  it('SPEC-R95 min/max return the original value', () => {
    const a = mockDate('2022-01-01')
    const b = mockDate('2023-01-01')
    expect(IntlDate.min([b, a])).toBe(a)
    expect(IntlDate.max([a, b])).toBe(b)
    expect(IntlDate.min([a])).toBe(a)
  })

  it('SPEC-R95 min/max of an empty list or only invalid dates is undefined', () => {
    expect(IntlDate.min([])).toBeUndefined()
    expect(IntlDate.max([])).toBeUndefined()
    expect(IntlDate.min([null, 'nope'])).toBeUndefined()
    expect(IntlDate.min([null, '2022-01-01'])).toBe('2022-01-01')
    expect(IntlDate.max(['2022-01-01', null])).toBe('2022-01-01')
  })

  it('SPEC-R85 toString honors the UTC view', () => {
    const instant = new Date('2022-01-01T02:00:00Z')
    const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false }
    const utc = new IntlDate(instant, { locale: 'en-US', utc: true }).toString(opts)
    expect(utc).toBe('02:00')
    const local = new IntlDate(instant, { locale: 'en-US' }).toString({ ...opts, timeZone: 'UTC' })
    expect(local).toBe('02:00')
  })

  it('SPEC-R102 internals are not exposed as properties', () => {
    const d = mockDate('2022-01-01')
    expect(Object.keys(d)).not.toContain('_date')
    expect(Object.keys(d)).not.toContain('_relativeFormat')
    expect('_date' in d).toBe(false)
    expect('_relativeFormat' in d).toBe(false)
  })

  it('startOf calendar units', () => {
    const date = mockDate('1964-07-02')
    expect(date.startOf('year').year).toBe(1964)
    expect(date.startOf('year').month).toBe(1)
    expect(date.startOf('year').day).toBe(1)
    expect(date.startOf('month').month).toBe(7)
    expect(date.startOf('month').day).toBe(1)
    expect(date.startOf('day').day).toBe(2)
    expect(date.startOf('day').hour).toBe(0)
    expect(date.startOf('day').minute).toBe(0)
    expect(date.startOf('day').second).toBe(0)
    expect(date.startOf('hour').minute).toBe(0)
    expect(date.startOf('hour').second).toBe(0)
    expect(date.startOf('minute').second).toBe(0)
    expect(date.startOf('minute').millisecond).toBe(0)
    expect(date.startOf('second').millisecond).toBe(0)
  })

  it('SPEC-R88 startOf week uses locale first day; isoWeek is Monday', () => {
    const wed = mockDate(new Date(2024, 0, 10, 15, 30, 0))
    const start = wed.startOf('week')
    expect(start.year).toBe(2024)
    expect(start.month).toBe(1)
    expect(start.day).toBe(7)
    expect(start.dayOfWeek).toBe(7)
    expect(start.hour).toBe(0)
    expect(start.minute).toBe(0)
    expect(start.second).toBe(0)
    expect(start.millisecond).toBe(0)

    const iso = wed.startOf('isoWeek')
    expect(iso.year).toBe(2024)
    expect(iso.month).toBe(1)
    expect(iso.day).toBe(8)
    expect(iso.dayOfWeek).toBe(1)
  })

  it('SPEC-R88 startOf unknown unit throws ValueError', () => {
    expect(() => mockDate().startOf('fortnight' as 'day')).toThrow(ValueError)
  })

  it('set unknown units throw ValueError (incl. former UNITS_SINGULAR aliases)', () => {
    const d = mockDate('2022-01-15')
    const asFields = (o: Record<string, number>) => o as Parameters<IntlDate['set']>[0]
    expect(d.set(asFields({ years: 2023 })).year).toBe(2023)
    expect(d.set(asFields({ milliseconds: 42 })).millisecond).toBe(42)
    for (const key of ['weeknumber', 'weekyear', 'ordinal', 'quarter', 'quarters', 'fortnight']) {
      expect(() => d.set(asFields({ [key]: 1 }))).toThrow(ValueError)
      expect(() => d.set(asFields({ [key]: 1 }))).toThrow(/unknown date field/)
    }
  })

  it('endOf calendar units', () => {
    const date = mockDate('2020-02-29')
    expect(date.endOf('year').year).toBe(2020)
    expect(date.endOf('year').month).toBe(12)
    expect(date.endOf('year').day).toBe(31)
    expect(date.endOf('month').month).toBe(2)
    expect(date.endOf('month').day).toBe(29)
    expect(date.endOf('day').day).toBe(29)
    expect(date.endOf('day').hour).toBe(23)
    expect(date.endOf('day').minute).toBe(59)
    expect(date.endOf('day').second).toBe(59)
    expect(date.endOf('hour').minute).toBe(59)
    expect(date.endOf('hour').second).toBe(59)
    expect(date.endOf('minute').second).toBe(59)
    expect(date.endOf('minute').millisecond).toBe(999)
    expect(date.endOf('second').millisecond).toBe(999)
  })

  it('SPEC-R88 endOf week and month-end', () => {
    const wed = mockDate(new Date(2024, 0, 10, 15, 30, 0))
    const endWeek = wed.endOf('week')
    expect(endWeek.year).toBe(2024)
    expect(endWeek.month).toBe(1)
    expect(endWeek.day).toBe(13)
    expect(endWeek.hour).toBe(23)
    expect(endWeek.minute).toBe(59)
    expect(endWeek.second).toBe(59)
    expect(endWeek.millisecond).toBe(999)

    const endIso = wed.endOf('isoWeek')
    expect(endIso.year).toBe(2024)
    expect(endIso.month).toBe(1)
    expect(endIso.day).toBe(14)
    expect(endIso.hour).toBe(23)
    expect(endIso.minute).toBe(59)
    expect(endIso.second).toBe(59)
    expect(endIso.millisecond).toBe(999)

    const jan31 = mockDate(new Date(2022, 0, 31, 12, 0, 0))
    const endMonth = jan31.endOf('month')
    expect(endMonth.year).toBe(2022)
    expect(endMonth.month).toBe(1)
    expect(endMonth.day).toBe(31)
    expect(endMonth.hour).toBe(23)
    expect(endMonth.minute).toBe(59)
    expect(endMonth.second).toBe(59)
    expect(endMonth.millisecond).toBe(999)
  })

  it('SPEC-R89 month clamp table', () => {
    expect(
      mockDate(new Date(2023, 0, 31))
        .add({ months: 1 })
        .toObject()
    ).toMatchObject({
      year: 2023,
      month: 2,
      day: 28
    })
    expect(
      mockDate(new Date(2024, 1, 29))
        .add({ years: 1 })
        .toObject()
    ).toMatchObject({
      year: 2025,
      month: 2,
      day: 28
    })
    expect(
      mockDate(new Date(2023, 0, 31))
        .set({ month: 2 })
        .toObject()
    ).toMatchObject({
      year: 2023,
      month: 2,
      day: 28
    })
    const base = mockDate(new Date(2023, 0, 31, 12, 0, 0))
    expect(base.add({ days: 1, months: 1 }).getTime()).toBe(
      base.add({ months: 1, days: 1 }).getTime()
    )
  })

  it('SPEC-R89 add on invalid IntlDate returns invalid', () => {
    const invalid = mockDate(null)
    const result = invalid.add({ days: 1 })
    expect(result.isValid()).toBe(false)
  })

  it('SPEC-R91 fractional time units vs calendar ValueError', () => {
    const noon = mockDate(new Date(2024, 0, 1, 12, 0, 0))
    expect(noon.add({ hours: 1.5 }).hour).toBe(13)
    expect(noon.add({ hours: 1.5 }).minute).toBe(30)
    expect(noon.subtract({ hours: 1.5 }).hour).toBe(10)
    expect(noon.subtract({ hours: 1.5 }).minute).toBe(30)
    expect(() => noon.add({ days: 1.5 })).toThrow(ValueError)
  })

  it('diff', () => {
    const start = mockDate('2021-01-15')
    const end = start.add({ years: 1 })
    expect(end.isAfter(start)).toBe(true)
    expect(start.isBefore(end)).toBe(true)
    expect(end.diff(start, 'years')).toBe(1)
    expect(end.diff(start, 'months')).toBe(12)
    expect(end.diff(start, 'days')).toBe(365)
    expect(end.diff(start, 'days', true)).toBe(365)
  })

  it('SPEC-R89 leap day plus one year clamps to Feb 28', () => {
    const start = mockDate('2020-02-29')
    const end = start.add({ years: 1 })
    expect(end.year).toBe(2021)
    expect(end.month).toBe(2)
    expect(end.day).toBe(28)
  })

  it('to', () => {
    const date = new Date(1964, 6, 2, 2, 30, 0, 0)
    const start = mockDate(date)
    const end = mockDate('2020-02-29')
    expect(start.to(end, 'years')).toBe('in 55 years')
    expect(end.to(start, 'years')).toBe('55 years ago')
  })

  it('from', () => {
    const date = new Date(1964, 6, 2, 2, 30, 0, 0)
    const start = mockDate(date)
    const end = mockDate('2020-02-29')
    expect(start.from(end, 'years')).toBe('55 years ago')
    expect(end.from(start, 'years')).toBe('in 55 years')
  })

  it('toNow', () => {
    const now = mockDate()
    const start = now.subtract({ years: 33 })
    expect(start.toNow('years')).toBe('in 33 years')
  })

  it('fromNow', () => {
    const now = mockDate()
    const start = now.subtract({ years: 33 })
    expect(start.fromNow('years')).toBe('33 years ago')
  })

  it('add applies units largest-first', () => {
    const date = new Date(1964, 6, 2, 2, 30, 0, 0)
    const start = mockDate(date)
    const end = start.add({ years: 5, months: 5, days: 30 })
    expect(end.isAfter(start)).toBe(true)
    expect(start.isBefore(end)).toBe(true)
    expect(end.year).toBe(1970)
    expect(end.month).toBe(1)
    expect(end.day).toBe(1)
  })

  it('subtract applies units largest-first', () => {
    const date = new Date(1970, 0, 1, 1, 30, 0, 0)
    const start = mockDate(date)
    const end = start.subtract({ years: 5, months: 5, days: 30 })
    expect(end.isBefore(start)).toBe(true)
    expect(start.isAfter(end)).toBe(true)
    expect(end.year).toBe(1964)
    expect(end.month).toBe(7)
    expect(end.day).toBe(2)
  })

  it('SPEC-R95 relativeFormat is cached once per instance', () => {
    const d = mockDate()
    expect(d.relativeFormat).toBe(d.relativeFormat)
  })

  it('SPEC-R95 protocol rank is 5', () => {
    expect(mockDate()[protocol.rank]).toBe(5)
  })
})

describe('SPEC-R90 DST-correct arithmetic America/New_York', () => {
  const prev = process.env.TZ
  beforeAll(() => {
    process.env.TZ = 'America/New_York'
  })
  afterAll(() => {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  })

  it('SPEC-R90 spring calendar day keeps wall clock; hour add is exact ms', () => {
    const spring = new IntlDate(new Date(2024, 2, 9, 12, 0, 0))
    const nextDay = spring.add({ days: 1 })
    expect(nextDay.year).toBe(2024)
    expect(nextDay.month).toBe(3)
    expect(nextDay.day).toBe(10)
    expect(nextDay.hour).toBe(12)

    const gap = new IntlDate(new Date(2024, 2, 10, 1, 30, 0))
    const plusHour = gap.add({ hours: 1 })
    expect(plusHour.hour).toBe(3)
    expect(plusHour.minute).toBe(30)
  })

  it('SPEC-R90 fall calendar day keeps wall clock', () => {
    const fall = new IntlDate(new Date(2023, 10, 4, 12, 0, 0))
    const nextDay = fall.add({ days: 1 })
    expect(nextDay.year).toBe(2023)
    expect(nextDay.month).toBe(11)
    expect(nextDay.day).toBe(5)
    expect(nextDay.hour).toBe(12)
  })

  it('SPEC-R90 DST gap after calendar add resolves forward', () => {
    const before = new IntlDate(new Date(2024, 2, 9, 2, 30, 0))
    const after = before.add({ days: 1 })
    expect(after.hour).toBe(3)
    expect(after.minute).toBe(30)
  })

  it('SPEC-R95 utcOffset is local minus UTC (winter)', () => {
    const winter = new IntlDate(new Date(2024, 0, 15, 12, 0, 0))
    expect(winter.utcOffset()).toBe(-300)
  })

  it('SPEC-R93 date-only utils parse as local', () => {
    expect(daysInMonth('2022-03-01')).toBe(31)
    expect(dayOfYear('2022-03-01')).toBe(60)
    expect(weekOfYear('2022-03-01').week).toBeGreaterThan(0)
  })
})

describe('date utils coverage', () => {
  it('minDate/maxDate empty, mixed, and invalid inputs', () => {
    expect(minDate([] as (string | number | Date | null)[])).toBe(undefined)
    expect(maxDate([] as (string | number | Date | null)[])).toBe(undefined)
    expect(minDate([null, 'nope', Number.NaN])).toBe(undefined)
    expect(maxDate([null, 'nope', Number.NaN])).toBe(undefined)

    const early = new Date(2020, 0, 1)
    const late = new Date(2022, 5, 15)
    expect(minDate([late, '2021-06-01', early.getTime()])).toBe(early.getTime())
    expect(maxDate([early, '2021-06-01', late])).toBe(late)
    expect(minDate(['2022-03-01', early, 0])).toBe(0)
    expect(maxDate([null, early, 'nope'])).toBe(early)
  })

  it('isLeapYear/daysInYear century rules', () => {
    expect(isLeapYear(1900)).toBe(false)
    expect(isLeapYear(2000)).toBe(true)
    expect(isLeapYear(2100)).toBe(false)
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2023)).toBe(false)
    expect(daysInYear(1900)).toBe(365)
    expect(daysInYear(2000)).toBe(366)
    expect(daysInYear(2100)).toBe(365)
  })

  it('daysInMonth leap February and string/number/Date inputs', () => {
    expect(daysInMonth('2024-02-15')).toBe(29)
    expect(daysInMonth('2023-02-15')).toBe(28)
    expect(daysInMonth(new Date(2024, 1, 10))).toBe(29)
    expect(daysInMonth(new Date(2023, 1, 10).getTime())).toBe(28)
  })

  it('weeksInYear rejects non-integer; weekOfYear/dayOfYear invalid and utc', () => {
    expect(() => weeksInYear(2020.5)).toThrow(RangeError)
    expect(() => weeksInYear(Number.NaN)).toThrow(RangeError)
    expect(weekOfYear(new Date(Number.NaN))).toEqual({ week: Number.NaN, year: Number.NaN })
    expect(weekOfYear('nope', 1, 4, true)).toEqual({ week: Number.NaN, year: Number.NaN })
    expect(dayOfYear(new Date(Number.NaN))).toBeNaN()
    expect(dayOfYear('nope', true)).toBeNaN()
    const instant = new Date('2022-01-01T02:00:00Z')
    expect(weekOfYear(instant, 1, 4, true).year).toBe(2021)
    expect(dayOfYear(instant, true)).toBe(1)
  })
})

describe('SPEC-R85 IntlDate UTC view America/New_York', () => {
  const prev = process.env.TZ
  beforeAll(() => {
    process.env.TZ = 'America/New_York'
  })
  afterAll(() => {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  })

  it('SPEC-R85 format reads UTC fields with a zero offset', () => {
    const d = IntlDate.UTC('2022-01-05T13:07:09Z')
    expect(d.format('Z')).toBe('+00:00')
    expect(d.format('ZZ')).toBe('+0000')
    expect(d.format('HH:mm:ss')).toBe('13:07:09')
    expect(d.format('X')).toBe(String(d.toSeconds()))
    expect(d.format('x')).toBe(String(d.getTime()))
  })

  it('SPEC-R85 local view of the same instant keeps the local offset', () => {
    const d = new IntlDate('2022-01-05T13:07:09Z')
    expect(d.format('Z')).toBe('-05:00')
    expect(d.format('HH:mm')).toBe('08:07')
    expect(d.format('X')).toBe(String(d.toSeconds()))
  })

  it('SPEC-R85 UTC wall time in a local DST gap is not shifted', () => {
    expect(IntlDate.UTC('2024-03-10T02:30:00Z').format('HH:mm')).toBe('02:30')
    expect(IntlDate.UTC('2024-03-10T02:30:00Z').hour).toBe(2)
  })

  it('SPEC-R85 zone helpers and week fields use the UTC view', () => {
    const d = IntlDate.UTC('2024-03-10T02:30:00Z', 'en')
    expect(d.zone()).toBe('+0000')
    expect(d.zoneName()).toBe('Coordinated Universal Time')
    // 2022-01-01T02:00Z is still Dec 31 locally in New York
    const newYearUS = IntlDate.UTC('2022-01-01T02:00:00Z', 'en-US')
    expect(newYearUS.dayOfYear()).toBe(1)
    expect(newYearUS.week()).toBe(1)
    expect(IntlDate.UTC('2022-01-01T02:00:00Z', 'de').week()).toBe(52)
    expect(newYearUS.isoWeek()).toBe(52)
    const local = new IntlDate('2022-01-01T02:00:00Z')
    expect(local.dayOfYear()).toBe(365)
  })

  it('SPEC-R85 dayOfYear and weekOfYear utils accept a utc flag', () => {
    const instant = new Date('2022-01-01T02:00:00Z')
    expect(dayOfYear(instant)).toBe(365)
    expect(dayOfYear(instant, true)).toBe(1)
    expect(weekOfYear(instant, 1, 4, true)).toEqual({ week: 52, year: 2021 })
    expect(dayOfYear('2022-03-01', true)).toBe(60)
  })
})

function withTz(tz: string, run: () => void) {
  const prev = process.env.TZ
  process.env.TZ = tz
  try {
    run()
  } finally {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  }
}

describe('SPEC-R89/R90/R91 Temporal-consistent arithmetic', () => {
  it('B4 mixed months+days resolves wall time once (NY)', () => {
    withTz('America/New_York', () => {
      const d = new IntlDate(new Date(2021, 1, 14, 2, 30))
      expect(d.add({ months: 1, days: 1 }).toISOString()).toBe('2021-03-15T06:30:00.000Z')
    })
  })

  it('B2/B3 +1 day / -1 day gap and overlap vectors', () => {
    withTz('America/New_York', () => {
      expect(
        new IntlDate(new Date(2021, 2, 13, 2, 30)).add({ days: 1 }).format('YYYY-MM-DDTHH:mmZ')
      ).toBe('2021-03-14T03:30-04:00')
      expect(
        new IntlDate(new Date(2021, 10, 6, 1, 30)).add({ days: 1 }).format('YYYY-MM-DDTHH:mmZ')
      ).toBe('2021-11-07T01:30-04:00')
      expect(
        new IntlDate(new Date(2021, 10, 8, 1, 30)).subtract({ days: 1 }).format('YYYY-MM-DDTHH:mmZ')
      ).toBe('2021-11-07T01:30-04:00')
    })
    withTz('Australia/Lord_Howe', () => {
      expect(
        new IntlDate(new Date(2021, 9, 2, 2, 15)).add({ days: 1 }).format('YYYY-MM-DDTHH:mmZ')
      ).toBe('2021-10-03T02:45+11:00')
    })
    withTz('Europe/London', () => {
      expect(
        new IntlDate(new Date(2021, 2, 27, 1, 30)).add({ days: 1 }).format('YYYY-MM-DDTHH:mmZ')
      ).toBe('2021-03-28T02:30+01:00')
    })
    withTz('Pacific/Kiritimati', () => {
      expect(
        new IntlDate(new Date(1994, 11, 30, 12, 0)).add({ days: 1 }).format('YYYY-MM-DDTHH:mmZ')
      ).toBe('1995-01-01T12:00+14:00')
    })
  })

  it('B5 startOf/endOf/set keep offset inside repeated hour', () => {
    withTz('America/New_York', () => {
      expect(new IntlDate('2021-11-07T06:30:00Z').startOf('hour').toISOString()).toBe(
        '2021-11-07T06:00:00.000Z'
      )
      expect(new IntlDate('2021-11-07T06:30:20Z').startOf('minute').toISOString()).toBe(
        '2021-11-07T06:30:00.000Z'
      )
      expect(new IntlDate('2021-11-07T06:30:20.500Z').startOf('second').toISOString()).toBe(
        '2021-11-07T06:30:20.000Z'
      )
      expect(new IntlDate('2021-11-07T06:30:20.500Z').set({ millisecond: 0 }).toISOString()).toBe(
        '2021-11-07T06:30:20.000Z'
      )
      expect(new IntlDate('2021-11-07T06:30:00Z').endOf('hour').toISOString()).toBe(
        '2021-11-07T06:59:59.999Z'
      )
      expect(new IntlDate('2021-11-07T05:30:00Z').endOf('hour').toISOString()).toBe(
        '2021-11-07T05:59:59.999Z'
      )
    })
    withTz('Australia/Lord_Howe', () => {
      expect(new IntlDate('2021-04-03T15:15:30Z').startOf('minute').toISOString()).toBe(
        '2021-04-03T15:15:00.000Z'
      )
      expect(new IntlDate('2021-04-03T15:15:30Z').startOf('hour').toISOString()).toBe(
        '2021-04-03T14:00:00.000Z'
      )
    })
    withTz('Europe/London', () => {
      expect(new IntlDate('2021-10-31T01:30:00Z').startOf('hour').toISOString()).toBe(
        '2021-10-31T01:00:00.000Z'
      )
    })
  })

  it('B6 startOf/endOf day across skipped midnight', () => {
    withTz('America/Santiago', () => {
      expect(new IntlDate(new Date(2022, 8, 11, 12, 0)).startOf('day').toISOString()).toBe(
        '2022-09-11T04:00:00.000Z'
      )
      expect(new IntlDate(new Date(2022, 8, 10, 12, 0)).endOf('day').toISOString()).toBe(
        '2022-09-11T03:59:59.999Z'
      )
    })
    withTz('America/Sao_Paulo', () => {
      expect(new IntlDate(new Date(2018, 10, 4, 12, 0)).startOf('day').toISOString()).toBe(
        '2018-11-04T03:00:00.000Z'
      )
    })
    withTz('America/New_York', () => {
      expect(new IntlDate(new Date(2021, 2, 14, 12, 0)).endOf('day').toISOString()).toBe(
        '2021-03-15T03:59:59.999Z'
      )
      expect(new IntlDate(new Date(2021, 10, 7, 12, 0)).endOf('day').toISOString()).toBe(
        '2021-11-08T04:59:59.999Z'
      )
    })
  })

  it('B7 calendar diff across DST and relative day', () => {
    withTz('America/New_York', () => {
      const a = mockDate(new Date(2021, 2, 13))
      const b = mockDate(new Date(2021, 2, 15))
      expect(b.diff(a, 'days')).toBe(2)
      expect(mockDate(new Date(2021, 2, 15)).diff(mockDate(new Date(2021, 2, 14)), 'days')).toBe(1)
      expect(
        mockDate(new Date(2021, 2, 15)).diff(mockDate(new Date(2021, 2, 14)), 'days', true)
      ).toBe(1)
      expect(mockDate(new Date(2021, 2, 15)).diff(mockDate(new Date(2021, 2, 8)), 'weeks')).toBe(1)
      expect(mockDate(new Date(2021, 2, 15)).diff(mockDate(new Date(2021, 1, 15)), 'months')).toBe(
        1
      )
      expect(mockDate(new Date(2021, 2, 15)).from(mockDate(new Date(2021, 2, 14)), 'days')).toBe(
        'in 1 day'
      )
      expect(mockDate(new Date(2021, 10, 8)).diff(mockDate(new Date(2021, 10, 7)), 'days')).toBe(1)
    })
    withTz('Australia/Lord_Howe', () => {
      expect(mockDate(new Date(2021, 9, 4)).diff(mockDate(new Date(2021, 9, 2)), 'days')).toBe(2)
    })
    withTz('Europe/London', () => {
      expect(mockDate(new Date(2021, 2, 29)).diff(mockDate(new Date(2021, 2, 27)), 'days')).toBe(2)
    })
    withTz('Pacific/Kiritimati', () => {
      expect(mockDate(new Date(1995, 0, 1)).diff(mockDate(new Date(1994, 11, 30)), 'days')).toBe(2)
    })
  })

  it('B8 exact hours over 30-minute DST day (Lord_Howe)', () => {
    withTz('Australia/Lord_Howe', () => {
      expect(
        mockDate(new Date(2021, 9, 4)).diff(mockDate(new Date(2021, 9, 3)), 'hours', true)
      ).toBe(23.5)
    })
  })

  it('C4 Temporal calendar-correct months/quarters/years (UTC view)', () => {
    const u = (s: string) => IntlDate.UTC(s)
    expect(u('2021-03-01').diff(u('2021-02-01'), 'months')).toBe(1)
    expect(u('2021-03-01').diff(u('2021-01-01'), 'months')).toBe(2)
    expect(u('2021-03-01').diff(u('2021-02-01'), 'months', true)).toBe(1)
    expect(u('2021-02-01').diff(u('2021-01-01'), 'months', true)).toBe(1)
    expect(u('2023-05-01').diff(u('2023-02-01'), 'quarters')).toBe(1)
    expect(u('2023-01-01').diff(u('2022-01-01'), 'quarters')).toBe(4)
    expect(u('2023-05-01').diff(u('2022-02-01'), 'quarters')).toBe(5)
    expect(u('2020-02-29').diff(u('2019-03-01'), 'years')).toBe(0)
    expect(u('2399-12-01').diff(u('2000-01-01'), 'years')).toBe(399)
    expect(u('2000-01-01').diff(u('0001-01-01'), 'years')).toBe(1999)
    expect(u('2024-02-29').diff(u('2020-02-29'), 'years')).toBe(4)
    expect(u('2024-01-01').diff(u('2000-01-01'), 'years')).toBe(24)
    // Temporal trunc: clamped anchor day (Jan 31 + 1M = Feb 28 <= end)
    expect(u('2021-02-28').diff(u('2021-01-31'), 'months')).toBe(1)
    expect(u('2021-02-28').diff(u('2020-02-29'), 'years')).toBe(1)
    // Short-month clamp after time-of-day day borrow
    expect(u('2024-07-01T01:00:00').diff(u('2023-12-31T12:00:00'), 'months')).toBe(6)
    expect(u('2025-03-01T01:00:00').diff(u('2024-02-29T12:00:00'), 'years')).toBe(1)
    // Month-end clamp pairs are not antisymmetric under Temporal trunc (Jan31↔Feb28).
    for (const [a, b, unit] of [
      [u('2021-03-01'), u('2021-02-01'), 'months'],
      [u('2020-02-29'), u('2019-03-01'), 'years'],
      [u('2024-07-01T01:00:00'), u('2023-12-31T12:00:00'), 'months'],
      [u('2025-03-01T01:00:00'), u('2024-02-29T12:00:00'), 'years']
    ] as const) {
      expect(a.diff(b, unit)).toBe(zeroNegZero(-b.diff(a, unit)))
    }
  })

  it.skipIf(typeof globalThis.Temporal === 'undefined')(
    'C4 Temporal trunc months/years over 5000 random pairs',
    () => {
      function mulberry32(seed: number) {
        let a = seed >>> 0
        return () => {
          a = (a + 0x6d2b79f5) >>> 0
          let t = a
          t = Math.imul(t ^ (t >>> 15), t | 1)
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
      }

      const TemporalApi = globalThis.Temporal
      const rand = mulberry32(2024_11_03)
      const units = [
        ['months', 'month'],
        ['years', 'year']
      ] as const

      for (let i = 0; i < 5000; i++) {
        const y0 = 1995 + Math.floor(rand() * 50)
        const y1 = 1995 + Math.floor(rand() * 50)
        const m0 = 1 + Math.floor(rand() * 12)
        const m1 = 1 + Math.floor(rand() * 12)
        const d0 = 1 + Math.floor(rand() * 31)
        const d1 = 1 + Math.floor(rand() * 31)
        const ms0 = Math.floor(rand() * 86_400_000)
        const ms1 = Math.floor(rand() * 86_400_000)
        const t0 = Date.UTC(y0, m0 - 1, d0) + ms0
        const t1 = Date.UTC(y1, m1 - 1, d1) + ms1
        if (!Number.isFinite(t0) || !Number.isFinite(t1)) continue
        const s = Math.min(t0, t1)
        const e = Math.max(t0, t1)
        const a = IntlDate.UTC(new Date(s))
        const b = IntlDate.UTC(new Date(e))
        const zdtS = TemporalApi.Instant.fromEpochMilliseconds(s).toZonedDateTimeISO('UTC')
        const zdtE = TemporalApi.Instant.fromEpochMilliseconds(e).toZonedDateTimeISO('UTC')
        for (const [ours, temporalUnit] of units) {
          const until = zdtS.until(zdtE, {
            largestUnit: temporalUnit,
            smallestUnit: temporalUnit,
            roundingMode: 'trunc'
          })
          expect(b.diff(a, ours)).toBe(until[ours])
        }
      }
    }
  )

  it('C1 month-end clamp chain and mixed units (10:00 wall)', () => {
    withTz('America/New_York', () => {
      const jan31 = mockDate(new Date(2021, 0, 31, 10, 0))
      expect(jan31.add({ months: 1 }).format('YYYY-MM-DD')).toBe('2021-02-28')
      expect(jan31.add({ months: 1 }).add({ months: 1 }).format('YYYY-MM-DD')).toBe('2021-03-28')
      expect(jan31.add({ months: 2 }).format('YYYY-MM-DD')).toBe('2021-03-31')
      const lep = mockDate(new Date(2020, 1, 29, 10, 0))
      expect(lep.add({ years: 1 }).format('YYYY-MM-DD')).toBe('2021-02-28')
      expect(lep.add({ years: 4 }).format('YYYY-MM-DD')).toBe('2024-02-29')
      expect(
        mockDate(new Date(2020, 0, 31, 10, 0))
          .add({ years: 1, months: 1 })
          .format('YYYY-MM-DD')
      ).toBe('2021-02-28')
      expect(jan31.add({ months: 1, days: 1 }).format('YYYY-MM-DD')).toBe('2021-03-01')
      expect(
        mockDate(new Date(2021, 2, 31, 10, 0))
          .subtract({ months: 1 })
          .format('YYYY-MM-DD')
      ).toBe('2021-02-28')
      expect(
        mockDate(new Date(2021, 2, 31, 10, 0))
          .add({ months: -1, days: 1 })
          .format('YYYY-MM-DD')
      ).toBe('2021-03-01')
      expect(
        mockDate(new Date(2021, 10, 30, 10, 0))
          .add({ quarters: 1 })
          .format('YYYY-MM-DD')
      ).toBe('2022-02-28')
      expect(
        mockDate(new Date(2021, 0, 31, 10, 0))
          .set({ month: 2 })
          .format('YYYY-MM-DD')
      ).toBe('2021-02-28')
      const endFeb = mockDate(new Date(2024, 1, 15, 10, 0)).endOf('month')
      expect(endFeb.format('YYYY-MM-DDTHH:mm:ss.SSS')).toBe('2024-02-29T23:59:59.999')
    })
  })

  it('C3 rejects non-finite and prototype-named duration/set/diff keys', () => {
    const d = mockDate(new Date(2021, 0, 1))
    expect(() => d.add({ hours: Number.NaN })).toThrow(ValueError)
    expect(() => d.add({ hours: Number.POSITIVE_INFINITY })).toThrow(ValueError)
    expect(() => d.add({ days: '1' as unknown as number })).toThrow(ValueError)
    expect(() => d.add({ constructor: 1 } as never)).toThrow(ValueError)
    expect(() => d.add({ days: 1e9 })).toThrow(RangeError)
    expect(() => d.set({ constructor: 1 } as never)).toThrow(ValueError)
    expect(() => d.diff(d, 'constructor' as 'days')).toThrow(ValueError)
    expect(() => d.diff(d, '__proto__' as 'days')).toThrow(ValueError)
  })

  it('C5 year 99 to 100 rollover (UTC)', () => {
    const start = IntlDate.UTC({ year: 99, month: 12, day: 31 })
    expect(start.add({ days: 61 }).format('YYYY-MM-DD')).toBe('0100-03-02')
    expect(
      IntlDate.UTC({ year: 96, month: 2, day: 29 }).add({ years: 4 }).format('YYYY-MM-DD')
    ).toBe('0100-02-28')
    expect(IntlDate.UTC({ year: 100, month: 3, day: 2 }).diff(start, 'days')).toBe(61)
  })

  it('relative time auto unit, trunc, numeric auto for zero', () => {
    const base = IntlDate.UTC('2024-06-15T12:00:00Z', 'en')
    expect(base.add({ seconds: 44 }).from(base)).toBe('in 44 seconds')
    expect(base.add({ days: 1 }).from(base)).toBe('in 1 day')
    expect(base.add({ days: 29 }).from(base)).toBe('in 29 days')
    expect(base.add({ days: 1, hours: 21, minutes: 36 }).from(base)).toBe('in 1 day')
    expect(base.add({ milliseconds: 500 }).from(base)).toBe('now')
    expect(base.from(base, 'days')).toBe('today')
    expect(base.subtract({ days: 1 }).from(base)).toBe('1 day ago')
    expect(
      IntlDate.UTC('2023-03-01T00:00:00Z', 'en').from(
        IntlDate.UTC('2023-02-01T00:00:00Z', 'en'),
        'months'
      )
    ).toBe('in 1 month')
    expect(base.add({ days: 400 }).from(base)).toBe('in 1 year')
  })

  it('critic regressions: Havana, Lord_Howe endOf, NY integer/exact months', () => {
    withTz('America/Havana', () => {
      const r = new IntlDate('2020-11-01T00:30:00-05:00')
      expect(r.startOf('day').toISOString()).toBe('2020-11-01T04:00:00.000Z')
      expect(r.startOf('day').startOf('month').toISOString()).toBe('2020-11-01T04:00:00.000Z')
    })
    withTz('Australia/Lord_Howe', () => {
      const r = new IntlDate('2021-04-03T15:15:30Z')
      expect(r.endOf('hour').getTime()).toBeGreaterThanOrEqual(r.getTime())
      expect(r.endOf('minute').toISOString()).toBe('2021-04-03T15:15:59.999Z')
    })
    withTz('America/New_York', () => {
      expect(
        mockDate(new Date(2021, 4, 1, 0, 0)).diff(mockDate(new Date(2021, 2, 31, 0, 30)), 'months')
      ).toBe(1)
      expect(
        mockDate(new Date(2022, 4, 1, 2, 15)).diff(mockDate(new Date(2020, 0, 31, 3, 15)), 'months')
      ).toBe(27)
      expect(
        mockDate(new Date(2021, 1, 28, 3, 30)).diff(
          mockDate(new Date(2022, 6, 31, 0, 30)),
          'months'
        )
      ).toBe(-16)
      expect(
        mockDate(new Date(2023, 0, 15, 0, 30)).diff(
          mockDate(new Date(2023, 6, 28, 2, 15)),
          'months',
          true
        )
      ).toBeCloseTo(-6.422, 3)
      expect(
        mockDate(new Date(2023, 0, 15, 0, 30)).diff(
          mockDate(new Date(2023, 6, 28, 2, 15)),
          'years',
          true
        )
      ).toBeCloseTo(-0.532, 3)
    })
  })

  it.skipIf(typeof globalThis.Temporal === 'undefined')(
    'Temporal oracle fuzz for diff/startOfDay/add',
    () => {
      const zones = [
        'America/New_York',
        'Europe/London',
        'America/Santiago',
        'Australia/Lord_Howe',
        'America/Havana',
        'Pacific/Kiritimati'
      ] as const
      const units = ['days', 'weeks', 'months', 'years'] as const
      const HOUR = 3_600_000
      const DAY = 24 * HOUR
      const offsets = [-25, -24, -2, -1, -0.75, -0.5, 0, 0.5, 0.75, 1, 2, 24, 25].map(
        (h) => h * HOUR
      )

      function mulberry32(seed: number) {
        let a = seed >>> 0
        return () => {
          a = (a + 0x6d2b79f5) >>> 0
          let t = a
          t = Math.imul(t ^ (t >>> 15), t | 1)
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
      }

      const TemporalApi = globalThis.Temporal

      function transitionsOf(zone: string): number[] {
        const found: number[] = []
        let at = TemporalApi.ZonedDateTime.from({ timeZone: zone, year: 1999, month: 1, day: 1 })
        for (;;) {
          const next = at.getTimeZoneTransition('next')
          if (next === null || next.year > 2040) return found
          found.push(next.epochMilliseconds)
          at = next
        }
      }

      /** The answer from Temporal, or undefined only when Temporal itself throws. */
      function fromTemporal<T>(ask: () => T): T | undefined {
        try {
          return ask()
        } catch {
          return undefined
        }
      }

      let skipped = 0
      let total = 0

      function expectInstantMatches(actual: () => number, temporal: () => number) {
        total += 1
        const expected = fromTemporal(temporal)
        if (expected === undefined) skipped += 1
        else expect(actual()).toBe(expected)
      }

      function expectDiffMatches(
        from: Temporal.ZonedDateTime,
        to: Temporal.ZonedDateTime,
        unit: (typeof units)[number]
      ) {
        total += 1
        const options = { largestUnit: unit, smallestUnit: unit, roundingMode: 'trunc' } as const
        const whole = fromTemporal(() => from.until(to, options)[unit])
        // A calendar `until` can step past `to` inside a repeated hour; hours are the exact elapsed time
        const exact = fromTemporal(() =>
          from.until(to, { largestUnit: 'hours' }).total({ unit, relativeTo: from })
        )
        if (whole === undefined || exact === undefined) {
          skipped += 1
          return
        }
        const target = new IntlDate(to.epochMilliseconds)
        expect(target.diff(from.epochMilliseconds, unit)).toBe(zeroNegZero(whole))
        expect(target.diff(from.epochMilliseconds, unit, true)).toBeCloseTo(exact, 9)
      }

      for (const zone of zones) {
        withTz(zone, () => {
          const rand = mulberry32(zone.length * 997 + 42)
          const below = (n: number) => Math.floor(rand() * n)
          const pick = (list: readonly number[], fallback: number) =>
            list[below(list.length)] ?? fallback
          const transitions = transitionsOf(zone)
          const anywhere = () =>
            Date.UTC(1999 + below(42), below(12), 1) + below(28) * DAY + below(DAY)

          for (let i = 0; i < 700; i++) {
            const anchor = pick(transitions, anywhere())
            const near = () => anchor + pick(offsets, 0) + (rand() < 0.3 ? below(HOUR) : 0)
            const s = near()
            const e =
              [near(), s + (below(81) - 40) * DAY + pick(offsets, 0), anywhere()][i % 3] ?? s
            const zdtS = TemporalApi.Instant.fromEpochMilliseconds(s).toZonedDateTimeISO(zone)
            const zdtE = TemporalApi.Instant.fromEpochMilliseconds(e).toZonedDateTimeISO(zone)

            for (const unit of units) {
              expectDiffMatches(zdtS, zdtE, unit)
              expectDiffMatches(zdtE, zdtS, unit)
            }

            const a = new IntlDate(new Date(s))
            expectInstantMatches(
              () => a.startOf('day').getTime(),
              () => zdtS.startOfDay().epochMilliseconds
            )

            const sign = rand() < 0.5 ? -1 : 1
            const dur = {
              years: sign * below(3),
              months: sign * below(11),
              days: sign * below(28),
              hours: sign * below(48)
            }
            expectInstantMatches(
              () => a.add(dur).getTime(),
              () => zdtS.add(dur).epochMilliseconds
            )
          }
        })
      }

      expect(skipped / total).toBeLessThanOrEqual(0.01)
    },
    120_000
  )
})

describe('audit regressions', () => {
  const utcDate = (value: ConstructorParameters<typeof IntlDate>[0]) =>
    mockDate(value, { utc: true })
  const MAX_TIME = 8.64e15
  // 01:30 EDT, then 01:10 EST forty minutes later, on a fall-back Sunday that is also the 1st
  const firstPass = '2026-11-01T05:30:00Z'
  const secondPass = '2026-11-01T06:10:00Z'

  it('diff keeps the sign of elapsed time inside a repeated hour', () => {
    withTz('America/New_York', () => {
      const earlier = mockDate(firstPass)
      const later = mockDate(secondPass)
      expect(later.diff(earlier, 'minutes')).toBe(40)
      for (const unit of ['days', 'weeks', 'months', 'quarters', 'years'] as const) {
        expect(later.diff(earlier, unit)).toBe(0)
        expect(earlier.diff(later, unit)).toBe(0)
      }
      expect(later.from(earlier)).toBe('in 40 minutes')
      expect(earlier.from(later)).toBe('40 minutes ago')
      expect(earlier.to(later)).toBe('in 40 minutes')
      expect(later.to(earlier)).toBe('40 minutes ago')
    })
  })

  it('whole units stop at the last anchor that does not pass the end', () => {
    withTz('America/New_York', () => {
      const elapsed = mockDate('2024-03-10T03:15:00').diff('2024-03-09T02:30:00', 'hours', true)
      expect(elapsed).toBe(23.75)
      expect(mockDate('2024-03-10T03:15:00').diff('2024-03-09T02:30:00', 'days')).toBe(0)
      expect(mockDate('2024-11-03T06:30:00Z').diff('2024-11-10T01:30:00', 'days')).toBe(-6)
      expect(mockDate('2024-11-03T06:30:00Z').diff('2024-11-10T01:30:00', 'weeks')).toBe(0)
      expect(mockDate('2004-04-04T03:00:00').diff('2003-08-04T02:59:59.999', 'months')).toBe(7)
    })
  })

  it('exact diff measures from the base instant, not its wall time', () => {
    withTz('America/New_York', () => {
      const earlier = mockDate(firstPass)
      const later = mockDate(secondPass)
      expect(later.diff(earlier, 'days', true)).toBeCloseTo(40 / 1500, 12)
      expect(earlier.diff(later, 'days', true)).toBeCloseTo(-40 / 1500, 12)
    })
  })

  it('diff across a skipped day counts nothing for the day that never happened', () => {
    withTz('Pacific/Apia', () => {
      const noon = mockDate('2011-12-31T12:00:00')
      expect(noon.diff(noon, 'days')).toBe(0)
      expect(mockDate('2011-12-31T11:00:00').diff(noon, 'days')).toBe(0)
      expect(mockDate('2011-12-31T11:00:00').diff(noon, 'days', true)).toBeCloseTo(-1 / 24, 12)
      expect(mockDate('2011-12-31T11:00:00').diff('2012-01-01T12:00:00', 'days')).toBe(-1)
      expect(noon.diff('2011-12-28T12:00:00', 'days')).toBe(3)
    })
    withTz('Pacific/Kiritimati', () => {
      // Eight months back from August 31 is the skipped December 31, which resolves to January 1
      expect(mockDate('1995-01-01T00:45:00').diff('1995-08-31T01:45:00', 'months')).toBe(-8)
    })
  })

  it('diff measures anchors past the Date range', () => {
    withTz('America/New_York', () => {
      const last = new IntlDate(MAX_TIME)
      expect(last.diff(-MAX_TIME, 'years')).toBe(547_581)
      expect(last.diff(-MAX_TIME, 'years', true)).toBeCloseTo(547_581.4, 0)
      expect(new IntlDate(-MAX_TIME).diff(MAX_TIME, 'months')).toBe(-6_570_976)
    })
  })

  it('endOf stays inside a unit that starts in a midnight gap', () => {
    withTz('America/Havana', () => {
      const gapDay = mockDate('2026-03-08T12:00:00')
      expect(gapDay.endOf('day').toISOString()).toBe('2026-03-09T03:59:59.999Z')
      expect(gapDay.endOf('week').toISOString()).toBe('2026-03-15T03:59:59.999Z')
      expect(gapDay.add({ days: 1 }).startOf('day').getTime()).toBe(
        gapDay.endOf('day').getTime() + 1
      )
      expect(mockDate('2012-04-15T12:00:00').endOf('month').toISOString()).toBe(
        '2012-05-01T03:59:59.999Z'
      )
    })
    withTz('Pacific/Apia', () => {
      expect(mockDate('2010-09-26T12:00:00').endOf('day').toISOString()).toBe(
        '2010-09-27T09:59:59.999Z'
      )
    })
  })

  it('endOf reaches a representable end whose unit starts before the Date range', () => {
    const first = utcDate(-MAX_TIME)
    expect(first.endOf('month').toISOString()).toBe('-271821-04-30T23:59:59.999Z')
    expect(first.endOf('isoWeek').toISOString()).toBe('-271821-04-25T23:59:59.999Z')
    expect(first.endOf('year').toISOString()).toBe('-271821-12-31T23:59:59.999Z')
  })

  it('UTC view reads comparison operands the way diff does', () => {
    withTz('America/New_York', () => {
      const view = IntlDate.UTC('2024-01-01T00:00:00')
      expect(view.diff('2024-01-01T00:00:00')).toBe(0)
      expect(view.isBefore('2024-01-01T00:00:00')).toBe(false)
      expect(view.isAfter('2023-12-31T23:59:00')).toBe(true)
      expect(view.isBetween('2023-12-31T23:59:00', '2024-01-01T00:01:00')).toBe(true)
      expect(view.isBefore({ year: 2024, month: 1, day: 1 })).toBe(false)
    })
  })

  it('values that are not dates are invalid, never the current time', () => {
    for (const value of [true, false, [], [2024, 1, 1], new Map(), 1n]) {
      expect(new IntlDate(value as never).isValid()).toBe(false)
    }
    expect(IntlDate.max([[] as never, 5])).toBe(5)
    expect(IntlDate.max([undefined as never, 5])).toBe(5)
  })

  it('a Date from another realm keeps its instant', () => {
    const foreign = vm.runInNewContext('new Date(86400000)') as Date
    expect(new IntlDate(foreign).getTime()).toBe(86_400_000)
    expect(asDate(foreign).getTime()).toBe(86_400_000)
    expect(new IntlDate(86_400_000).isSame(foreign)).toBe(true)
    expect(new IntlDate(0).compare(foreign)).toBe(-1)
    expect(new IntlDate(new Date(Number.NaN)).compare(foreign)).toBe(1)
    expect(new IntlDate(0).isSame({} as never)).toBe(false)
  })

  it('relative formatting of an invalid date says so instead of throwing', () => {
    const invalid = mockDate(Number.NaN)
    expect(invalid.fromNow()).toBe('Invalid Date')
    expect(invalid.toNow()).toBe('Invalid Date')
    expect(invalid.from(0)).toBe('Invalid Date')
    expect(invalid.to(0, 'days')).toBe('Invalid Date')
    expect(mockDate(0).from(null)).toBe('Invalid Date')
    expect(mockDate(0).to(null)).toBe('Invalid Date')
  })

  it('toISODate and toISOTime split expanded years at the T', () => {
    const bce = mockDate('-000001-06-15T12:00:00Z')
    expect(bce.toISODate()).toBe('-000001-06-15')
    expect(bce.toISOTime()).toBe('12:00:00.000Z')
    expect(utcDate(MAX_TIME).toISODate()).toBe('+275760-09-13')
    expect(utcDate(MAX_TIME).toISOTime()).toBe('00:00:00.000Z')
  })

  it('minDate and maxDate ignore numbers outside the Date range', () => {
    expect(minDate([-1e20, 5])).toBe(5)
    expect(maxDate([1e20, 7])).toBe(7)
    expect(maxDate([Number.POSITIVE_INFINITY, 5])).toBe(5)
    expect(minDate([undefined, 5], (value) => value ?? 0)).toBeUndefined()
  })

  it('toJSON serializes the instant', () => {
    expect(JSON.stringify({ at: new IntlDate(0) })).toBe('{"at":"1970-01-01T00:00:00.000Z"}')
    expect(JSON.stringify(new IntlDate(Number.NaN))).toBe('null')
  })

  it('asDate never lets a sign or padding reach engine parsing', () => {
    for (const text of ['-2024-01-01', '-0001-01-01', '+2024-01-01', '-1']) {
      expect(asDate(text).getTime()).toBeNaN()
    }
    expect(asDate(' 2024-02-30').getTime()).toBeNaN()
    expect(asDate('\t2024-13-01\n').getTime()).toBeNaN()
    expect(asDate('2024-01-01T10:00:00Z ').getTime()).toBe(Date.UTC(2024, 0, 1, 10))
    withTz('America/New_York', () => {
      expect(asDate(' 2024-01-01', true).getTime()).toBe(Date.UTC(2024, 0, 1))
    })
  })

  it('asDate reads the 24:00 fraction and the year-only time form', () => {
    expect(asDate('2024-01-01T24:00:00.0001').getTime()).toBeNaN()
    expect(asDate('2024-01-01T24:00:00.000Z').getTime()).toBe(Date.UTC(2024, 0, 2))
    withTz('America/New_York', () => {
      expect(asDate('2024T10:00', true).getTime()).toBe(Date.UTC(2024, 0, 1, 10))
      expect(asDate('2024 10:00', true).getTime()).toBe(Date.UTC(2024, 0, 1, 10))
    })
  })

  it('asDate reads date-prefixed zone, meridiem and month-name forms', () => {
    withTz('America/New_York', () => {
      expect(asDate('2022-01-01 10:00:00 +0000').getTime()).toBe(Date.UTC(2022, 0, 1, 10))
      expect(asDate('2022-01-01 10:00:00 UTC').getTime()).toBe(Date.UTC(2022, 0, 1, 10))
      expect(asDate('2022-01-01 10:00:00 +0000 UTC').getTime()).toBe(Date.UTC(2022, 0, 1, 10))
      expect(asDate('2022-01-01 10:00 PM').getTime()).toBe(new Date(2022, 0, 1, 22).getTime())
      expect(asDate('2022-Jan-01').getTime()).toBe(new Date(2022, 0, 1).getTime())
      expect(asDate('2022-dec-31T10:00', true).getTime()).toBe(Date.UTC(2022, 11, 31, 10))
    })
  })

  it('asDate keeps range failures and word tails away from engine parsing', () => {
    for (const text of [
      '2024-02-30 10:00 PM',
      '2024-13-01 10:00:00 UTC',
      '2024-01-01 25:00 UTC',
      '2024-Feb-30',
      '2021-01-01junk',
      '2021-01-01 junk',
      '2021-01-01 10:00 junk',
      '2021-01-01 10:00 pm junk',
      '2024 10:00 junk',
      '2021-Junk-01',
      '2021-junk',
      '2024-',
      '2024-06-'
    ]) {
      expect(asDate(text).getTime()).toBeNaN()
    }
  })

  it('month length comes from the calendar, not a Date', () => {
    expect(new IntlDate(MAX_TIME).daysInMonth()).toBe(30)
    expect(utcDate(MAX_TIME).daysInMonth()).toBe(30)
    expect(daysInMonth(new Date(MAX_TIME))).toBe(30)
    expect(lastDayOfMonth(2024, 1)).toBe(29)
    expect(mockDate(Number.NaN).daysInMonth()).toBeNaN()
    withTz('Pacific/Kiritimati', () => {
      expect(mockDate('1994-12-15T12:00:00').daysInMonth()).toBe(31)
    })
    withTz('Asia/Manila', () => {
      expect(mockDate('1844-12-15T12:00:00').daysInMonth()).toBe(31)
    })
  })

  it('every year stays literal through local wall resolution', () => {
    for (const year of [-400, -301, -1, 0, 50, 99, 100, 1900]) {
      const date = new IntlDate({ year, month: 3, day: 15, hour: 12 })
      expect(date.year).toBe(year)
      expect(date.hour).toBe(12)
      expect(date.add({ years: 1 }).year).toBe(year + 1)
    }
    expect(asDate('0050-01-01T24:00:00').getDate()).toBe(2)
    expect(new IntlDate({ year: 50, month: 13, day: 1 }).year).toBe(51)
  })

  it('wall times just inside the Date minimum resolve', () => {
    withTz('America/New_York', () => {
      expect(new IntlDate(-MAX_TIME).add({ days: 1 }).add({ days: -1 }).getTime()).toBe(-MAX_TIME)
      expect(asDate('-271821-04-19T23:59:00').getTime()).toBe(-8_639_999_982_298_000)
    })
  })

  it('offset preference holds for offsets with seconds', () => {
    withTz('Pacific/Apia', () => {
      // 12:00 on the second July 4 of 1892, offset -11:26:56
      const repeated = mockDate('1892-07-04T23:26:56Z')
      expect(repeated.set({}).getTime()).toBe(repeated.getTime())
      expect(repeated.startOf('second').getTime()).toBe(repeated.getTime())
      expect(repeated.endOf('hour').getTime()).toBe(repeated.getTime() + 3_599_999)
    })
    withTz('Asia/Kolkata', () => {
      expect(new IntlDate(-MAX_TIME).set({}).getTime()).toBe(-MAX_TIME)
    })
  })

  it('every method throws RangeError for a result outside the Date range', () => {
    const first = utcDate(-MAX_TIME)
    const last = utcDate(MAX_TIME)
    expect(() => mockDate(0).add({ years: 300_000 })).toThrow(RangeError)
    expect(() => mockDate(0).set({ year: 300_000 })).toThrow(RangeError)
    expect(() => mockDate(0).set({ year: 300_000, weekday: 1 })).toThrow('date out of range')
    expect(() => first.startOf('year')).toThrow(RangeError)
    expect(() => last.endOf('hour')).toThrow(RangeError)
    expect(() => last.endOf('day')).toThrow(RangeError)
    expect(new IntlDate({ year: 300_000 }).isValid()).toBe(false)
  })

  it('a.to(b) reads the same as b.from(a) on month-end pairs', () => {
    const start = utcDate('2024-01-31')
    const end = utcDate('2024-02-29')
    expect(start.to(end)).toBe('in 1 month')
    expect(start.to(end)).toBe(end.from(start))
    expect(end.to(start)).toBe(start.from(end))
  })

  it('invalid receivers report NaN or a marker and still validate arguments', () => {
    const invalid = mockDate(Number.NaN)
    expect(invalid.daysInYear()).toBeNaN()
    expect(invalid.inspect()).toBe('new IntlDate(NaN)')
    expect(() => invalid.set({ bogus: 1 } as never)).toThrow(ValueError)
    expect(() => invalid.diff(0, 'bogus' as 'days')).toThrow(ValueError)
    expect(invalid.set({ year: 2024 })).not.toBe(invalid)
    expect(() => mockDate(0).set({ year: 1.5 })).toThrow('date field "year" must be an integer')
  })

  it('copies keep the locale and clone(null) is invalid', () => {
    const german = new IntlDate(0, { locale: 'de' })
    expect(new IntlDate(german).locale).toBe('de')
    expect(IntlDate.UTC(german).locale).toBe('de')
    expect(new IntlDate(german, { locale: 'fr' }).locale).toBe('fr')
    expect(new IntlDate(0).clone(german).locale).toBeUndefined()
    expect(mockDate(0).clone(null).isValid()).toBe(false)
    expect(mockDate(5).clone().getTime()).toBe(5)
  })

  it('constructor objects follow the field rules of set', () => {
    expect(new IntlDate({ years: 2024 } as never).year).toBe(2024)
    expect(new IntlDate({ year: 2024, month: 1, day: 1, weekday: 3 }).day).toBe(3)
    expect(utcDate({ year: 2024, month: 1, day: 31, hour: 24, weekday: 4 }).day).toBe(1)
    expect(() => new IntlDate({ year: '2024' } as never)).toThrow(ValueError)
    expect(() => new IntlDate({ year: 1.5 })).toThrow('date field "year" must be an integer')
    expect(() => new IntlDate({ foo: 1 } as never)).toThrow(/unknown date field/)
  })

  it('utcOffset never reports negative zero', () => {
    withTz('Europe/London', () => {
      expect(mockDate('2024-01-15T12:00:00Z').utcOffset()).toBe(0)
    })
  })

  it('IntlDate.min and max reject anything but an array', () => {
    for (const value of ['2024-01-01', new Date(0), new Set([1])]) {
      expect(() => IntlDate.max(value as never)).toThrow(TypeError)
      expect(() => IntlDate.min(value as never)).toThrow(TypeError)
    }
  })

  it('addDuration validates fields however they are provided', () => {
    expect(() => addDuration(new Date(0), new Duration({ days: 1.5 }), 1, true)).toThrow(
      'calendar unit "days" must be an integer'
    )
    expect(() => addDuration(new Date(0), Object.create({ days: '1' }) as DurationObject)).toThrow(
      'duration field "days" must be a finite number'
    )
    expect(addDuration(new Date(0), new Duration({ days: 1 }), 1, true).getTime()).toBe(86_400_000)
  })

  it('date utilities treat null and booleans as invalid like the constructor', () => {
    for (const value of [null, undefined, true]) {
      expect(dayOfYear(value as never)).toBeNaN()
      expect(daysInMonth(value as never)).toBeNaN()
      expect(weekOfYear(value as never)).toEqual({ week: Number.NaN, year: Number.NaN })
    }
  })
})

function zeroNegZero(n: number): number {
  return Object.is(n, -0) ? 0 : n
}
