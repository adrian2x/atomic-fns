import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  FIRST_DAY_FALLBACK,
  ISO_WEEK_RULE,
  localeWeekRule,
  MIN_DAYS_4_REGIONS
} from '../src/i18n/date/calendar.js'
import { dayOfYear, IntlDate, weekOfYear, weeksInYear } from '../src/i18n/date/index.js'

function localNoon(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 12)
}

function callGetWeekInfo(loc: Intl.Locale): unknown {
  const value: unknown = Reflect.get(Intl.Locale.prototype, 'getWeekInfo')
  if (typeof value !== 'function') return undefined
  return Reflect.apply(value, loc, [])
}

function hasGetWeekInfo(): boolean {
  const value: unknown = Reflect.get(Intl.Locale.prototype, 'getWeekInfo')
  return typeof value === 'function'
}

function nativeMinimalDaysPresent(): boolean {
  if (!hasGetWeekInfo()) return false
  const info = callGetWeekInfo(new Intl.Locale('en-US'))
  return (
    info !== null &&
    typeof info === 'object' &&
    typeof Reflect.get(info, 'minimalDays') === 'number'
  )
}

describe('week calendar math', () => {
  it('weeksInYear stays 52 or 53 for every safe integer year', () => {
    expect(weeksInYear(1e15)).toBe(weeksInYear(1e15 % 400))
    expect(weeksInYear(Number.MAX_SAFE_INTEGER)).toBe(52)
    expect(weeksInYear(-Number.MAX_SAFE_INTEGER)).toBe(52)
    expect(() => weeksInYear(2 ** 53)).toThrow(RangeError)
    expect(() => weeksInYear(1e300)).toThrow(RangeError)
  })

  it('a -u-rg- override picks the region for minimal days too', () => {
    expect(localeWeekRule('en-GB-u-rg-uszzzz', () => ({ firstDay: 7 }))).toEqual({
      firstDay: 0,
      minimalDays: 1
    })
    expect(localeWeekRule('en-US-u-rg-gbzzzz', () => ({ firstDay: 1 }))).toEqual({
      firstDay: 1,
      minimalDays: 4
    })
    expect(localeWeekRule('en-US-u-rg-gbzzzz', () => undefined).minimalDays).toBe(4)
    const week = new IntlDate('2024-12-29T12:00:00Z', { locale: 'en-GB-u-rg-uszzzz', utc: true })
    expect(week.weeksInYear()).toBe(52)
  })

  it('ISO weekOfYear vectors', () => {
    const cases: [number, number, number, number, number][] = [
      [2020, 12, 31, 53, 2020],
      [2021, 1, 1, 53, 2020],
      [2021, 1, 3, 53, 2020],
      [2021, 1, 4, 1, 2021],
      [2024, 12, 29, 52, 2024],
      [2024, 12, 30, 1, 2025],
      [2026, 12, 31, 53, 2026],
      [2027, 1, 3, 53, 2026],
      [2027, 1, 4, 1, 2027],
      [2008, 12, 29, 1, 2009],
      [2010, 1, 3, 53, 2009]
    ]
    for (const [y, m, d, week, year] of cases) {
      expect(weekOfYear(localNoon(y, m, d))).toEqual({ week, year })
    }

    const y1 = new Date(0)
    y1.setUTCFullYear(1, 0, 1)
    expect(weekOfYear(y1, 1, 4, true)).toEqual({ week: 1, year: 1 })

    const y0 = new Date(0)
    y0.setUTCFullYear(0, 11, 31)
    expect(weekOfYear(y0, 1, 4, true)).toEqual({ week: 52, year: 0 })
  })

  it('weeksInYear ISO vectors', () => {
    for (const y of [2004, 2009, 2015, 2020, 2026, 2032]) {
      expect(weeksInYear(y)).toBe(53)
    }
    for (const y of [2019, 2021, 1, 0, -1]) {
      expect(weeksInYear(y)).toBe(52)
    }
  })

  it('US and Monday+1 week rules', () => {
    expect(weekOfYear(localNoon(2022, 1, 1), 0, 1)).toEqual({ week: 1, year: 2022 })
    expect(weekOfYear(localNoon(2022, 1, 2), 0, 1)).toEqual({ week: 2, year: 2022 })
    expect(weekOfYear(localNoon(2020, 12, 27), 0, 1)).toEqual({ week: 1, year: 2021 })
    expect(weekOfYear(localNoon(2020, 12, 31), 0, 1)).toEqual({ week: 1, year: 2021 })
    expect(weekOfYear(localNoon(2021, 1, 1), 0, 1)).toEqual({ week: 1, year: 2021 })
    expect(weekOfYear(localNoon(2022, 1, 1), 1, 1)).toEqual({ week: 1, year: 2022 })
    expect(weekOfYear(localNoon(2022, 1, 3), 1, 1)).toEqual({ week: 2, year: 2022 })
  })

  it('firstDay 7 equals 0', () => {
    const d = localNoon(2022, 1, 2)
    expect(weekOfYear(d, 7, 1)).toEqual(weekOfYear(d, 0, 1))
  })

  it('validation and invalid dates', () => {
    const d = localNoon(2022, 1, 1)
    expect(() => weekOfYear(d, 8)).toThrow(RangeError)
    expect(() => weekOfYear(d, 1.5)).toThrow(RangeError)
    expect(() => weekOfYear(d, 1, 0)).toThrow(RangeError)
    expect(() => weekOfYear(d, 1, 8)).toThrow(RangeError)
    expect(() => weeksInYear(2020.5)).toThrow(RangeError)
    expect(weekOfYear(new Date(Number.NaN))).toEqual({ week: Number.NaN, year: Number.NaN })
    expect(dayOfYear('nope')).toBeNaN()
  })

  describe('DST America/New_York', () => {
    const prev = process.env.TZ
    beforeAll(() => {
      process.env.TZ = 'America/New_York'
    })
    afterAll(() => {
      if (prev === undefined) delete process.env.TZ
      else process.env.TZ = prev
    })

    it('dayOfYear and isoWeek across DST', () => {
      expect(new IntlDate(new Date(2021, 2, 14, 0, 30)).isoWeek()).toBe(10)
      expect(dayOfYear(new Date(2021, 2, 15))).toBe(74)
      expect(dayOfYear(new Date(2021, 11, 31))).toBe(365)
      expect(dayOfYear(new Date(2020, 11, 31))).toBe(366)
    })
  })

  describe('Pacific/Kiritimati', () => {
    const prev = process.env.TZ
    beforeAll(() => {
      process.env.TZ = 'Pacific/Kiritimati'
    })
    afterAll(() => {
      if (prev === undefined) delete process.env.TZ
      else process.env.TZ = prev
    })

    it('local vs UTC day and week', () => {
      const a = new Date('2024-01-01T10:00:00Z')
      expect(new IntlDate(a).day).toBe(2)
      expect(IntlDate.UTC(a).day).toBe(1)

      const b = new Date('2024-12-29T12:00:00Z')
      expect(new IntlDate(b).isoWeek()).toBe(1)
      expect(IntlDate.UTC(b).isoWeek()).toBe(52)
    })
  })

  it('locale startOf week / isoWeek', () => {
    const base = (locale: string) => new IntlDate(new Date(2024, 4, 15, 12), { locale })
    expect(base('en-US').startOf('week').format('YYYY-MM-DD HH:mm')).toBe('2024-05-12 00:00')
    expect(base('ar-EG').startOf('week').format('YYYY-MM-DD HH:mm')).toBe('2024-05-11 00:00')
    expect(base('de').startOf('week').format('YYYY-MM-DD HH:mm')).toBe('2024-05-13 00:00')
    expect(base('en-GB').startOf('week').format('YYYY-MM-DD HH:mm')).toBe('2024-05-13 00:00')
    for (const locale of ['en-US', 'ar-EG', 'de', 'en-GB']) {
      expect(base(locale).startOf('isoWeek').format('YYYY-MM-DD HH:mm')).toBe('2024-05-13 00:00')
    }
    expect(base('en-US').endOf('week').format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(
      '2024-05-18 23:59:59.999'
    )
  })

  it('localeWeekRule from engine', () => {
    expect(localeWeekRule('en-US')).toEqual({ firstDay: 0, minimalDays: 1 })
    expect(localeWeekRule('en-GB')).toEqual({ firstDay: 1, minimalDays: 4 })
    expect(localeWeekRule('de')).toEqual({ firstDay: 1, minimalDays: 4 })
    expect(localeWeekRule('ar-EG')).toEqual({ firstDay: 6, minimalDays: 1 })
  })

  it.skipIf(!hasGetWeekInfo())('localeWeekRule honors fw-mon extension', () => {
    expect(localeWeekRule('en-US-u-fw-mon').firstDay).toBe(1)
  })

  it('localeWeekRule fallback path', () => {
    const none = () => undefined
    expect(localeWeekRule('en-US', none)).toEqual({ firstDay: 0, minimalDays: 1 })
    expect(localeWeekRule('pt-BR', none)).toEqual({ firstDay: 0, minimalDays: 1 })
    expect(localeWeekRule('de', none)).toEqual({ firstDay: 1, minimalDays: 4 })
    expect(localeWeekRule('ar-EG', none)).toEqual({ firstDay: 6, minimalDays: 1 })
    expect(localeWeekRule('dv-MV', none)).toEqual({ firstDay: 5, minimalDays: 1 })
    expect(localeWeekRule('und', none)).toEqual({ firstDay: 0, minimalDays: 1 })
    expect(localeWeekRule('und-001', none)).toEqual({ firstDay: 1, minimalDays: 1 })
    expect(localeWeekRule('und-DE', none)).toEqual({ firstDay: 1, minimalDays: 4 })
    expect(localeWeekRule('en-AU', none)).toEqual({ firstDay: 1, minimalDays: 1 })
    expect(localeWeekRule('en-IS', none)).toEqual({ firstDay: 0, minimalDays: 4 })
  })

  it.skipIf(!hasGetWeekInfo())('firstDay fallback table matches native getWeekInfo', () => {
    const deprecated = new Set('BU JT MI NT PU PZ RH WK YD'.split(' '))
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b)
        if (deprecated.has(code)) continue
        let loc: Intl.Locale
        try {
          loc = new Intl.Locale('und-' + code)
        } catch {
          continue
        }
        const info = callGetWeekInfo(loc)
        if (info === null || typeof info !== 'object') continue
        const firstDay: unknown = Reflect.get(info, 'firstDay')
        if (typeof firstDay !== 'number') continue
        const native = firstDay % 7
        const fallback = FIRST_DAY_FALLBACK.get(code) ?? 1
        expect(fallback).toBe(native)
      }
    }
  })

  it('MIN_DAYS_4_REGIONS pin', () => {
    expect([...MIN_DAYS_4_REGIONS].sort()).toEqual(
      'AD AN AT AX BE BG CH CZ DE DK EE ES FI FJ FO FR GB GF GG GI GP GR HU IE IM IS IT JE LI LT LU MC MQ NL NO PL PT RE RU SE SJ SK SM VA'
        .split(' ')
        .sort()
    )
  })

  it.skipIf(!nativeMinimalDaysPresent())('minimalDays matches native when exposed', () => {
    const deprecated = new Set('BU JT MI NT PU PZ RH WK YD'.split(' '))
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b)
        if (deprecated.has(code)) continue
        let loc: Intl.Locale
        try {
          loc = new Intl.Locale('und-' + code)
        } catch {
          continue
        }
        const info = callGetWeekInfo(loc)
        if (info === null || typeof info !== 'object') continue
        const minimalDays: unknown = Reflect.get(info, 'minimalDays')
        if (typeof minimalDays !== 'number') continue
        expect(minimalDays).toBe(MIN_DAYS_4_REGIONS.has(code) ? 4 : 1)
      }
    }
  })

  it('ISO_WEEK_RULE is frozen Monday/4', () => {
    expect(ISO_WEEK_RULE).toEqual({ firstDay: 1, minimalDays: 4 })
  })
})
