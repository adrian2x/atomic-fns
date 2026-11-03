import { isObject, ValueError } from '../../globals/index.js'
import { protocol, type Comparable, type Equatable } from '../../operators/protocol.js'
import { Duration, UNITS_PLURAL, type DurationObject, type DurationUnit } from '../duration.js'
import { asDate, formatDate, strftime } from '../format.js'
import { addDuration, lastDayOfMonth, subDuration } from './arith.js'
import {
  asNumber,
  dayOfYear,
  daysInMonth,
  daysInYear,
  isLeapYear,
  maxDate,
  minDate,
  weekOfYear,
  weeksInYear,
  type DateObject
} from './utils.js'

export {
  asDate,
  dayOfYear,
  daysInMonth,
  daysInYear,
  formatDate,
  isLeapYear,
  maxDate,
  minDate,
  strftime,
  weekOfYear,
  weeksInYear
}

export { addDuration, lastDayOfMonth, subDuration }
export type { DurationObject, DateObject }
export type DateLike = number | string | Date | IntlDate | DateObject | null

interface DateCtorOpts {
  locale?: string
  utc?: boolean
}

function isDateObject(v: unknown): v is DateObject {
  return isObject(v) && !(v instanceof Date) && !(v instanceof IntlDate)
}

function fieldsToDate(fields: DateObject, utc: boolean): Date {
  const year = fields.year ?? 0
  const monthIndex = (fields.month ?? 1) - 1
  const day = fields.day ?? 1
  const hour = fields.hour ?? 0
  const minute = fields.minute ?? 0
  const second = fields.second ?? 0
  const millisecond = fields.millisecond ?? 0
  const d = new Date(0)
  if (utc) {
    d.setUTCFullYear(year, monthIndex, day)
    d.setUTCHours(hour, minute, second, millisecond)
  } else {
    d.setFullYear(year, monthIndex, day)
    d.setHours(hour, minute, second, millisecond)
  }
  return d
}

function toDurationObject(duration: number | Duration | DurationObject): DurationObject {
  if (typeof duration === 'number') return { milliseconds: duration }
  const src = duration instanceof Duration ? duration.values : duration
  return {
    years: src.years,
    quarters: src.quarters,
    months: src.months,
    weeks: src.weeks,
    days: src.days,
    hours: src.hours,
    minutes: src.minutes,
    seconds: src.seconds,
    milliseconds: src.milliseconds
  }
}

/**
 * A date tied to a locale (default system locale) with calendar-correct arithmetic
 * and an optional UTC view of the same instant.
 */
export class IntlDate implements Comparable, Equatable {
  readonly #date: Date
  readonly locale?: string
  readonly utc: boolean
  #relativeFormat?: Intl.RelativeTimeFormat

  get [protocol.rank]() {
    return 5 as const
  }

  [protocol.compare](o: unknown): number | undefined {
    return this.protocolCompare(o)
  }

  [protocol.equals](o: unknown): boolean {
    return this.protocolEquals(o)
  }

  /** Parses the provided value as a UTC-view date or returns the current instant in UTC view. */
  static UTC(value?: DateLike, locale?: string): IntlDate {
    return new IntlDate(value, { utc: true, locale })
  }

  /** Returns the current local date and time. */
  static now(): IntlDate {
    return new IntlDate()
  }

  /** Creates a new date from a Unix timestamp (seconds since the unix epoch). */
  static unix(seconds: number): IntlDate {
    return new IntlDate(seconds * 1000)
  }

  /**
   * Creates a new `IntlDate` storing a true instant plus an optional `utc` flag.
   * With `utc` set, getters and `format` read UTC fields; `getTime`/`toISOString` never shift.
   * Object input defaults missing `month`/`day` to 1 and other fields to 0.
   * Years 0-99 are literal years.
   * @param obj The date value (default is current time)
   * @param opts.utc When true, getters/format use UTC fields
   * @param opts.locale A locale string to use for this date
   */
  constructor(obj?: DateLike, opts: DateCtorOpts = {}) {
    this.locale = opts.locale

    if (obj instanceof IntlDate) {
      this.#date = new Date(obj.#date.getTime())
      this.utc = opts.utc ?? obj.utc
    } else {
      this.utc = Boolean(opts.utc)
      if (typeof obj === 'string') {
        this.#date = asDate(obj, this.utc)
      } else if (typeof obj === 'number' || obj instanceof Date) {
        this.#date = new Date(obj)
      } else if (isDateObject(obj)) {
        this.#date = fieldsToDate(obj, this.utc)
      } else if (obj === null) {
        this.#date = asDate(null)
      } else {
        this.#date = asDate(undefined)
      }
    }
  }

  /** Get the date's year. */
  get year(): number {
    return this.utc ? this.#date.getUTCFullYear() : this.#date.getFullYear()
  }

  /** Get this date's month as a number from 1 to 12, inclusive. */
  get month(): number {
    return (this.utc ? this.#date.getUTCMonth() : this.#date.getMonth()) + 1
  }

  /** Weekday 1-7 where Monday is 1 and Sunday is 7. */
  get dayOfWeek(): number {
    const dow = this.utc ? this.#date.getUTCDay() : this.#date.getDay()
    return dow === 0 ? 7 : dow
  }

  /** Day of the month. */
  get day(): number {
    return this.utc ? this.#date.getUTCDate() : this.#date.getDate()
  }

  /** Hour of day. */
  get hour(): number {
    return this.utc ? this.#date.getUTCHours() : this.#date.getHours()
  }

  /** Minute of hour. */
  get minute(): number {
    return this.utc ? this.#date.getUTCMinutes() : this.#date.getMinutes()
  }

  /** Second of minute. */
  get second(): number {
    return this.utc ? this.#date.getUTCSeconds() : this.#date.getSeconds()
  }

  /** Millisecond of second. */
  get millisecond(): number {
    return this.utc ? this.#date.getUTCMilliseconds() : this.#date.getMilliseconds()
  }

  /** Whether this date represents a valid instant. */
  isValid(): boolean {
    return !Number.isNaN(this.#date.getTime())
  }

  /** Days in this date's month. */
  daysInMonth(): number {
    return lastDayOfMonth(this.year, this.month - 1, this.utc)
  }

  /** Days in this date's year. */
  daysInYear(): number {
    return daysInYear(this.year)
  }

  /** Day of year (1-366). */
  dayOfYear(): number {
    return dayOfYear(this.#date, this.utc)
  }

  /** Whether this date's year is a leap year. */
  isLeapYear(): boolean {
    return isLeapYear(this.year)
  }

  /** Weeks in the current year (Monday / Jan-1 rule). */
  weeksInYear(): number {
    return weeksInYear(this.year)
  }

  /** ISO weeks in the current year. */
  isoWeeksInYear(): number {
    return weeksInYear(this.year, 1, 4)
  }

  /** Week of the year. */
  week(): number {
    return weekOfYear(this.#date, 1, 1, this.utc).week
  }

  /** ISO week of the year. */
  isoWeek(): number {
    return weekOfYear(this.#date, 1, 4, this.utc).week
  }

  /**
   * Localized string via `Intl.DateTimeFormat`. UTC-view dates default to the UTC time zone.
   * @param opts DateTimeFormat options
   */
  toString(opts?: Intl.DateTimeFormatOptions): string {
    const resolved = this.utc ? { timeZone: 'UTC', ...opts } : opts
    return this.#date.toLocaleString(this.locale, resolved)
  }

  /**
   * Format with moment-style tokens. UTC-view dates use UTC fields.
   * @param str Format string
   * @example
```js
new IntlDate(new Date(2022, 9, 31)).format('MM/DD/YYYY') // '10/31/2022'
```
   */
  format(str: string): string {
    return formatDate(str, this.#date, { locale: this.locale, utc: this.utc })
  }

  /** A new copy of the native `Date` for this instant. */
  toDate(): Date {
    return new Date(this.isValid() ? this.#date.getTime() : NaN)
  }

  /**
   * Seconds since the Unix Epoch, floored.
   * @example
```js
new IntlDate(new Date('2022-10-31T22:44:30.652Z')).toSeconds() // 1667256270
```
   */
  toSeconds(): number {
    return Math.floor(this.getTime() / 1000)
  }

  /** Alias of {@link IntlDate.toSeconds}. */
  timestamp(): number {
    return this.toSeconds()
  }

  /** Alias of {@link IntlDate.toSeconds}. */
  unix(): number {
    return this.toSeconds()
  }

  /**
   * ISO-8601 string of this instant.
   * @example
```js
new IntlDate(new Date('2022-10-31T22:44:30.652Z')).toISOString() // '2022-10-31T22:44:30.652Z'
```
   */
  toISOString(): string {
    return this.#date.toISOString()
  }

  /**
   * UTC date part of the ISO string.
   * @example
```js
new IntlDate(new Date('2022-10-31T22:44:30.652Z')).toISODate() // '2022-10-31'
```
   */
  toISODate(): string {
    return this.#date.toISOString().slice(0, 10)
  }

  /**
   * UTC time part of the ISO string.
   * @example
```js
new IntlDate(new Date('2022-10-31T22:44:30.652Z')).toISOTime() // '22:44:30.652Z'
```
   */
  toISOTime(): string {
    return this.#date.toISOString().slice(11)
  }

  /** Object of calendar fields in this date's view (local or UTC). */
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

  /** Milliseconds since the Unix Epoch. */
  getTime(): number {
    return this.isValid() ? this.#date.getTime() : NaN
  }

  /** Alias of {@link IntlDate.getTime}. */
  valueOf(): number {
    return this.getTime()
  }

  /** Time zone name via format token `zzz`. */
  zoneName(): string {
    return this.format('zzz')
  }

  /** GMT offset string via format token `ZZ`. */
  zone(): string {
    return this.format('ZZ')
  }

  /**
   * Minutes of local-minus-UTC offset (`-getTimezoneOffset`).
   * UTC-view dates return `0`.
   */
  utcOffset(): number {
    if (this.utc) return 0
    return -this.#date.getTimezoneOffset()
  }

  /**
   * True when this instant is before `other`.
   * @param other Another date-like value
   */
  isBefore(other: DateLike): boolean {
    return this.getTime() < new IntlDate(other).getTime()
  }

  /**
   * True when this instant is strictly after `start` and before `stop`.
   * @param start Lower bound
   * @param stop Upper bound
   */
  isBetween(start: DateLike, stop: DateLike): boolean {
    return this.isAfter(start) && this.isBefore(stop)
  }

  /**
   * True when this instant is after `other`.
   * @param other Another date-like value
   */
  isAfter(other: DateLike): boolean {
    return this.getTime() > new IntlDate(other).getTime()
  }

  /**
   * True when both are valid and represent the same instant.
   * @param other Another date
   */
  isSame(other: Date | IntlDate): boolean {
    return this[protocol.equals](other)
  }

  /** True when this instant is before `other`. */
  lt(other: Date | IntlDate): boolean {
    return this.isBefore(other)
  }

  /** Instant equality (same as {@link IntlDate.isSame}). */
  eq(other: Date | IntlDate): boolean {
    return this.isSame(other)
  }

  /**
   * Signed ordering vs another date. Invalid dates compare greater than valid ones.
   * @param other Another date
   */
  compare(other: Date | IntlDate): number {
    const r = this.protocolCompare(other)
    return r ?? 0
  }

  /** Protocol compare: invalid > valid; both invalid declines. */
  protocolCompare(o: unknown): number | undefined {
    let otherTime: number
    let otherValid: boolean
    if (o instanceof IntlDate) {
      otherTime = o.getTime()
      otherValid = o.isValid()
    } else if (o instanceof Date) {
      otherTime = o.getTime()
      otherValid = !Number.isNaN(otherTime)
    } else {
      return undefined
    }

    const selfValid = this.isValid()
    if (!selfValid && !otherValid) return undefined
    if (!selfValid) return 1
    if (!otherValid) return -1
    const diff = this.getTime() - otherTime
    return diff < 0 ? -1 : diff > 0 ? 1 : 0
  }

  /** Protocol equals: both valid with equal instants. */
  protocolEquals(o: unknown): boolean {
    if (o instanceof IntlDate) {
      return this.isValid() && o.isValid() && this.getTime() === o.getTime()
    }
    if (o instanceof Date) {
      return this.isValid() && !Number.isNaN(o.getTime()) && this.getTime() === o.getTime()
    }
    return false
  }

  /**
   * Returns a new date with the given fields overlaid. Absent `day` clamps to the target month.
   * @param values Fields to set
   */
  set(values: DateObject): IntlDate {
    if (!this.isValid()) return this

    const normalized = normalizeObject(values, normalizeUnit)
    const mixed: DateObject = { ...this.toObject(), ...normalized }

    if (normalized.day === undefined && mixed.year !== undefined && mixed.month !== undefined) {
      const last = lastDayOfMonth(mixed.year, mixed.month - 1, this.utc)
      mixed.day = Math.min(mixed.day ?? last, last)
    }

    let result = this.clone(fieldsToDate(mixed, this.utc))

    if (normalized.weekday !== undefined) {
      const delta = normalized.weekday - result.dayOfWeek
      if (delta !== 0) result = result.add({ days: delta })
    }

    return result
  }

  /** Cached `Intl.RelativeTimeFormat` for this instance. */
  get relativeFormat(): Intl.RelativeTimeFormat {
    this.#relativeFormat ??= new Intl.RelativeTimeFormat(this.locale)
    return this.#relativeFormat
  }

  /**
   * Formats a relative time via the cached formatter.
   * @param n Signed count
   * @param unit Relative unit
   */
  relativeTime(n: number, unit: Intl.RelativeTimeFormatUnit = 'seconds'): string {
    return this.relativeFormat.format(n, unit)
  }

  /**
   * Relative time from now to this date.
   * @param unit Relative unit
   */
  fromNow(unit: Intl.RelativeTimeFormatUnit = 'seconds'): string {
    return this.relativeTime(this.diff(new Date(), unit), unit)
  }

  /**
   * Relative time from `other` to this date.
   * @param other Base date
   * @param unit Relative unit
   */
  from(other: DateLike, unit: Intl.RelativeTimeFormatUnit = 'seconds'): string {
    return this.relativeTime(this.diff(other, unit), unit)
  }

  /**
   * Relative time from this date to now.
   * @param unit Relative unit
   */
  toNow(unit: Intl.RelativeTimeFormatUnit = 'seconds'): string {
    return this.relativeTime(-this.diff(new Date(), unit), unit)
  }

  /**
   * Relative time from this date to `other`.
   * @param other Target date
   * @param unit Relative unit
   */
  to(other: DateLike, unit: Intl.RelativeTimeFormatUnit = 'seconds'): string {
    return this.relativeTime(-this.diff(other, unit), unit)
  }

  /**
   * Difference from `other` to this date in `unit`.
   * @param other Base date
   * @param unit Duration unit
   * @param exact When true, leave fractional totals
   */
  diff(other: DateLike, unit: DurationUnit = 'milliseconds', exact = false): number {
    const dt = new IntlDate(other)
    const dur = new Duration(this.getTime() - dt.getTime(), exact)
    // Quarters are a month diff / 3, so 181 days (6 months) is 2 quarters, not 1.
    let total =
      UNITS_PLURAL[unit.toLowerCase()] === 'quarters' ? dur.total('months') / 3 : dur.total(unit)
    if (!exact) total = Math.trunc(total)
    return total === 0 ? 0 : total
  }

  /**
   * Adds a duration with calendar-correct month/year clamp and DST-safe calendar units.
   * @param duration Duration fields, ms number, or Duration
   */
  add(duration: number | Duration | DurationObject): IntlDate {
    if (!this.isValid()) return this
    return this.clone(addDuration(this.#date, toDurationObject(duration), 1, this.utc))
  }

  /**
   * Subtracts a duration with calendar-correct month/year clamp.
   * @param duration Duration fields, ms number, or Duration
   */
  subtract(duration: number | Duration | DurationObject): IntlDate {
    if (!this.isValid()) return this
    return this.clone(subDuration(this.#date, toDurationObject(duration), this.utc))
  }

  /**
   * Start of the given unit. `week` is Monday 00:00 of the ISO week.
   * @param unit Duration unit
   */
  startOf(unit: DurationUnit): IntlDate {
    if (!this.isValid()) return this
    const normalizedUnit = UNITS_PLURAL[unit.toLowerCase()]
    if (!normalizedUnit) throw new ValueError(`Invalid unit ${unit}`)

    const obj: DateObject = {}
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
    }

    if (normalizedUnit === 'quarters') {
      const q = Math.ceil(this.month / 3)
      obj.month = (q - 1) * 3 + 1
    }

    if (normalizedUnit === 'weeks') {
      const dow = this.dayOfWeek
      return this.subtract({ days: dow - 1 }).set(obj)
    }

    return this.set(obj)
  }

  /**
   * End of the given unit: `startOf(unit)` + 1 unit - 1 ms.
   * @param unit Duration unit
   */
  endOf(unit: DurationUnit): IntlDate {
    if (!this.isValid()) return this
    const normalizedUnit = UNITS_PLURAL[unit.toLowerCase()]
    if (!normalizedUnit) throw new ValueError(`Invalid unit ${unit}`)
    return this.startOf(unit)
      .add({ [normalizedUnit]: 1 })
      .subtract({ milliseconds: 1 })
  }

  /**
   * Clones this date, optionally replacing the instant.
   * @param date Replacement value
   */
  clone(date?: DateLike): IntlDate {
    return new IntlDate(date ?? this, { locale: this.locale, utc: this.utc })
  }

  /**
   * Earliest of the given dates, or `undefined` when none is valid. Values are parsed like the
   * constructor parses them (strings as local time); the original value is returned.
   */
  static min(dates: readonly DateLike[]): DateLike | undefined {
    return minDate(dates, IntlDate.#toTime)
  }

  /**
   * Latest of the given dates, or `undefined` when none is valid. Values are parsed like the
   * constructor parses them (strings as local time); the original value is returned.
   */
  static max(dates: readonly DateLike[]): DateLike | undefined {
    return maxDate(dates, IntlDate.#toTime)
  }

  static #toTime(value: DateLike): number {
    return new IntlDate(value).getTime()
  }

  /** Debug representation. */
  inspect(): string {
    return `new IntlDate("${this.toISOString()}")`
  }
}

const DATE_OBJECT_KEYS: ReadonlySet<string> = new Set<keyof DateObject>([
  'year',
  'month',
  'day',
  'weekday',
  'hour',
  'minute',
  'second',
  'millisecond'
])

function normalizeUnit(unit: string): string {
  const normalized = unit.toLowerCase().replace(/s$/, '')
  if (!DATE_OBJECT_KEYS.has(normalized)) throw new ValueError(`Invalid unit ${unit}`)
  return normalized
}

function normalizeObject(
  obj: DateObject,
  normalizer: (unit: string) => string
): Partial<Record<string, number>> {
  const normalized: Partial<Record<string, number>> = {}
  for (const key of Object.keys(obj) as (keyof DateObject)[]) {
    const value = obj[key]
    if (value == null) continue
    normalized[normalizer(key)] = asNumber(value)
  }
  return normalized
}
