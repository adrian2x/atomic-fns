import { asDate } from '../format.js'

/** Calendar fields for IntlDate object construction and `set`. */
export interface DateObject {
  year?: number
  month?: number
  day?: number
  weekday?: number
  hour?: number
  minute?: number
  second?: number
  millisecond?: number
}

function unwrapDates<T>(args: T[]): T[] {
  const first: unknown = args[0]
  return Array.isArray(first) ? (first as T[]) : args
}

/**
 * Returns the minimum (most distant past) of the given date values.
 * @param dates Date-like values.
 */
export function minDate<T>(dates: T[]): T
export function minDate<T>(...args: T[]): T {
  const dates = unwrapDates(args)
  let ans = dates[0]
  for (let i = 1; i < dates.length; i++) {
    if (Number(dates[i]) < Number(ans)) {
      ans = dates[i]
    }
  }
  return ans
}

/**
 * Returns the maximum (most distant future) of the given date values.
 * @param dates Date-like values.
 */
export function maxDate<T>(dates: T[]): T
export function maxDate<T>(...args: T[]): T {
  const dates = unwrapDates(args)
  let ans = dates[0]
  for (let i = 1; i < dates.length; i++) {
    if (Number(dates[i]) > Number(ans)) {
      ans = dates[i]
    }
  }
  return ans
}

/**
 * Returns `true` if the year is a leap year.
 * @param year The calendar year.
 */
export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

/**
 * Get the number of days in the given year.
 * @param year The calendar year.
 */
export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

/**
 * Get the number of days in the given date's month and year.
 * String input is parsed as local time via `asDate`.
 * @param date The specified date.
 */
export function daysInMonth(date: string | number | Date): number {
  const d = typeof date === 'string' ? asDate(date) : new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth()
  const end = new Date(0)
  end.setFullYear(year, month + 1, 0)
  return end.getDate()
}

/**
 * Coerces a unit value to a finite number.
 * @param value The unit value.
 */
export function asNumber(value: unknown): number {
  const numericValue = Number(value)
  if (typeof value === 'boolean' || value === '' || Number.isNaN(numericValue)) {
    throw new Error(`Invalid unit value ${String(value)}`)
  }
  return numericValue
}

const isoDuration =
  /^-?P(?:(?:(-?\d{1,20}(?:\.\d{1,20})?)Y)?(?:(-?\d{1,20}(?:\.\d{1,20})?)M)?(?:(-?\d{1,20}(?:\.\d{1,20})?)W)?(?:(-?\d{1,20}(?:\.\d{1,20})?)D)?(?:T(?:(-?\d{1,20}(?:\.\d{1,20})?)H)?(?:(-?\d{1,20}(?:\.\d{1,20})?)M)?(?:(-?\d{1,20})(?:[.,](-?\d{1,20}))?S)?)?)$/

function parseFloating(str: string | undefined) {
  if (str != null && str !== '') return parseFloat(str)
}

function parseMilliseconds(str: string | undefined) {
  if (str != null && str !== '') {
    const f = parseFloat('0.' + str) * 1000
    return Math.floor(f)
  }
}

interface ISODurationFields {
  years?: number
  months?: number
  weeks?: number
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
  milliseconds?: number
}

function extractISODuration(match: RegExpExecArray): [ISODurationFields] {
  const [s] = match
  const groups: (string | undefined)[] = match
  const [, yearStr, monthStr, weekStr, dayStr, hourStr, minuteStr, secondStr, millisecondsStr] =
    groups

  const hasNegativePrefix = s.startsWith('-')
  const negativeSeconds = secondStr?.startsWith('-')

  const maybeNegate = (num: number | undefined, force = false) =>
    num !== undefined && (force || (num && hasNegativePrefix)) ? -num : num

  return [
    {
      years: maybeNegate(parseFloating(yearStr)),
      months: maybeNegate(parseFloating(monthStr)),
      weeks: maybeNegate(parseFloating(weekStr)),
      days: maybeNegate(parseFloating(dayStr)),
      hours: maybeNegate(parseFloating(hourStr)),
      minutes: maybeNegate(parseFloating(minuteStr)),
      seconds: maybeNegate(parseFloating(secondStr), secondStr === '-0'),
      milliseconds: maybeNegate(parseMilliseconds(millisecondsStr), Boolean(negativeSeconds))
    }
  ]
}

/** Parses an ISO-8601 duration string into a duration object. */
export function parseISODuration(s: string | null | undefined): [ISODurationFields] | [null, null] {
  if (s == null) {
    return [null, null]
  }
  const m = isoDuration.exec(s)
  if (m) {
    return extractISODuration(m)
  }
  return [null, null]
}

function createUTCDate(y: number, m = 0, d = 1, h = 0, min = 0, s = 0, ms = 0) {
  let date: Date
  if (y < 100 && y >= 0) {
    date = new Date(Date.UTC(y + 400, m, d, h, min, s, ms))
    if (Number.isFinite(date.getUTCFullYear())) {
      date.setUTCFullYear(y)
    }
  } else {
    date = new Date(Date.UTC(y, m, d, h, min, s, ms))
  }
  return date
}

function firstWeekOffset(year: number, dow: number, doy: number) {
  const fwd = 7 + dow - doy
  const fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7
  return -fwdlw + fwd - 1
}

/**
 * Returns the number of weeks in the specified year.
 * @param year Calendar year.
 * @param firstDayOfWeek First day of week (0=Sun..6=Sat, default Mon=1).
 * @param firstDayOfYear Day-of-year threshold for week 1 (default 1).
 */
export function weeksInYear(year: number, firstDayOfWeek = 1, firstDayOfYear = 1): number {
  const weekOffset = firstWeekOffset(year, firstDayOfWeek, firstDayOfYear)
  const weekOffsetNext = firstWeekOffset(year + 1, firstDayOfWeek, firstDayOfYear)
  return (daysInYear(year) - weekOffset + weekOffsetNext) / 7
}

/**
 * Returns the week of the year for the specified date.
 * String input is parsed as local time via `asDate`.
 * @param date The date.
 * @param firstDayOfWeek First day of week (default Monday=1).
 * @param firstDayOfYear Day-of-year threshold for week 1 (default 1).
 */
export function weekOfYear(
  date: string | number | Date,
  firstDayOfWeek = 1,
  firstDayOfYear = 1
): { week: number; year: number } {
  const d = typeof date === 'string' ? asDate(date) : new Date(date)
  const year = d.getFullYear()
  const doy = dayOfYear(d)
  const weekOffset = firstWeekOffset(year, firstDayOfWeek, firstDayOfYear)
  const week = Math.floor((doy - weekOffset - 1) / 7) + 1

  if (week < 1) {
    const resYear = year - 1
    return {
      week: week + weeksInYear(resYear, firstDayOfWeek, firstDayOfYear),
      year: resYear
    }
  }
  if (week > weeksInYear(year, firstDayOfWeek, firstDayOfYear)) {
    return {
      week: week - weeksInYear(year, firstDayOfWeek, firstDayOfYear),
      year: year + 1
    }
  }
  return { week, year }
}

/** ISO weeks in year (Monday start, first week contains Jan 4). */
export function isoWeeksInYear(year: number): number {
  return weeksInYear(year, 1, 4)
}

/**
 * Day of year (1-366). String input is parsed as local time via `asDate`.
 * @param input The date.
 */
export function dayOfYear(input: string | number | Date): number {
  const d = typeof input === 'string' ? asDate(input) : new Date(input)
  d.setHours(0, 0, 0, 0)
  const start = new Date(0)
  start.setFullYear(d.getFullYear(), 0, 1)
  start.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - start.getTime()) / 864e5) + 1
}
