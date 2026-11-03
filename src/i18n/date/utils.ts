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
 * Returns x % n but takes the sign of n instead of x
 * @param x
 * @param n
 * @returns {number}
 */
function floorMod(x: number, n: number) {
  return x - n * Math.floor(x / n)
}

function parseFloating(str: string) {
  if (str != null && str !== '') return parseFloat(str)
}

function parseMilliseconds(str: string) {
  if (str != null && str !== '') {
    const f = parseFloat('0.' + str) * 1000
    return Math.floor(f)
  }
}

// DATE BASICS

/**
 * Returns the minimum (most distant past) of the given date values.
 * @template T
 * @param {Array<T>} dates
 * @returns {T} The smallest date of `dates`
 */
export function minDate<T>(dates: Array<T>): T
export function minDate<T>(...dates: Array<T>): T {
  let ans = dates[0]
  if (Array.isArray(ans)) {
    dates = ans
    ans = ans[0]
  }
  for (let i = 1; i < dates.length; i++) {
    if (dates[i].valueOf() < ans.valueOf()) {
      ans = dates[i]
    }
  }
  return ans
}

/**
 * Returns the maximum (most distant future) of the given date values.
 * @template T
 * @param {Array<T>} dates
 * @returns {T} The largest date of `dates`
 */
export function maxDate<T>(dates: Array<T>): T
export function maxDate<T>(...dates: Array<T>): T {
  let ans = dates[0]
  if (Array.isArray(ans)) {
    dates = ans
    ans = ans[0]
  }
  for (let i = 1; i < dates.length; i++) {
    if (dates[i].valueOf() > ans.valueOf()) {
      ans = dates[i]
    }
  }
  return ans
}

/**
 * Returns `true` if the year is a leap year, otherwise `false`.
 * @param year The date year
 * @returns {boolean} `true` if is a leap year
 */
export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

/**
 * Get the number of days in the given year.
 * @param year The date year
 * @returns {number} Number of days in year
 */
export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

/**
 * Get the number of days in the given date's month and year.
 * @param date The specified date
 * @returns {number} Number of days in month
 */
export function daysInMonth(date: string | number | Date): number {
  const d = new Date(date),
    year = d.getFullYear(),
    month = d.getMonth() + 1
  const modMonth = floorMod(month - 1, 12) + 1,
    modYear = year + (month - modMonth) / 12
  if (modMonth === 2) {
    return isLeapYear(modYear) ? 29 : 28
  } else {
    return [31, null, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][modMonth - 1]
  }
}

// COERCION

export function asNumber(value) {
  const numericValue = Number(value)
  if (typeof value === 'boolean' || value === '' || Number.isNaN(numericValue))
    throw new Error(`Invalid unit value ${value}`)
  return numericValue
}

const isoDuration =
  /^-?P(?:(?:(-?\d{1,20}(?:\.\d{1,20})?)Y)?(?:(-?\d{1,20}(?:\.\d{1,20})?)M)?(?:(-?\d{1,20}(?:\.\d{1,20})?)W)?(?:(-?\d{1,20}(?:\.\d{1,20})?)D)?(?:T(?:(-?\d{1,20}(?:\.\d{1,20})?)H)?(?:(-?\d{1,20}(?:\.\d{1,20})?)M)?(?:(-?\d{1,20})(?:[.,](-?\d{1,20}))?S)?)?)$/

function extractISODuration(match) {
  const [s, yearStr, monthStr, weekStr, dayStr, hourStr, minuteStr, secondStr, millisecondsStr] =
    match

  const hasNegativePrefix = s[0] === '-'
  const negativeSeconds = secondStr && secondStr[0] === '-'

  const maybeNegate = (num, force = false) =>
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
      milliseconds: maybeNegate(parseMilliseconds(millisecondsStr), negativeSeconds)
    }
  ]
}

function parse(s, ...patterns) {
  if (s == null) {
    return [null, null]
  }

  for (const [regex, extractor] of patterns) {
    const m = regex.exec(s)
    if (m) {
      return extractor(m)
    }
  }
  return [null, null]
}

export function parseISODuration(s) {
  return parse(s, [isoDuration, extractISODuration])
}

function createUTCDate(y: number, m = 0, d = 1, h = 0, min = 0, s = 0, ms = 0) {
  let date: Date
  // the Date.UTC function remaps years 0-99 to 1900-1999
  if (y < 100 && y >= 0) {
    // preserve leap years using a full 400 year cycle, then reset
    date = new Date(Date.UTC(y + 400, m, d, h, min, s, ms))
    if (isFinite(date.getUTCFullYear())) {
      date.setUTCFullYear(y)
    }
  } else {
    date = new Date(Date.UTC(y, m, d, h, min, s, ms))
  }

  return date
}

function firstWeekOffset(year, dow, doy) {
  const // first-week day -- which january is always in the first week (4 for iso, 1 for other)
    fwd = 7 + dow - doy,
    // first-week day local weekday -- which local weekday is fwd
    fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7

  return -fwdlw + fwd - 1
}

/**
 * Returns the number of weeks in the specified year.
 * @param year
 * @param firstDayOfWeek
 * @param firstDayOfYear
 */
export function weeksInYear(year: number, firstDayOfWeek = 1, firstDayOfYear = 1): number {
  const weekOffset = firstWeekOffset(year, firstDayOfWeek, firstDayOfYear),
    weekOffsetNext = firstWeekOffset(year + 1, firstDayOfWeek, firstDayOfYear)
  return (daysInYear(year) - weekOffset + weekOffsetNext) / 7
}

/**
 * Returns the week of the year for the specified date
 * @param year
 * @param dayOfYear
 * @param firstDayOfWeek
 * @param firstDayOfYear
 * @returns
 */
export function weekOfYear(date: string | number | Date, firstDayOfWeek = 1, firstDayOfYear = 1) {
  const year = new Date(date).getFullYear()
  const doy = dayOfYear(date)
  const weekOffset = firstWeekOffset(year, firstDayOfWeek, firstDayOfYear)
  const week = Math.floor((doy - weekOffset - 1) / 7) + 1
  let resWeek, resYear

  if (week < 1) {
    resYear = year - 1
    resWeek = week + weeksInYear(resYear, firstDayOfWeek, firstDayOfYear)
  } else if (week > weeksInYear(year, firstDayOfWeek, firstDayOfYear)) {
    resWeek = week - weeksInYear(year, firstDayOfWeek, firstDayOfYear)
    resYear = year + 1
  } else {
    resYear = year
    resWeek = week
  }

  return {
    week: resWeek,
    year: resYear
  }
}

export function isoWeeksInYear(year: number): number {
  return weeksInYear(year, 1, 4)
}

export function dayOfYear(input: string | number | Date): number {
  input = new Date(input)
  input.setHours(0)
  input.setMinutes(0)
  input.setSeconds(0)
  input.setMilliseconds(0)
  const start = new Date(input.getFullYear(), 0, 1, 0, 0, 0, 0)
  return Math.round((+input - start.getTime()) / 864e5) + 1
}
