import { asDate } from '../format.js'
import { lastDayOfMonth } from './arith.js'
import { dayNumber, readWall, toWeekRule, weekDateOf, weeksInWeekYear } from './calendar.js'

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

/**
 * Epoch milliseconds for a date-like value. Strings are parsed as local time via `asDate`,
 * the same parsing `IntlDate` uses. Invalid input yields `NaN`.
 */
function defaultTime(value: unknown): number {
  if (typeof value === 'string') return asDate(value).getTime()
  if (value === null) return Number.NaN
  return Number(value)
}

function pickExtreme<T>(
  dates: readonly T[],
  toTime: (value: T) => number,
  better: (candidate: number, current: number) => boolean
): T | undefined {
  let ans: T | undefined
  let ansTime = Number.NaN
  for (const value of dates) {
    const time = toTime(value)
    if (Number.isNaN(time)) continue
    if (ans === undefined || better(time, ansTime)) {
      ans = value
      ansTime = time
    }
  }
  return ans
}

/**
 * Returns the minimum (most distant past) of the given date values, or `undefined` when the
 * list has no valid date. Invalid dates are ignored. String input is parsed as local time.
 * @param dates Date-like values.
 * @param toTime Optional converter to epoch milliseconds.
 */
export function minDate<T>(
  dates: readonly T[],
  toTime: (value: T) => number = defaultTime
): T | undefined {
  return pickExtreme(dates, toTime, (candidate, current) => candidate < current)
}

/**
 * Returns the maximum (most distant future) of the given date values, or `undefined` when the
 * list has no valid date. Invalid dates are ignored. String input is parsed as local time.
 * @param dates Date-like values.
 * @param toTime Optional converter to epoch milliseconds.
 */
export function maxDate<T>(
  dates: readonly T[],
  toTime: (value: T) => number = defaultTime
): T | undefined {
  return pickExtreme(dates, toTime, (candidate, current) => candidate > current)
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
  return lastDayOfMonth(d.getFullYear(), d.getMonth(), false)
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

/** Calendar and clock fields parsed from an ISO-8601 duration string. */
export interface ISODurationFields {
  years?: number
  months?: number
  weeks?: number
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
  milliseconds?: number
}

function extractISODuration(match: RegExpExecArray): ISODurationFields {
  const [s] = match
  const groups: (string | undefined)[] = match
  const [, yearStr, monthStr, weekStr, dayStr, hourStr, minuteStr, secondStr, millisecondsStr] =
    groups

  const hasNegativePrefix = s.startsWith('-')
  const negativeSeconds = secondStr?.startsWith('-')

  const maybeNegate = (num: number | undefined, force = false) =>
    num !== undefined && (force || (num && hasNegativePrefix)) ? -num : num

  return {
    years: maybeNegate(parseFloating(yearStr)),
    months: maybeNegate(parseFloating(monthStr)),
    weeks: maybeNegate(parseFloating(weekStr)),
    days: maybeNegate(parseFloating(dayStr)),
    hours: maybeNegate(parseFloating(hourStr)),
    minutes: maybeNegate(parseFloating(minuteStr)),
    seconds: maybeNegate(parseFloating(secondStr), secondStr === '-0'),
    milliseconds: maybeNegate(parseMilliseconds(millisecondsStr), Boolean(negativeSeconds))
  }
}

/** Parses an ISO-8601 duration string into a duration object, or `null` when it does not match. */
export function parseISODuration(s: string | null | undefined): ISODurationFields | null {
  if (s == null) {
    return null
  }
  const m = isoDuration.exec(s)
  if (m) {
    return extractISODuration(m)
  }
  return null
}

function toDate(input: string | number | Date, utc = false): Date {
  if (typeof input === 'string') return asDate(input, utc)
  return new Date(input)
}

/**
 * Number of weeks in a week-numbering year under a CLDR week rule.
 * Defaults are ISO 8601 (`firstDay` Monday, `minimalDays` 4).
 * @param weekYear Week-numbering year (integer)
 * @param firstDay First day of week, 0..7 (0 or 7 = Sunday, default 1 = Monday)
 * @param minimalDays Days of the new year required in week 1 (1..7, default 4)
 */
export function weeksInYear(weekYear: number, firstDay = 1, minimalDays = 4): number {
  if (!Number.isInteger(weekYear)) {
    throw new RangeError('weekYear must be an integer')
  }
  return weeksInWeekYear(weekYear, toWeekRule(firstDay, minimalDays))
}

/**
 * Week of year and week-numbering year for a date under a CLDR week rule.
 * Defaults are ISO 8601 (`firstDay` Monday, `minimalDays` 4).
 * String input is parsed via `asDate`.
 * @param date The date
 * @param firstDay First day of week, 0..7 (0 or 7 = Sunday, default 1 = Monday)
 * @param minimalDays Days of the new year required in week 1 (1..7, default 4)
 * @param utc When true, read UTC fields instead of local fields
 */
export function weekOfYear(
  date: string | number | Date,
  firstDay = 1,
  minimalDays = 4,
  utc = false
): { week: number; year: number } {
  const rule = toWeekRule(firstDay, minimalDays)
  const d = toDate(date, utc)
  if (Number.isNaN(d.getTime())) return { week: Number.NaN, year: Number.NaN }
  const w = readWall(d.getTime(), utc)
  return weekDateOf(dayNumber(w.year, w.month, w.day), rule)
}

/**
 * Day of year (1-366) from the wall date. String input is parsed via `asDate`.
 * @param input The date
 * @param utc When true, read UTC fields instead of local fields
 */
export function dayOfYear(input: string | number | Date, utc = false): number {
  const d = toDate(input, utc)
  if (Number.isNaN(d.getTime())) return Number.NaN
  const w = readWall(d.getTime(), utc)
  return dayNumber(w.year, w.month, w.day) - dayNumber(w.year, 1, 1) + 1
}
