import { isObject } from '../../globals/index.js'
import { format, getDate } from './format.js'

let globalOptions

const systemOptions = () => {
  if (!globalOptions) globalOptions = Intl.DateTimeFormat().resolvedOptions()
  return globalOptions
}

const FORMAT_DEFAULT = 'YYYY-MM-DDTHH:mm:ssZ'

const INVALID_DATE_STRING = 'Invalid Date'

export type DateParts = {
  year?: number
  month?: number
  day?: number
  hour?: number
  minute?: number
  second?: number
  millisecond?: number
}

export type DateLike = number | string | Date | DateParts

/**
 * Creates a date tied to a given locale (default system locale) which can be formatted in that locale's language using the native {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl Intl Apis} directly or using a formatting string compatible with `strftime`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl Intl Apis}
 * @see {@link https://strftime.org/ strftime format}
 */
export class IntlDate {
  private self: Date
  readonly year: number
  readonly M: number
  readonly day: number
  readonly weekDay: number
  readonly hour: number
  readonly minute: number
  readonly second: number
  readonly millisecond: number
  readonly locale: string

  /** Returns the current UTC date and time. */
  static UTC(obj: DateLike = {}) {
    return new IntlDate(obj, { utc: true })
  }

  /** Returns the current local date and time.*/
  static now() {
    return new IntlDate()
  }

  /**
   * Creates a new `IntlDate` tied to the specified locale (default is system locale).
   * **Note:** The allowed values for `month` start at 1, which is different from legacy `Date`
   * @param {DateLike | IntlDate} obj The date value (default is now)
   * @param {{locale?: string, utc?: boolean}} opts
   * @returns
   */
  constructor(obj?: DateLike | IntlDate, { locale, utc }: any = {}) {
    // Set the default DateTime locale
    this.locale = locale || systemOptions().locale
    if (obj instanceof IntlDate) obj = obj.self

    if (typeof obj === 'string' || typeof obj === 'number' || obj instanceof Date) {
      this.self = getDate(obj, utc)
    } else if (isObject(obj)) {
      let { year, month, day, hour, minute, second, millisecond } = obj
      // NOTE month is from 1-12, not from 0-11
      if (typeof month === 'number') month -= 1
      if (utc) {
        // from UTC to current
        this.self = new Date(Date.UTC(year!, month!, day, hour, minute, second, millisecond))
      } else {
        this.self = new Date(year!, month!, day, hour, minute, second, millisecond)
      }
    } else {
      this.self = new Date()
    }

    this.year = this.self.getFullYear()
    this.M = this.self.getMonth()
    this.weekDay = this.self.getDay()
    this.day = this.self.getDate()
    this.hour = this.self.getHours()
    this.minute = this.self.getMinutes()
    this.second = this.self.getSeconds()
    this.millisecond = this.self.getMilliseconds()
    return this
  }

  isValid() {
    return this.self.toString() !== INVALID_DATE_STRING
  }

  /** Get the this date's month as a number from 1-12. */
  get month() {
    return this.M + 1
  }

  /** Get the number of days in this date's month. */
  daysInMonth() {
    return daysInMonth(this.year, this.M)
  }

  /** Get the number of days in this date's year. */
  daysInYear() {
    return daysInYear(this.year)
  }

  /** Returns `true` if this date's year is a leap year, otherwise `false`. */
  isLeapYear() {
    return isLeapYear(this.year)
  }

  /** Gets the number of weeks according to locale in the current moment's year. */
  weeksInYear() {
    return weeksInYear(this.year)
  }

  /**
   * Returns a localized string representation of this date.
   * @param {Intl.DateTimeFormatOptions} opts The options to use for the format
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat Intl.DateTimeFormat()}
   */
  toString(opts?: Intl.DateTimeFormatOptions) {
    return this.self.toLocaleDateString(this.locale, opts)
  }

  /**
   * Returns a localized string representation of this date, according to the given format string. Format codes use the same specification as C / Python's strftime().
   * @param {string} str The format string to use
   * @see {@link https://docs.python.org/3/library/datetime.html#strftime-and-strptime-format-codes Format Codes}
   * @example
```js
new IntlDate().format('%m/%d/%y') // '10/31/2022'
```
   */
  format(str: string) {
    return format(str, this.self, this.locale)
  }

  /**
   * Returns a new copy of the native `Date` object used by this instance.
   * @returns {Date} A new `Date` object
   */
  toDate() {
    return new Date(this.isValid() ? this.self : NaN)
  }

  /**
   * Returns the timestamp representing the UTC equivalent of this date.
   * @returns {number} The UTC timestamp of this date.
   */
  toUTC() {
    return dateToUTC(this.self)
  }

  /**
   * Returns the number of seconds since the Unix Epoch (January 1, 1970 UTC).
   * @see {@link IntlDate.timestamp}
   * @see {@link IntlDate.unix}
   * @example
```js
new IntlDate().toSeconds() // 1318874398
```
   */
  toSeconds() {
    return Math.trunc(this.valueOf() / 1000)
  }

  /**
   * Returns the number of seconds since the Unix Epoch (January 1, 1970 UTC).
   * @see {@link IntlDate.toSeconds}
   * @see {@link IntlDate.unix}
   * @example
```js
new IntlDate().timestamp() // 1318874398
```
   */
  timestamp() {
    return this.toSeconds()
  }

  /**
   * Returns the number of seconds since the Unix Epoch (January 1, 1970 UTC).
   * @see {@link IntlDate.toSeconds}
   * @see {@link IntlDate.timestamp}
   * @example
```js
new IntlDate().unix() // 1318874398
```
   */
  unix() {
    return this.toSeconds()
  }

  /** Formats a string to the ISO8601 standard.
   * @example
```js
new IntlDate().toISOString() // '2022-10-31T22:44:30.652Z'
```
   */
  toISOString() {
    return this.self.toISOString()
  }

  /** Returns the date part formatted as ISO8601.
   * @example
```js
new IntlDate().toISODate() // '2022-10-31'
```
   */
  toISODate() {
    return this.self.toISOString().slice(0, 10)
  }

  /** Returns the time part formatted as ISO8601.
   * @example
```js
new IntlDate().toISOTime() // 'T22:44:30.652Z'
```
   */
  toISOTime() {
    return this.self.toISOString().slice(11)
  }

  /**
   * Returns an object containing year, month, day-of-month, hours, minutes, seconds, milliseconds.
   * @returns {Object} An object like `{year, month, date, hours, minutes, seconds, ms}`
   */
  toObject(): DateParts {
    return {
      year: this.year,
      month: this.month,
      day: this.day,
      hour: this.hour,
      minute: this.M,
      second: this.second,
      millisecond: this.millisecond
    }
  }

  /** Returns the number of milliseconds since the Unix Epoch (January 1, 1970 UTC)  */
  valueOf() {
    return this.isValid() ? this.self.getTime() : NaN
  }

  /** Returns the timezone string name  */
  zoneName() {
    return this.format('%Z')
  }

  /** Returns the timezone GMT offset name  */
  offset() {
    return this.format('%z')
  }

  /**
   * Check if this date is before another date. The other value will be parsed as an `IntlDate` if not already so.
   * @param {string | number | Object | Date | IntlDate} other Another date or date like object
   * @returns {boolean} Returns `true` if this date is before the given value
   */
  isBefore(other: DateLike | IntlDate) {
    if (!this.isValid()) return false

    if (other instanceof IntlDate) {
      return this.valueOf() < other.valueOf()
    }

    return this.valueOf() < new IntlDate(other).valueOf()
  }

  /**
   * Check if this date is strictly after the given `start` and before `stop` dates. The values will be parsed as an `IntlDate` if not already so.
   * @param {string | number | Object | Date | IntlDate} start The smaller date
   * @param {string | number | Object | Date | IntlDate} stop The larger date
   * @returns {boolean} Returns `true` if this date is greater than `start` and less than `stop`.
   */
  isBetween(start: DateLike | IntlDate, stop: DateLike | IntlDate) {
    return this.isAfter(start) && this.isBefore(stop)
  }

  /**
   * Check if this date is after another date. The other value will be parsed as an `IntlDate` if not already so.
   * @param {string | number | DateParts | Date | IntlDate} other Another date or date like object
   * @returns {boolean} Returns `true` if this date is after the given value
   */
  isAfter(other: DateLike | IntlDate) {
    if (!this.isValid()) return false

    if (other instanceof IntlDate) {
      return this.valueOf() > other.valueOf()
    }

    return this.valueOf() > new IntlDate(other).valueOf()
  }

  /**
   * Check if this date is the same as `other`.
   * @param other Another date object
   * @returns {boolean} Returns `true` if this date is the same as other
   */
  isSame(other: Date | IntlDate) {
    if (other instanceof IntlDate) {
      return (
        this.isValid() &&
        other.isValid() &&
        this.valueOf() === other.valueOf() &&
        this.locale === other.locale
      )
    }
    return this.valueOf() === other.valueOf()
  }

  /**
   * Returns the minimum (most distant past) of the given date values.
   * @param {Array<Date | IntlDate>} dates
   * @returns {Date | IntlDate} The smallest date of `dates`
   * @see {@link minDate}
   */
  static min(...dates: Array<Date | IntlDate>) {
    return minDate(...dates)
  }

  /**
   * Returns the maximum (most distant future) of the given date values.
   * @param {Array<Date | IntlDate>} dates
   * @returns {Date | IntlDate} The largest date of `dates`
   * @see {@link maxDate}
   */
  static max(...dates: Array<Date | IntlDate>) {
    return maxDate(...dates)
  }

  lt(other: Date | IntlDate) {
    return this.isBefore(other)
  }

  eq(other: Date | IntlDate) {
    return this.isSame(other)
  }

  compare(other: Date | IntlDate) {
    if (this.isBefore(other)) return -1
    if (this.isAfter(other)) return 1
    return 0
  }

  // TODO:
  // Display
  // Time from now
  // Time from X
  // Difference

  // Parsing
  // Parse String + Date Format
  // Parse String + Time Format
  // Parse String + Format + locale

  // Manipulate
  // Add
  // Subtract
  // Start of Time
  // End of Time
}

/**
 * Converts the given date to a UTC timestamp.
 * @param {Date} date
 * @returns {number} The milliseconds between the specified date and the UTC Epoch date.
 */
export function dateToUTC(date: Date) {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  )
}

/**
 * Returns the minimum (most distant past) of the given date values.
 * @param {Array<Date | IntlDate>} dates
 * @returns {Date | IntlDate} The smallest date of `dates`
 */
export function minDate(...dates: Array<Date | IntlDate>) {
  let result = dates[0]
  for (let i = 1; i < dates.length; i++) {
    if (dates[i].valueOf() < result.valueOf()) {
      result = dates[i]
    }
  }
  return result
}

/**
 * Returns the maximum (most distant future) of the given date values.
 * @param {Array<Date | IntlDate>} dates
 * @returns {Date | IntlDate} The largest date of `dates`
 */
export function maxDate(...dates: Array<Date | IntlDate>) {
  let result = dates[0]
  for (let i = 1; i < dates.length; i++) {
    if (dates[i].valueOf() > result.valueOf()) {
      result = dates[i]
    }
  }
  return result
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
 * @param month The date month
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

// x % n but takes the sign of n instead of x
function floorMod(x: number, n: number) {
  return x - n * Math.floor(x / n)
}
