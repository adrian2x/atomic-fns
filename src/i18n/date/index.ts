import { isObject, ValueError } from '../../globals/index.js'
import { Duration, DurationUnit, TDuration, UNITS_PLURAL } from '../duration.js'
import { asDate, formatDate, strftime } from '../format.js'
import {
  asNumber,
  DateObject,
  dayOfYear,
  daysInMonth,
  daysInYear,
  isLeapYear,
  maxDate,
  minDate,
  weekOfYear,
  weeksInYear
} from './utils.js'

// Export date functions
export {
  asDate,
  daysInMonth,
  daysInYear,
  formatDate,
  isLeapYear,
  maxDate,
  minDate,
  strftime,
  weeksInYear
}

export { DateObject }
export type DateLike = number | string | Date | IntlDate | DateObject

const INVALID_DATE_STRING = 'Invalid Date'

/**
 * Creates a date tied to a given locale (default system locale) which can be formatted in that locale's language using the native {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl Intl Apis} directly or using a formatting string.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl Intl Apis}
 */
export class IntlDate {
  private _date: Date
  readonly locale?: string
  intlRelativeFormat: Intl.RelativeTimeFormat

  /** Parses the provided value as UTC date or returns the current UTC date. */
  static UTC(value?: DateLike, locale?: string) {
    return new IntlDate(value, { utc: true, locale })
  }

  /** Returns the current local date and time. */
  static now() {
    return new IntlDate()
  }

  /** Creates a new date from a Unix timestamp (seconds since the unix epoch) */
  static unix(seconds: number) {
    return new IntlDate(seconds * 1000)
  }

  /**
   * Creates a new `IntlDate` in local time and specified locale (default is system locale).
   * **Note:** The allowed values for `month` start at 1, which is different from legacy `Date`
   * @param {DateLike} obj The date value (default is current local time)
   * @param {Object} opts The options for this date
   * @param {boolean?} opts.utc Converts input or current time to UTC
   * @param {string?} opts.locale A locale string to use for this date
   * @returns
   */
  constructor(obj?: DateLike, { locale, utc }: any = {}) {
    this.locale = locale

    if (obj instanceof IntlDate) {
      obj = obj._date
    }

    if (typeof obj === 'string' || typeof obj === 'number' || obj instanceof Date) {
      this._date = asDate(obj, utc)
    } else if (isObject(obj)) {
      let { year, month, day, hour, minute, second, millisecond } = obj

      // NOTE month is from 1-12, not from 0-11
      if (typeof month === 'number') {
        month -= 1
      }

      if (utc) {
        // from UTC to current
        this._date = new Date(
          Date.UTC(year, month, day || 1, hour || 0, minute || 0, second || 0, millisecond || 0)
        )
      } else {
        this._date = new Date(
          year,
          month,
          day || 1,
          hour || 0,
          minute || 0,
          second || 0,
          millisecond || 0
        )
      }
    } else {
      this._date = asDate(obj, utc)
    }

    return this
  }

  /** Get the date's year. */
  get year() {
    return this._date.getFullYear()
  }

  /** Get the this date's month as a number from 1 to 12, inclusive. */
  get month() {
    return this._date.getMonth() + 1
  }

  /** Returns the weekday as a number between 1 and 7, inclusive, where Monday is 1 and Sunday is 7. */
  get dayOfWeek() {
    if (this._date.getDay() === 0) return 7
    return this._date.getDay()
  }

  /** Get the this date's current day of the month. */
  get day() {
    return this._date.getDate()
  }

  /** Get the this date's current hour. */
  get hour() {
    return this._date.getHours()
  }

  /** Get the this date's current minute. */
  get minute() {
    return this._date.getMinutes()
  }

  /** Get the this date's current second. */
  get second() {
    return this._date.getSeconds()
  }

  /** Get the this date's current millisecond. */
  get millisecond() {
    return this._date.getMilliseconds()
  }

  isValid() {
    return this._date.toString() !== INVALID_DATE_STRING
  }

  /** Get the number of days in this date's month. */
  daysInMonth() {
    return daysInMonth(this._date)
  }

  /** Get the number of days in this date's year. */
  daysInYear() {
    return daysInYear(this.year)
  }

  dayOfYear() {
    return dayOfYear(this._date)
  }

  /** Returns `true` if this date's year is a leap year. */
  isLeapYear() {
    return isLeapYear(this.year)
  }

  /** Gets the number of weeks according to locale in the current year. */
  weeksInYear() {
    return weeksInYear(this.year)
  }

  /** Gets the number of weeks in the current year, according to ISO weeks. */
  isoWeeksInYear() {
    return weeksInYear(this.year, 1, 4)
  }

  /** Returns the current week of the year. */
  week() {
    return weekOfYear(this._date).week
  }

  /** Returns the ISO week of the year. */
  isoWeek() {
    return weekOfYear(this._date, 1, 4).week
  }

  /**
   * Returns a localized string representation of this date.
   * @param {Intl.DateTimeFormatOptions} opts The options to use for the format
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat Intl.DateTimeFormat()}
   */
  toString(opts?: Intl.DateTimeFormatOptions) {
    return this._date.toLocaleString(this.locale, opts)
  }

  /**
   * Returns a localized string representation of this date, according to the given format string. Format codes use the same specification as {@link https://momentjs.com/docs/#/displaying/format/ moment}.
   * @param {string} str The format string to use
   * @see {@link https://momentjs.com/docs/#/displaying/format/ List of formats}
   * @example
```js
new IntlDate().format('MM/DD/YYYY') // '10/31/2022'
```
   */
  format(str: string) {
    return formatDate(str, this._date, this.locale)
  }

  /**
   * Returns a new copy of the native `Date` object used by this instance.
   * @returns {Date} A new `Date` object
   */
  toDate() {
    return new Date(this.isValid() ? this._date : NaN)
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
    return Math.trunc(this.getTime() / 1000)
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
    return this._date.toISOString()
  }

  /** Returns the date part formatted as ISO8601.
   * @example
```js
new IntlDate().toISODate() // '2022-10-31'
```
   */
  toISODate() {
    return this._date.toISOString().slice(0, 10)
  }

  /** Returns the time part formatted as ISO8601.
   * @example
```js
new IntlDate().toISOTime() // 'T22:44:30.652Z'
```
   */
  toISOTime() {
    return this._date.toISOString().slice(11)
  }

  /**
   * Returns an object containing year, month, day-of-month, hours, minutes, seconds, milliseconds.
   * @returns {Object} An object like `{year, month, date, hours, minutes, seconds, ms}`
   */
  toObject(): DateObject {
    return {
      year: this.year,
      month: this.month,
      day: this.day,
      hour: this.hour,
      minute: this.minute,
      second: this.second,
      millisecond: this.millisecond
    }
  }

  /** Returns the number of milliseconds since the Unix Epoch (January 1, 1970 UTC)  */
  getTime() {
    return this.isValid() ? this._date.getTime() : NaN
  }

  /** Alias of {@link IntlDate.getTime}  */
  valueOf() {
    return this.getTime()
  }

  /** Returns the timezone string name  */
  zoneName() {
    return this.format('zzz')
  }

  /** Returns the timezone GMT offset as a string  */
  zone() {
    return this.format('ZZ')
  }

  /** Returns the difference in `minutes` between this date and UTC  */
  utcOffset() {
    return this._date.getTimezoneOffset()
  }

  /**
   * Check if this date is before another date. The other value will be parsed as an `IntlDate` if not already so.
   * @param {DateLike} other Another date or date like object
   * @returns {boolean} Returns `true` if this date is before the given value
   */
  isBefore(other: DateLike) {
    if (other instanceof IntlDate) {
      return this.getTime() < other.getTime()
    }
    return this.getTime() < new IntlDate(other).getTime()
  }

  /**
   * Check if this date is strictly after the given `start` and before `stop` dates. The values will be parsed as an `IntlDate` if not already so.
   * @param {DateLike} start The smaller date
   * @param {DateLike} stop The larger date
   * @returns {boolean} Returns `true` if this date is greater than `start` and less than `stop`.
   */
  isBetween(start: DateLike, stop: DateLike) {
    return this.isAfter(start) && this.isBefore(stop)
  }

  /**
   * Check if this date is after another date. The other value will be parsed as an `IntlDate` if not already so.
   * @param {DateLike} other Another date or date like object
   * @returns {boolean} Returns `true` if this date is after the given value
   */
  isAfter(other: DateLike) {
    if (other instanceof IntlDate) {
      return this.getTime() > other.getTime()
    }
    return this.getTime() > new IntlDate(other).getTime()
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
        this.getTime() === other.getTime() &&
        this.locale === other.locale
      )
    }
    return this.getTime() === other.getTime()
  }

  lt(other: Date | IntlDate) {
    return this.isBefore(other)
  }

  eq(other: Date | IntlDate) {
    return this.isSame(other)
  }

  compare(other: Date | IntlDate) {
    if (!this.isValid()) return 1

    const dt = new IntlDate(other)
    if (!dt.isValid()) return -1

    return this.getTime() - dt.getTime()
  }

  set(values: DateObject) {
    if (!this.isValid()) return this

    const normalized = normalizeObject(values, normalizeUnit)

    const mixed = { ...this.toObject(), ...normalized }

    // if we didn't set the day but we ended up on an overflow date,
    // use the last day of the right month
    if (normalized.day === undefined) {
      mixed.day = Math.min(daysInMonth(this._date), mixed.day)
    }

    return this.clone(mixed)
  }

  get relativeFormat() {
    if (this.intlRelativeFormat) return this.intlRelativeFormat
    this.intlRelativeFormat = new Intl.RelativeTimeFormat(this.locale)
    return new Intl.RelativeTimeFormat(this.locale)
  }

  relativeTime(n: number, unit: Intl.RelativeTimeFormatUnit = 'seconds') {
    return this.relativeFormat.format(n, unit)
  }

  fromNow(unit: Intl.RelativeTimeFormatUnit = 'seconds') {
    const diff = this.diff(new Date(), unit)
    return this.relativeTime(diff, unit)
  }

  from(other: DateLike, unit: Intl.RelativeTimeFormatUnit = 'seconds') {
    const diff = this.diff(other, unit)
    return this.relativeTime(diff, unit)
  }

  toNow(unit: Intl.RelativeTimeFormatUnit = 'seconds') {
    const diff = this.diff(new Date(), unit)
    return this.relativeTime(-diff, unit)
  }

  to(other: DateLike, unit: Intl.RelativeTimeFormatUnit = 'seconds') {
    const diff = this.diff(other, unit)
    return this.relativeTime(-diff, unit)
  }

  diff(other: DateLike, unit: DurationUnit = 'milliseconds', exact = false) {
    const dt = new IntlDate(other)
    const dur = new Duration(this.getTime() - dt.getTime(), exact)
    let total = dur.total(unit)
    if (!exact) total = Math.trunc(total)
    return total
  }

  add(duration: TDuration, exact = false) {
    return this.clone(addDuration(this._date, duration, exact))
  }

  subtract(duration: TDuration, exact = false) {
    return this.clone(subDuration(this._date, duration, exact))
  }

  startOf(unit: DurationUnit) {
    if (!this.isValid()) return this
    const obj: DateObject = {}
    const normalizedUnit = UNITS_PLURAL[unit.toLowerCase()]
    switch (normalizedUnit) {
      case 'years':
        obj.month = 1
      // falls through
      case 'quarters':
      case 'months':
        obj.day = 1
      // falls through
      case 'weeks':
      case 'days':
        obj.hour = 0
      // falls through
      case 'hours':
        obj.minute = 0
      // falls through
      case 'minutes':
        obj.second = 0
      // falls through
      case 'seconds':
        obj.millisecond = 0
        break
      case 'milliseconds':
        break
      // no default, invalid units throw in normalizeUnit()
    }

    if (normalizedUnit === 'weeks') {
      obj.weekday = 1
    }

    if (normalizedUnit === 'quarters') {
      const q = Math.ceil(this.month / 3)
      obj.month = (q - 1) * 3 + 1
    }

    return this.set(obj)
  }

  endOf(unit: DurationUnit) {
    return this.isValid()
      ? this.add({ [unit]: 1 })
          .startOf(unit)
          .subtract({ milliseconds: 1 })
      : this
  }

  clone(date?: DateLike) {
    return new IntlDate(date ?? this, { locale: this.locale })
  }

  static max(...args) {
    return maxDate.apply(undefined, args)
  }

  static min(...args) {
    return minDate.apply(undefined, args)
  }

  inspect() {
    return `new IntlDate("${this.toISOString()}")`
  }
}

// Check if the new offset is different because we crossed to DST
function fixOffset(startDate: Date, endDate: Date) {
  const startOffset = startDate.getTimezoneOffset()
  const endOffset = endDate.getTimezoneOffset()
  if (startOffset === endOffset) return new Date(endDate)
  const postoffset = (startOffset - endOffset) * 60 * 1000
  return new Date(+endDate + postoffset)
}

export function addDuration(
  date: number | string | Date,
  duration: number | Duration | TDuration,
  exact = false
): Date {
  // Get the current offset of this date timezone
  const newDate = new Date(date)
  // Get the number of ticks forward
  const { values } = new Duration(duration, exact).normalize()
  // Apply any time changes that may have happened
  for (const unit in values) {
    setDateUnit(newDate, unit, Math.floor(values[unit]))
  }
  return fixOffset(new Date(date), newDate)
}

function setDateUnit(date: Date, unit: string, value: number) {
  switch (unit) {
    case 'years':
      date.setFullYear(date.getFullYear() + value)
      break

    case 'quarters':
      date.setMonth(date.getMonth() + value * 3)
      break

    case 'months':
      date.setMonth(date.getMonth() + value)
      break

    case 'weeks':
      date.setDate(date.getDate() + value * 7)
      break

    case 'days':
      date.setDate(date.getDate() + value)
      break

    case 'hours':
      date.setHours(date.getHours() + value)
      break

    case 'minutes':
      date.setMinutes(date.getMinutes() + value)
      break

    case 'seconds':
      date.setSeconds(date.getSeconds() + value)
      break

    case 'milliseconds':
      date.setMilliseconds(date.getMilliseconds() + value)
      break

    default:
      break
  }

  return date
}

/**
 * Subtract the specified years, months, weeks, days, hours, minutes and seconds from the given date.
 * @param date
 * @param duration
 * @param exact
 * @returns
 */
export function subDuration(
  date: number | string | Date,
  duration: number | Duration | TDuration,
  exact = false
): Date {
  return addDuration(date, new Duration(duration, exact).negated(), exact)
}

const UNITS_SINGULAR = {
  year: 'year',
  years: 'year',
  month: 'month',
  months: 'month',
  day: 'day',
  days: 'day',
  hour: 'hour',
  hours: 'hour',
  minute: 'minute',
  minutes: 'minute',
  quarter: 'quarter',
  quarters: 'quarter',
  second: 'second',
  seconds: 'second',
  millisecond: 'millisecond',
  milliseconds: 'millisecond',
  weekday: 'weekday',
  weekdays: 'weekday',
  weeknumber: 'weekNumber',
  weeksnumber: 'weekNumber',
  weeknumbers: 'weekNumber',
  weekyear: 'weekYear',
  weekyears: 'weekYear',
  ordinal: 'ordinal'
}

function normalizeUnit(unit: keyof typeof UNITS_SINGULAR) {
  const normalized = UNITS_SINGULAR[unit.toLowerCase()]
  if (!normalized) throw new ValueError(`Invalid unit ${unit}`)
  return normalized
}

function normalizeObject(obj, normalizer) {
  const normalized = {} as Record<DurationUnit, number>
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    if (value == null) continue
    normalized[normalizer(key)] = asNumber(value)
  }
  return normalized
}
