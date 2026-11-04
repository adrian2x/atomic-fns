import { isObject, ValueError } from '../../globals/index.js'
import { truncateForError } from '../../internal/truncate.js'
import { protocol, type Comparable, type Equatable } from '../../operators/protocol.js'
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
  civilFromDayNumber,
  dayNumber,
  daysInMonthOf,
  ISO_WEEK_RULE,
  localeWeekRule,
  localWallToTime,
  offsetMsAt,
  readWall,
  utcWallToTime,
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
  if (duration instanceof Duration) return duration.toObject()
  return duration
}

function compare3(
  a: readonly [number, number, number],
  b: readonly [number, number, number]
): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1
  if (a[2] !== b[2]) return a[2] < b[2] ? -1 : 1
  return 0
}

function msOfDay(w: WallFields): number {
  return w.hour * 3_600_000 + w.minute * 60_000 + w.second * 1000 + w.millisecond
}

function wallFieldsAfter(
  a: WallFields,
  kind: 'months' | 'days',
  size: number,
  j: number
): WallFields {
  if (kind === 'months') {
    const idx = a.year * 12 + (a.month - 1) + j * size
    const y = Math.floor(idx / 12)
    const m = idx - y * 12 + 1
    const d = Math.min(a.day, daysInMonthOf(y, m))
    return {
      year: y,
      month: m,
      day: d,
      hour: a.hour,
      minute: a.minute,
      second: a.second,
      millisecond: a.millisecond
    }
  }
  const civil = civilFromDayNumber(dayNumber(a.year, a.month, a.day) + j * size)
  return {
    year: civil.year,
    month: civil.month,
    day: civil.day,
    hour: a.hour,
    minute: a.minute,
    second: a.second,
    millisecond: a.millisecond
  }
}

/** Linear civil timeline (day number * ms/day + ms of day); used when Date cannot represent a wall. */
function civilInstant(w: WallFields): number {
  return dayNumber(w.year, w.month, w.day) * 86_400_000 + msOfDay(w)
}

function calendarDiff(
  s: number,
  e: number,
  utc: boolean,
  kind: 'months' | 'days',
  size: number,
  exact: boolean
): number {
  if (s === e) return 0
  const sign: 1 | -1 = e > s ? 1 : -1
  const a = readWall(s, utc)
  const b = readWall(e, utc)
  const dnA = dayNumber(a.year, a.month, a.day)
  let dnB = dayNumber(b.year, b.month, b.day)
  if (sign * (msOfDay(b) - msOfDay(a)) < 0) dnB -= sign
  const bd = civilFromDayNumber(dnB)

  let k: number
  if (kind === 'days') {
    k = Math.trunc((dnB - dnA) / size)
  } else {
    k = Math.trunc(((bd.year - a.year) * 12 + (bd.month - a.month)) / size)
    const surpasses = (step: number): boolean => {
      const idx = a.year * 12 + a.month - 1 + step * size
      const y = Math.floor(idx / 12)
      const m = idx - 12 * y + 1
      const day = Math.min(a.day, daysInMonthOf(y, m))
      return sign * compare3([y, m, day], [bd.year, bd.month, bd.day]) > 0
    }
    while (k !== 0 && surpasses(k)) k -= sign
  }

  if (!exact) return k

  const anchors = (j0: number, j1: number): { t0: number; t1: number; end: number } => {
    const w0 = wallFieldsAfter(a, kind, size, j0)
    const w1 = wallFieldsAfter(a, kind, size, j1)
    const d0 = utc ? utcWallToTime(w0) : localWallToTime(w0)
    const d1 = utc ? utcWallToTime(w1) : localWallToTime(w1)
    if (Number.isFinite(d0) && Number.isFinite(d1)) {
      return { t0: d0, t1: d1, end: e }
    }
    return { t0: civilInstant(w0), t1: civilInstant(w1), end: civilInstant(b) }
  }

  let { t0, t1, end } = anchors(k, k + sign)
  if (Math.abs(end - t0) >= Math.abs(t1 - t0)) {
    k += sign
    ;({ t0, t1, end } = anchors(k, k + sign))
  }
  const denom = Math.abs(t1 - t0)
  if (denom === 0) return k
  return k + (end - t0) / denom
}

const TIME_UNIT_MS: ReadonlyMap<DurationField, number> = new Map([
  ['hours', 3_600_000],
  ['minutes', 60_000],
  ['seconds', 1000],
  ['milliseconds', 1]
])

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
   * Setting a field inside a repeated local hour keeps this instant's offset when that offset remains valid.
   * @param values Fields to set
   */
  set(values: DateObject): IntlDate {
    if (!this.isValid()) return this

    const patch: Partial<Record<keyof DateObject, number>> = {}
    for (const [key, raw] of Object.entries(values)) {
      const field = dateFieldKey(key) as keyof DateObject
      if (raw === undefined || raw === null) continue
      if (typeof raw !== 'number' || !Number.isFinite(raw) || !Number.isInteger(raw)) {
        throw new ValueError(`date field ${truncateForError(key)} must be a finite number`)
      }
      patch[field] = raw
    }

    const wall = readWall(this.getTime(), this.utc)
    const year = patch.year ?? wall.year
    const month = patch.month ?? wall.month
    const day = patch.day ?? Math.min(wall.day, daysInMonthOf(year, month))
    const fields: WallFields = {
      year,
      month,
      day,
      hour: patch.hour ?? wall.hour,
      minute: patch.minute ?? wall.minute,
      second: patch.second ?? wall.second,
      millisecond: patch.millisecond ?? wall.millisecond
    }

    const t = wallToTimePreferOffset(fields, this.utc, offsetMsAt(this.getTime(), this.utc))
    let result = this.clone(new Date(t))

    if (patch.weekday !== undefined) {
      const delta = patch.weekday - result.dayOfWeek
      if (delta !== 0) result = result.add({ days: delta })
    }
    return result
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

  #formatRelative(n: number, unit: Intl.RelativeTimeFormatUnit): string {
    const count = zeroNegZero(n)
    if (count === 0) {
      this.#relativeAutoFormat ??= new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' })
      return this.#relativeAutoFormat.format(0, unit)
    }
    return this.relativeTime(count, unit)
  }

  #relativeUnit(
    other: DateLike,
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

  /**
   * Relative time from now to this date. Omitting `unit` picks the largest of
   * years, months, days, hours, minutes, seconds with absolute count at least 1.
   * @param unit Relative unit
   */
  fromNow(unit?: Intl.RelativeTimeFormatUnit): string {
    return this.from(new Date(), unit)
  }

  /**
   * Relative time from `other` to this date. Omitting `unit` picks an automatic unit.
   * A zero count uses `numeric: "auto"` phrasing ("today", "now", ...).
   * @param other Base date
   * @param unit Relative unit
   */
  from(other: DateLike, unit?: Intl.RelativeTimeFormatUnit): string {
    const resolved = this.#relativeUnit(other, unit)
    return this.#formatRelative(this.diff(other, resolved), resolved)
  }

  /**
   * Relative time from this date to now. Omitting `unit` picks an automatic unit.
   * @param unit Relative unit
   */
  toNow(unit?: Intl.RelativeTimeFormatUnit): string {
    return this.to(new Date(), unit)
  }

  /**
   * Relative time from this date to `other`. Omitting `unit` picks an automatic unit.
   * @param other Target date
   * @param unit Relative unit
   */
  to(other: DateLike, unit?: Intl.RelativeTimeFormatUnit): string {
    const resolved = this.#relativeUnit(other, unit)
    return this.#formatRelative(zeroNegZero(-this.diff(other, resolved)), resolved)
  }

  /**
   * Difference from `other` to this date in `unit` (Temporal `until` / `total` semantics).
   * Calendar units use civil-date math; the default truncates toward zero.
   * @param other Base date
   * @param unit Duration unit
   * @param exact When true, leave fractional totals
   */
  diff(other: DateLike, unit: DurationUnit = 'milliseconds', exact = false): number {
    const o = new IntlDate(other, { locale: this.locale, utc: this.utc })
    if (!this.isValid() || !o.isValid()) return Number.NaN
    const field = durationField(unit)
    const s = o.getTime()
    const e = this.getTime()

    const timeMs = TIME_UNIT_MS.get(field)
    let v: number
    if (timeMs !== undefined) {
      v = (e - s) / timeMs
    } else if (field === 'years') {
      v = calendarDiff(s, e, this.utc, 'months', 12, exact)
    } else if (field === 'quarters') {
      v = calendarDiff(s, e, this.utc, 'months', 3, exact)
    } else if (field === 'months') {
      v = calendarDiff(s, e, this.utc, 'months', 1, exact)
    } else if (field === 'weeks') {
      v = calendarDiff(s, e, this.utc, 'days', 7, exact)
    } else {
      v = calendarDiff(s, e, this.utc, 'days', 1, exact)
    }

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

  /**
   * Start of the given unit. `week` uses the locale first day of week; `isoWeek` is Monday 00:00.
   * Day-or-larger units use compatible wall resolution; hour/minute/second keep this offset when valid.
   * @param unit Duration unit, or `isoWeek` / `isoWeeks`
   */
  startOf(unit: DurationUnit | 'isoWeek' | 'isoWeeks'): IntlDate {
    const field = resolveStartUnit(unit)
    if (field === 'milliseconds') return this.clone()
    if (!this.isValid()) return this.clone()

    const t = this.getTime()
    const w = readWall(t, this.utc)
    let target: WallFields

    if (field === 'years') {
      target = { year: w.year, month: 1, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }
    } else if (field === 'quarters') {
      const month = 3 * Math.floor((w.month - 1) / 3) + 1
      target = { year: w.year, month, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }
    } else if (field === 'months') {
      target = {
        year: w.year,
        month: w.month,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0
      }
    } else if (field === 'weeks' || field === 'isoWeek') {
      const rule = field === 'isoWeek' ? ISO_WEEK_RULE : localeWeekRule(this.locale)
      const dn = dayNumber(w.year, w.month, w.day)
      const startDn = dn - ((weekdayOf(dn) - rule.firstDay + 7) % 7)
      const civil = civilFromDayNumber(startDn)
      target = {
        year: civil.year,
        month: civil.month,
        day: civil.day,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0
      }
    } else if (field === 'days') {
      target = {
        year: w.year,
        month: w.month,
        day: w.day,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0
      }
    } else if (field === 'hours') {
      target = {
        year: w.year,
        month: w.month,
        day: w.day,
        hour: w.hour,
        minute: 0,
        second: 0,
        millisecond: 0
      }
    } else if (field === 'minutes') {
      target = {
        year: w.year,
        month: w.month,
        day: w.day,
        hour: w.hour,
        minute: w.minute,
        second: 0,
        millisecond: 0
      }
    } else {
      target = {
        year: w.year,
        month: w.month,
        day: w.day,
        hour: w.hour,
        minute: w.minute,
        second: w.second,
        millisecond: 0
      }
    }

    const prefer = field === 'hours' || field === 'minutes' || field === 'seconds'
    const resolved = prefer
      ? wallToTimePreferOffset(target, this.utc, offsetMsAt(t, this.utc))
      : this.utc
        ? utcWallToTime(target)
        : localWallToTime(target)
    return this.clone(new Date(resolved))
  }

  /**
   * End of the given unit. Time units keep this offset when valid and never land before the receiver;
   * day-or-larger units are `startOf(unit)` plus one unit minus 1 ms.
   * @param unit Duration unit, or `isoWeek` / `isoWeeks`
   */
  endOf(unit: DurationUnit | 'isoWeek' | 'isoWeeks'): IntlDate {
    const field = resolveStartUnit(unit)
    if (field === 'milliseconds') return this.clone()
    if (!this.isValid()) return this.clone()

    if (field === 'hours' || field === 'minutes' || field === 'seconds') {
      const t = this.getTime()
      const w = readWall(t, this.utc)
      const fields: WallFields = {
        year: w.year,
        month: w.month,
        day: w.day,
        hour: w.hour,
        minute: field === 'hours' ? 59 : w.minute,
        second: field === 'seconds' ? w.second : 59,
        millisecond: 999
      }
      if (field === 'hours') {
        fields.minute = 59
        fields.second = 59
      } else if (field === 'minutes') {
        fields.second = 59
      }
      const resolved = wallToTimePreferOffset(fields, this.utc, offsetMsAt(t, this.utc))
      return this.clone(new Date(resolved))
    }

    const addField: DurationField = field === 'isoWeek' ? 'weeks' : field
    return this.startOf(unit)
      .add({ [addField]: 1 })
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
