import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { dayOfYear, daysInMonth, IntlDate, weekOfYear } from '../src/i18n/date/index.js'
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
    expect(testDate.toString()).toBe(date.toLocaleString())
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
      expect(() => d.set(asFields({ [key]: 1 }))).toThrow(/Invalid unit/)
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
