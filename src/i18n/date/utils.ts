import { Function, isInteger, ValueError } from '../../globals/index.js'

export type DateParts = {
  year?: number
  month?: number
  day?: number
  weekday?: number
  hour?: number
  minute?: number
  second?: number
  millisecond?: number
}

export type DateLike = number | string | Date | DateParts

// CAPABILITIES

export function hasRelative() {
  try {
    return typeof Intl !== 'undefined' && !!Intl.RelativeTimeFormat
  } catch (e) {
    return false
  }
}

// OBJECTS AND ARRAYS

export function maybeArray(thing) {
  return Array.isArray(thing) ? thing : [thing]
}

export function bestBy(arr: Array<any>, by: Function, compare: Function<number>) {
  if (arr.length === 0) {
    return undefined
  }
  return arr.reduce((best, next) => {
    const pair = [by(next), next]
    if (!best) {
      return pair
    } else if (compare(best[0], pair[0]) === best[0]) {
      return best
    } else {
      return pair
    }
  }, null)[1]
}

// NUMBERS AND STRINGS

export function integerBetween(thing: number, bottom: number, top: number) {
  return isInteger(thing) && thing >= bottom && thing <= top
}

/**
 * Returns x % n but takes the sign of n instead of x
 * @param x
 * @param n
 * @returns {number}
 */
export function floorMod(x: number, n: number) {
  return x - n * Math.floor(x / n)
}

export function padStart(input: number, n = 2) {
  const isNeg = input < 0
  let padded
  if (isNeg) {
    padded = '-' + ('' + -input).padStart(n, '0')
  } else {
    padded = ('' + input).padStart(n, '0')
  }
  return padded
}

export function parseInteger(str: string) {
  if (str != null && str !== '') return parseInt(str, 10)
}

export function parseFloating(str: string) {
  if (str != null && str !== '') return parseFloat(str)
}

export function parseMilliseconds(str: string) {
  if (str != null && str !== '') {
    const f = parseFloat('0.' + str) * 1000
    return Math.floor(f)
  }
}

export function roundTo(number: number, digits: number, towardZero = false) {
  const factor = 10 ** digits,
    rounder = towardZero ? Math.trunc : Math.round
  return rounder(number * factor) / factor
}

// DATE BASICS

/**
 * Returns the minimum (most distant past) of the given date values.
 * @template T
 * @param {Array<T>} dates
 * @returns {T} The smallest date of `dates`
 */
export function minDate<T>(dates: Array<T>): T
export function minDate<T>(...dates: Array<T>) {
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
export function maxDate<T>(...dates: Array<T>) {
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
export function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

/**
 * Get the number of days in the given year.
 * @param year The date year
 * @returns {number} Number of days in year
 */
export function daysInYear(year: number) {
  return isLeapYear(year) ? 366 : 365
}

/**
 * Get the number of days in the given month and year.
 * @param year The date year
 * @param month The date month as a number between 1 and 12, inclusive.
 * @returns {number} Number of days in month
 */
export function daysInMonth(year: number, month: number) {
  const modMonth = floorMod(month - 1, 12) + 1,
    modYear = year + (month - modMonth) / 12

  if (modMonth === 2) {
    return isLeapYear(modYear) ? 29 : 28
  } else {
    return [31, null, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][modMonth - 1]
  }
}

// covert a calendar object to a local timestamp (epoch, but with the offset baked in)
export function objToLocalTS(obj: DateParts) {
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

/**
 * Gets the number of weeks according to locale in the current moment's year.
 * @param {number} weekYear The the date year
 * @returns {number}
 */
export function weeksInYear(weekYear: number) {
  const p1 =
      (weekYear +
        Math.floor(weekYear / 4) -
        Math.floor(weekYear / 100) +
        Math.floor(weekYear / 400)) %
      7,
    last = weekYear - 1,
    p2 = (last + Math.floor(last / 4) - Math.floor(last / 100) + Math.floor(last / 400)) % 7
  return p1 === 4 || p2 === 3 ? 53 : 52
}

export function untruncateYear(year: number) {
  if (year > 99) {
    return year
  } else return year > 60 ? 1900 + year : 2000 + year
}

// PARSING

export function parseZoneInfo(ts: number | Date, offsetFormat, locale, timeZone?) {
  const date = new Date(ts),
    intlOpts: Intl.DateTimeFormatOptions = {
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone
    }

  const modified = { timeZoneName: offsetFormat, ...intlOpts }

  const parsed = new Intl.DateTimeFormat(locale, modified)
    .formatToParts(date)
    .find((m) => m.type.toLowerCase() === 'timezonename')
  return parsed ? parsed.value : null
}

// signedOffset('-5', '30') -> -330
export function signedOffset(offHourStr: string, offMinuteStr: string) {
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
    throw new ValueError(`Invalid unit value ${value}`)
  return numericValue
}

export function formatOffset(offset: number, format: 'short' | 'narrow' | 'techie') {
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

export function timeObject(obj: DateParts) {
  const { hour, minute, second, millisecond } = obj
  return { hour, minute, second, millisecond }
}

export const ianaRegex =
  /[A-Za-z_+-]{1,256}(?::?\/[A-Za-z0-9_+-]{1,256}(?:\/[A-Za-z0-9_+-]{1,256})?)?/

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
