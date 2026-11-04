import { asDate } from '../format.js'
import { lastDayOfMonth } from './arith.js'
import { dayNumber, MAX_TIME_MS, readWall, toWeekRule, weekCount, weekDateOf } from './calendar.js'

/** Calendar fields for IntlDate object construction and `set`. */
export interface DateObject {
  year?: number
  month?: number
  day?: number
  /** 1 (Monday) to 7 (Sunday): moves the date within its ISO week. */
  weekday?: number
  hour?: number
  minute?: number
  second?: number
  millisecond?: number
}

/**
 * Epoch milliseconds for a date-like value. Strings are parsed as local time via `asDate`,
 * the same parsing `IntlDate` uses. Invalid input, including numbers outside the Date range,
 * yields `NaN`.
 */
function defaultTime(value: unknown): number {
  if (typeof value === 'string') return asDate(value).getTime()
  if (value === null) return Number.NaN
  const time = Number(value)
  return Math.abs(time) <= MAX_TIME_MS ? time : Number.NaN
}

function pickExtreme<T>(
  dates: readonly T[],
  toTime: (value: T) => number,
  better: (candidate: number, current: number) => boolean
): T | undefined {
  if (!Array.isArray(dates)) throw new TypeError('dates must be an array')
  let ans: T | undefined
  let ansTime = Number.NaN
  for (const value of dates as readonly T[]) {
    const time = toTime(value)
    if (Number.isNaN(time)) continue
    if (Number.isNaN(ansTime) || better(time, ansTime)) {
      ans = value
      ansTime = time
    }
  }
  return ans
}

/**
 * Returns the minimum (most distant past) of the given date values, or `undefined` when the
 * list has no valid date. Invalid dates are ignored. String input is parsed as local time.
 * @param dates Date-like values, as an array (anything else throws `TypeError`).
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
 * @param dates Date-like values, as an array (anything else throws `TypeError`).
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
  const d = toDate(date)
  return lastDayOfMonth(d.getFullYear(), d.getMonth())
}

/** `asDate` for a required argument: a missing value is invalid, not the current time. */
function toDate(input: string | number | Date | null | undefined, utc = false): Date {
  return asDate(input ?? null, utc)
}

/**
 * Number of weeks in a week-numbering year under a CLDR week rule.
 * Defaults are ISO 8601 (`firstDay` Monday, `minimalDays` 4).
 * @param weekYear Week-numbering year (safe integer)
 * @param firstDay First day of week, 0..7 (0 or 7 = Sunday, default 1 = Monday)
 * @param minimalDays Days of the new year required in week 1 (1..7, default 4)
 */
export function weeksInYear(weekYear: number, firstDay = 1, minimalDays = 4): number {
  if (!Number.isSafeInteger(weekYear)) {
    throw new RangeError('weekYear must be a safe integer')
  }
  // 400 Gregorian years are a whole number of weeks, and day numbers stay exact below that
  return weekCount(weekYear % 400, toWeekRule(firstDay, minimalDays))
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
