import { isObject, ValueError } from '../../globals/index.js'
import { truncateForError } from '../../internal/truncate.js'
import { protocol, type Comparable, type Equatable, type Rank } from '../../operators/protocol.js'
import {
  Duration,
  durationField,
  type DurationField,
  type DurationObject,
  type DurationUnit
} from '../duration.js'
import { asDate, formatDate, strftime, type FormatOptions } from '../format.js'
import { addDuration, lastDayOfMonth, subDuration } from './arith.js'
import {
  advanceWall,
  civilFromDayNumber,
  dayNumber,
  daysInMonthOf,
  isDateBrand,
  ISO_WEEK_RULE,
  localeWeekRule,
  MAX_TIME_MS,
  MS_PER_DAY,
  offsetMsAt,
  readWall,
  utcWallToTime,
  wallToTime,
  wallToTimePreferOffset,
  weekdayOf,
  weekDateOf,
  weekCount,
  type WallFields
} from './calendar.js'
import {
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
export type { FormatOptions }

export { addDuration, lastDayOfMonth, subDuration }
export type { DurationObject, DateObject }
export type DateLike = number | string | Date | IntlDate | DateObject | null

/** Options for {@link IntlDate} construction. */
export interface DateCtorOpts {
  locale?: string
  utc?: boolean
}

function isDateObject(v: unknown): v is DateObject {
  return isObject(v) && !(v instanceof Date) && !(v instanceof IntlDate)
}

/** Wall fields moved to `weekday` (1 = Monday) of the ISO week they roll into. */
function onWeekday(fields: WallFields, weekday: number | undefined): WallFields {
  if (weekday === undefined) return fields
  const current = weekdayOf(Math.floor(utcWallToTime(fields) / MS_PER_DAY)) || 7
  return { ...fields, day: fields.day + weekday - current }
}

function fieldsToDate(values: DateObject, utc: boolean): Date {
  const fields = readDateFields(values)
  const wall: WallFields = {
    year: fields.year ?? 0,
    month: fields.month ?? 1,
    day: fields.day ?? 1,
    hour: fields.hour ?? 0,
    minute: fields.minute ?? 0,
    second: fields.second ?? 0,
    millisecond: fields.millisecond ?? 0
  }
  return new Date(wallToTime(onWeekday(wall, fields.weekday), utc))
}

function toDurationObject(duration: number | Duration | DurationObject): DurationObject {
  if (typeof duration === 'number') return { milliseconds: duration }
  if (duration instanceof Duration) return duration.toObject()
  return duration
}

/** How far one unit advances: calendar months or days, or exact `ms` for a time unit. */
interface UnitStep {
  readonly months: number
  readonly days: number
  readonly ms: number
}

const UNIT_STEPS: Readonly<Record<DurationField | 'isoWeek', UnitStep>> = {
  years: { months: 12, days: 0, ms: 0 },
  quarters: { months: 3, days: 0, ms: 0 },
  months: { months: 1, days: 0, ms: 0 },
  weeks: { months: 0, days: 7, ms: 0 },
  isoWeek: { months: 0, days: 7, ms: 0 },
  days: { months: 0, days: 1, ms: 0 },
  hours: { months: 0, days: 0, ms: 3_600_000 },
  minutes: { months: 0, days: 0, ms: 60_000 },
  seconds: { months: 0, days: 0, ms: 1000 },
  milliseconds: { months: 0, days: 0, ms: 1 }
}

/**
 * Calendar units from `s` to `e` as Temporal `until` rounds them and `total` measures them.
 * Anchors are `s`'s wall time some units on, resolved "compatible"; the count is the last anchor
 * that does not pass `e`, and the fraction is `e`'s place in the window to the next anchor. An
 * anchor on a skipped day resolves onto its neighbour and adds nothing to the count.
 */
function calendarDiff(s: number, e: number, utc: boolean, step: UnitStep, exact: boolean): number {
  const sign = e > s ? 1 : -1
  const start = readWall(s, utc)
  const end = readWall(e, utc)
  const endOffset = offsetMsAt(e, utc)

  const anchor = (count: number): number => {
    if (count === 0) return s
    const wall = advanceWall(start, count * step.months, count * step.days)
    const time = wallToTime(wall, utc)
    return Number.isNaN(time) ? utcWallToTime(wall) - endOffset : time
  }
  const passesEnd = (count: number): boolean => sign * (anchor(count) - e) > 0

  const span =
    step.months === 0
      ? (dayNumber(end.year, end.month, end.day) - dayNumber(start.year, start.month, start.day)) /
        step.days
      : ((end.year - start.year) * 12 + end.month - start.month) / step.months
  let count = Math.trunc(span)
  while (!passesEnd(count + sign) && anchor(count + sign) !== anchor(count)) count += sign
  while (passesEnd(count)) count -= sign
  if (!exact) return count

  const from = anchor(count)
  let next = count + sign
  while (anchor(next) === from) next += sign
  return count + (e - from) / Math.abs(anchor(next) - from)
}

function zeroNegZero(n: number): number {
  return Object.is(n, -0) ? 0 : n
}

function resolveStartUnit(unit: string): DurationField | 'isoWeek' {
  const lower = unit.toLowerCase()
  if (lower === 'isoweek' || lower === 'isoweeks') return 'isoWeek'
  const field = (() => {
    try {
      return durationField(unit)
    } catch {
      return undefined
    }
  })()
  if (field === undefined) throw new ValueError(`unknown date field ${truncateForError(unit)}`)
  return field
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
  #relativeAutoFormat?: Intl.RelativeTimeFormat

  readonly [protocol.rank]: Rank = 5;

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
   * Object input follows the field rules of {@link IntlDate.set} and defaults missing
   * `month`/`day` to 1 and other fields to 0; years 0-99 are literal. Out-of-range fields roll
   * like `Date`, and a result outside the Date range is invalid. A value that is not date-like
   * is invalid; only `undefined` means the current time.
   * @param obj The date value (default is current time)
   * @param opts.utc When true, getters/format use UTC fields
   * @param opts.locale A locale string to use for this date
   */
  constructor(obj?: DateLike, opts: DateCtorOpts = {}) {
    if (obj instanceof IntlDate) {
      this.#date = new Date(obj.#date.getTime())
      this.locale = opts.locale ?? obj.locale
      this.utc = opts.utc ?? obj.utc
    } else {
      this.locale = opts.locale
      this.utc = Boolean(opts.utc)
      this.#date = isDateObject(obj) ? fieldsToDate(obj, this.utc) : asDate(obj, this.utc)
    }
  }

  /** `value` as a date in this date's locale and view. */
  #inView(value: DateLike): IntlDate {
    return new IntlDate(value instanceof IntlDate ? value.#date : value, {
      locale: this.locale,
      utc: this.utc
    })
  }

  /** A date at `time` in this locale and view. Throws `RangeError` outside the Date range. */
  #at(time: number): IntlDate {
    if (!(Math.abs(time) <= MAX_TIME_MS)) throw new RangeError('date out of range')
    return this.#inView(new Date(time))
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
    return lastDayOfMonth(this.year, this.month - 1)
  }

  /** Days in this date's year, `NaN` when invalid. */
  daysInYear(): number {
    return this.isValid() ? daysInYear(this.year) : Number.NaN
  }

  /** Day of year (1-366). */
  dayOfYear(): number {
    return dayOfYear(this.#date, this.utc)
  }

  /** Whether this date's year is a leap year. */
  isLeapYear(): boolean {
    return isLeapYear(this.year)
  }

  /** Locale week-numbering year for this date. */
  weekYear(): number {
    if (!this.isValid()) return Number.NaN
    const w = readWall(this.#date.getTime(), this.utc)
    return weekDateOf(dayNumber(w.year, w.month, w.day), localeWeekRule(this.locale)).year
  }

  /** Weeks in this date's locale week-numbering year. */
  weeksInYear(): number {
    if (!this.isValid()) return Number.NaN
    return weekCount(this.weekYear(), localeWeekRule(this.locale))
  }

  /** ISO week-numbering year for this date. */
  isoWeekYear(): number {
    if (!this.isValid()) return Number.NaN
    const w = readWall(this.#date.getTime(), this.utc)
    return weekDateOf(dayNumber(w.year, w.month, w.day), ISO_WEEK_RULE).year
  }

  /** Weeks in this date's ISO week-numbering year. */
  isoWeeksInYear(): number {
    if (!this.isValid()) return Number.NaN
    return weekCount(this.isoWeekYear(), ISO_WEEK_RULE)
  }

  /** Locale week of the year (rule from this instance's locale). */
  week(): number {
    if (!this.isValid()) return Number.NaN
    const w = readWall(this.#date.getTime(), this.utc)
    return weekDateOf(dayNumber(w.year, w.month, w.day), localeWeekRule(this.locale)).week
  }

  /** ISO 8601 week of the year. */
  isoWeek(): number {
    if (!this.isValid()) return Number.NaN
    const w = readWall(this.#date.getTime(), this.utc)
    return weekDateOf(dayNumber(w.year, w.month, w.day), ISO_WEEK_RULE).week
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

  /** The ISO-8601 string `JSON.stringify` writes, `null` when invalid. */
  toJSON(): string | null {
    return this.isValid() ? this.toISOString() : null
  }

  /**
   * UTC date part of the ISO string.
   * @example
```js
new IntlDate(new Date('2022-10-31T22:44:30.652Z')).toISODate() // '2022-10-31'
```
   */
  toISODate(): string {
    const iso = this.toISOString()
    return iso.slice(0, iso.indexOf('T'))
  }

  /**
   * UTC time part of the ISO string.
   * @example
```js
new IntlDate(new Date('2022-10-31T22:44:30.652Z')).toISOTime() // '22:44:30.652Z'
```
   */
  toISOTime(): string {
    const iso = this.toISOString()
    return iso.slice(iso.indexOf('T') + 1)
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
    return zeroNegZero(-this.#date.getTimezoneOffset())
  }

  /**
   * True when this instant is before `other`, which is read in this date's view.
   * @param other Another date-like value
   */
  isBefore(other: DateLike): boolean {
    return this.getTime() < this.#inView(other).getTime()
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
   * True when this instant is after `other`, which is read in this date's view.
   * @param other Another date-like value
   */
  isAfter(other: DateLike): boolean {
    return this.getTime() > this.#inView(other).getTime()
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
    if (!(o instanceof IntlDate || isDateBrand(o))) return undefined
    const otherTime = o.getTime()
    const selfValid = this.isValid()
    const otherValid = !Number.isNaN(otherTime)
    if (!selfValid && !otherValid) return undefined
    if (!selfValid) return 1
    if (!otherValid) return -1
    const diff = this.getTime() - otherTime
    return diff < 0 ? -1 : diff > 0 ? 1 : 0
  }

  /** Protocol equals: both valid with equal instants. */
  protocolEquals(o: unknown): boolean {
    return (o instanceof IntlDate || isDateBrand(o)) && this.getTime() === o.getTime()
  }

  /**
   * Returns a new date with the given fields overlaid. Absent `day` clamps to the target month.
   * `weekday` (1 = Monday) then moves within the ISO week. Fields must be integers; out-of-range
   * ones roll like `Date`.
   * Setting a field inside a repeated local hour keeps this instant's offset when that offset remains valid.
   * @param values Fields to set
   * @throws RangeError when the result is outside the Date range
   */
  set(values: DateObject): IntlDate {
    const patch = readDateFields(values)
    if (!this.isValid()) return this.clone()

    const t = this.getTime()
    const wall = readWall(t, this.utc)
    const year = patch.year ?? wall.year
    const month = patch.month ?? wall.month
    const fields: WallFields = {
      year,
      month,
      day: patch.day ?? Math.min(wall.day, daysInMonthOf(year, month)),
      hour: patch.hour ?? wall.hour,
      minute: patch.minute ?? wall.minute,
      second: patch.second ?? wall.second,
      millisecond: patch.millisecond ?? wall.millisecond
    }
    const target = onWeekday(fields, patch.weekday)
    return this.#at(wallToTimePreferOffset(target, this.utc, offsetMsAt(t, this.utc)))
  }

  /** Cached `Intl.RelativeTimeFormat` for this instance (`numeric: "always"`). */
  get relativeFormat(): Intl.RelativeTimeFormat {
    this.#relativeFormat ??= new Intl.RelativeTimeFormat(this.locale, { numeric: 'always' })
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

  #formatRelative(count: number, unit: Intl.RelativeTimeFormatUnit): string {
    if (Number.isNaN(count)) return 'Invalid Date'
    if (count === 0) {
      this.#relativeAutoFormat ??= new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' })
      return this.#relativeAutoFormat.format(0, unit)
    }
    return this.relativeTime(count, unit)
  }

  #relativeUnit(
    other: IntlDate,
    unit: Intl.RelativeTimeFormatUnit | undefined
  ): Intl.RelativeTimeFormatUnit {
    if (unit !== undefined) return unit
    const auto: readonly Intl.RelativeTimeFormatUnit[] = [
      'years',
      'months',
      'days',
      'hours',
      'minutes',
      'seconds'
    ]
    for (const candidate of auto) {
      if (Math.abs(this.diff(other, candidate)) >= 1) return candidate
    }
    return 'seconds'
  }

  #relativeBetween(
    base: IntlDate,
    target: IntlDate,
    unit: Intl.RelativeTimeFormatUnit | undefined
  ): string {
    const resolved = target.#relativeUnit(base, unit)
    return this.#formatRelative(target.diff(base, resolved), resolved)
  }

  /**
   * Relative time from now to this date. Omitting `unit` picks the largest of
   * years, months, days, hours, minutes, seconds with absolute count at least 1.
   * An invalid date gives `"Invalid Date"`.
   * @param unit Relative unit
   */
  fromNow(unit?: Intl.RelativeTimeFormatUnit): string {
    return this.from(new Date(), unit)
  }

  /**
   * Relative time from `other` to this date. Omitting `unit` picks an automatic unit.
   * A zero count uses `numeric: "auto"` phrasing ("today", "now", ...).
   * An invalid date on either side gives `"Invalid Date"`.
   * @param other Base date
   * @param unit Relative unit
   */
  from(other: DateLike, unit?: Intl.RelativeTimeFormatUnit): string {
    return this.#relativeBetween(this.#inView(other), this, unit)
  }

  /**
   * Relative time from this date to now. Omitting `unit` picks an automatic unit.
   * @param unit Relative unit
   */
  toNow(unit?: Intl.RelativeTimeFormatUnit): string {
    return this.to(new Date(), unit)
  }

  /**
   * Relative time from this date to `other`, the same text as `other.from(this)`.
   * Omitting `unit` picks an automatic unit.
   * @param other Target date
   * @param unit Relative unit
   */
  to(other: DateLike, unit?: Intl.RelativeTimeFormatUnit): string {
    return this.#relativeBetween(this, this.#inView(other), unit)
  }

  /**
   * Difference from `other` to this date in `unit`: Temporal `other.until(this)` rounded with
   * `smallestUnit: unit`, `roundingMode: 'trunc'`, or the `total` of the elapsed time when `exact`.
   * @param other Base date, read in this date's view
   * @param unit Duration unit
   * @param exact When true, leave fractional totals
   */
  diff(other: DateLike, unit: DurationUnit = 'milliseconds', exact = false): number {
    const step = UNIT_STEPS[durationField(unit)]
    const o = this.#inView(other)
    if (!this.isValid() || !o.isValid()) return Number.NaN
    const s = o.getTime()
    const e = this.getTime()
    const v = step.ms === 0 ? calendarDiff(s, e, this.utc, step, exact) : (e - s) / step.ms
    return zeroNegZero(exact ? v : Math.trunc(v))
  }

  /**
   * Adds a duration with calendar-correct month/year clamp and DST-safe calendar units.
   * Calendar fields advance the wall date once, then time fields add exact milliseconds.
   * @param duration Duration fields, ms number, or Duration
   */
  add(duration: number | Duration | DurationObject): IntlDate {
    return this.clone(addDuration(this.#date, toDurationObject(duration), 1, this.utc))
  }

  /**
   * Subtracts a duration with calendar-correct month/year clamp.
   * @param duration Duration fields, ms number, or Duration
   */
  subtract(duration: number | Duration | DurationObject): IntlDate {
    return this.clone(subDuration(this.#date, toDurationObject(duration), this.utc))
  }

  /** Wall fields of the first moment of `field` around this valid date. */
  #startWall(field: Exclude<DurationField, 'milliseconds'> | 'isoWeek'): WallFields {
    const w = readWall(this.getTime(), this.utc)
    const midnight = { ...w, hour: 0, minute: 0, second: 0, millisecond: 0 }
    switch (field) {
      case 'seconds':
        return { ...w, millisecond: 0 }
      case 'minutes':
        return { ...w, second: 0, millisecond: 0 }
      case 'hours':
        return { ...w, minute: 0, second: 0, millisecond: 0 }
      case 'days':
        return midnight
      case 'months':
        return { ...midnight, day: 1 }
      case 'quarters':
        return { ...midnight, month: 3 * Math.floor((w.month - 1) / 3) + 1, day: 1 }
      case 'years':
        return { ...midnight, month: 1, day: 1 }
      case 'weeks':
      case 'isoWeek': {
        const rule = field === 'isoWeek' ? ISO_WEEK_RULE : localeWeekRule(this.locale)
        const dn = dayNumber(w.year, w.month, w.day)
        return {
          ...midnight,
          ...civilFromDayNumber(dn - ((weekdayOf(dn) - rule.firstDay + 7) % 7))
        }
      }
    }
  }

  /**
   * Start of the given unit. `week` uses the locale first day of week; `isoWeek` is Monday 00:00.
   * Day-or-larger units use compatible wall resolution; hour/minute/second keep this offset when valid.
   * @param unit Duration unit, or `isoWeek` / `isoWeeks`
   * @throws RangeError when the start is outside the Date range
   */
  startOf(unit: DurationUnit | 'isoWeek' | 'isoWeeks'): IntlDate {
    const field = resolveStartUnit(unit)
    if (field === 'milliseconds' || !this.isValid()) return this.clone()

    const target = this.#startWall(field)
    return this.#at(
      UNIT_STEPS[field].ms === 0
        ? wallToTime(target, this.utc)
        : wallToTimePreferOffset(target, this.utc, offsetMsAt(this.getTime(), this.utc))
    )
  }

  /**
   * End of the given unit. Time units keep this offset when valid and never land before the receiver;
   * day-or-larger units end 1 ms before the next unit starts.
   * @param unit Duration unit, or `isoWeek` / `isoWeeks`
   * @throws RangeError when the end is outside the Date range
   */
  endOf(unit: DurationUnit | 'isoWeek' | 'isoWeeks'): IntlDate {
    const field = resolveStartUnit(unit)
    if (field === 'milliseconds' || !this.isValid()) return this.clone()

    const step = UNIT_STEPS[field]
    if (step.ms === 0) {
      const next = advanceWall(this.#startWall(field), step.months, step.days)
      return this.#at(wallToTime(next, this.utc) - 1)
    }

    const t = this.getTime()
    const w = readWall(t, this.utc)
    const last: WallFields = {
      ...w,
      minute: field === 'hours' ? 59 : w.minute,
      second: field === 'seconds' ? w.second : 59,
      millisecond: 999
    }
    return this.#at(wallToTimePreferOffset(last, this.utc, offsetMsAt(t, this.utc)))
  }

  /**
   * Clones this date, optionally replacing the instant.
   * @param date Replacement value; `null` gives an invalid date
   */
  clone(date?: DateLike): IntlDate {
    return this.#inView(date === undefined ? this : date)
  }

  /**
   * Earliest of the given dates, or `undefined` when none is valid. Values are parsed like the
   * constructor parses them (strings as local time); the original value is returned.
   * @throws TypeError when `dates` is not an array
   */
  static min(dates: readonly DateLike[]): DateLike | undefined {
    return minDate(dates, IntlDate.#toTime)
  }

  /**
   * Latest of the given dates, or `undefined` when none is valid. Values are parsed like the
   * constructor parses them (strings as local time); the original value is returned.
   * @throws TypeError when `dates` is not an array
   */
  static max(dates: readonly DateLike[]): DateLike | undefined {
    return maxDate(dates, IntlDate.#toTime)
  }

  static #toTime(value: DateLike | undefined): number {
    return new IntlDate(value ?? null).getTime()
  }

  /** Debug representation. */
  inspect(): string {
    return this.isValid() ? `new IntlDate("${this.toISOString()}")` : 'new IntlDate(NaN)'
  }
}

const DATE_OBJECT_KEYS: ReadonlySet<string> = new Set([
  'year',
  'month',
  'day',
  'weekday',
  'hour',
  'minute',
  'second',
  'millisecond'
])

function dateFieldKey(unit: string): string {
  const lower = unit.toLowerCase()
  if (DATE_OBJECT_KEYS.has(lower)) return lower
  if (lower.endsWith('s')) {
    const singular = lower.slice(0, -1)
    if (DATE_OBJECT_KEYS.has(singular)) return singular
  }
  throw new ValueError(`unknown date field ${truncateForError(unit)}`)
}

/** Validated fields of a {@link DateObject}; `null` and `undefined` count as absent. */
function readDateFields(values: DateObject): Partial<Record<keyof DateObject, number>> {
  const fields: Partial<Record<keyof DateObject, number>> = {}
  for (const [key, raw] of Object.entries(values)) {
    const field = dateFieldKey(key) as keyof DateObject
    if (raw === undefined || raw === null) continue
    if (typeof raw !== 'number' || !Number.isInteger(raw)) {
      throw new ValueError(`date field ${truncateForError(key)} must be an integer`)
    }
    fields[field] = raw
  }
  return fields
}
