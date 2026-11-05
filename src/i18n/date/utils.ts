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

function padStart(input: number, n = 2) {
  const isNeg = input < 0
  let padded
  if (isNeg) {
    padded = '-' + ('' + -input).padStart(n, '0')
  } else {
    padded = ('' + input).padStart(n, '0')
  }
  return padded
}

function parseInteger(str: string) {
  if (str != null && str !== '') return parseInt(str, 10)
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

// covert a calendar object to a local timestamp (epoch, but with the offset baked in)
function objToLocalTS(obj: DateObject): number {
  let d = Date.UTC(
    obj.year,
    obj.month - 1,
    obj.day,
    obj.hour,
    obj.minute,
    obj.second,
    obj.millisecond
  )
  // for legacy reasons, years between 0 and 99 are interpreted as 19XX; revert that
  if (obj.year < 100 && obj.year >= 0) {
    let dt = new Date(d)
    dt.setUTCFullYear(dt.getUTCFullYear() - 1900)
    d = dt.getTime()
  }
  return +d
}

function untruncateYear(year: number): number {
  if (year > 99) {
    return year
  } else return year > 60 ? 1900 + year : 2000 + year
}

// PARSING

function parseZoneInfo(ts: number | Date, offsetFormat, locale, timeZone?) {
  const date = new Date(ts),
    intlOpts: Intl.DateTimeFormatOptions = {
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
      timeZoneName: offsetFormat
    }
  const parsed = new Intl.DateTimeFormat(locale, intlOpts)
    .formatToParts(date)
    .find((m) => m.type === 'timeZoneName')
  return parsed?.value
}

// signedOffset('-5', '30') -> -330
function signedOffset(offHourStr: string, offMinuteStr: string) {
  let offHour = parseInt(offHourStr, 10)

  // don't || this because we want to preserve -0
  if (Number.isNaN(offHour)) {
    offHour = 0
  }

  const offMin = parseInt(offMinuteStr, 10) || 0,
    offMinSigned = offHour < 0 || Object.is(offHour, -0) ? -offMin : offMin
  return offHour * 60 + offMinSigned
}

// COERCION

export function asNumber(value) {
  const numericValue = Number(value)
  if (typeof value === 'boolean' || value === '' || Number.isNaN(numericValue))
    throw new Error(`Invalid unit value ${value}`)
  return numericValue
}

function formatOffset(offset: number, format: 'short' | 'narrow' | 'techie') {
  const hours = Math.trunc(Math.abs(offset / 60)),
    minutes = Math.trunc(Math.abs(offset % 60)),
    sign = offset >= 0 ? '+' : '-'

  switch (format) {
    case 'short':
      return `${sign}${padStart(hours, 2)}:${padStart(minutes, 2)}`
    case 'narrow':
      return `${sign}${hours}${minutes > 0 ? `:${minutes}` : ''}`
    case 'techie':
      return `${sign}${padStart(hours, 2)}${padStart(minutes, 2)}`
    default:
      throw new RangeError(`Value format ${format} is out of range for property format`)
  }
}

function timeObject(obj: DateObject) {
  const { hour, minute, second, millisecond } = obj
  return { hour, minute, second, millisecond }
}

const ianaRegex = /[A-Za-z_+-]{1,256}(?::?\/[A-Za-z0-9_+-]{1,256}(?:\/[A-Za-z0-9_+-]{1,256})?)?/

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

function createUTCDate(...args) {
  let date,
    y = args[0]
  // the Date.UTC function remaps years 0-99 to 1900-1999
  if (y < 100 && y >= 0) {
    args = Array.from(arguments)
    // preserve leap years using a full 400 year cycle, then reset
    args[0] = y + 400
    date = new Date(Date.UTC.apply(null, args))
    if (isFinite(date.getUTCFullYear())) {
      date.setUTCFullYear(y)
    }
  } else {
    date = new Date(Date.UTC.apply(null, arguments))
  }

  return date
}

function firstWeekOffset(year, dow, doy) {
  var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
    fwd = 7 + dow - doy,
    // first-week day local weekday -- which local weekday is fwd
    fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7

  return -fwdlw + fwd - 1
}

// https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
  var localWeekday = (7 + weekday - dow) % 7,
    weekOffset = firstWeekOffset(year, dow, doy),
    dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
    resYear,
    resDayOfYear

  if (dayOfYear <= 0) {
    resYear = year - 1
    resDayOfYear = daysInYear(resYear) + dayOfYear
  } else if (dayOfYear > daysInYear(year)) {
    resYear = year + 1
    resDayOfYear = dayOfYear - daysInYear(year)
  } else {
    resYear = year
    resDayOfYear = dayOfYear
  }

  return {
    year: resYear,
    dayOfYear: resDayOfYear
  }
}

/**
 * Returns the number of weeks in the specified year.
 * @param year
 * @param firstDayOfWeek
 * @param firstDayOfYear
 */
export function weeksInYear(year: number, firstDayOfWeek = 1, firstDayOfYear = 1): number {
  var weekOffset = firstWeekOffset(year, firstDayOfWeek, firstDayOfYear),
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
  let weekOffset = firstWeekOffset(year, firstDayOfWeek, firstDayOfYear),
    week = Math.floor((doy - weekOffset - 1) / 7) + 1,
    resWeek,
    resYear

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
  let start = new Date(input.getFullYear(), 0, 1, 0, 0, 0, 0)
  return Math.round((+input - start.getTime()) / 864e5) + 1
}
