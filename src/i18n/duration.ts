import { ValueError } from '../globals/index.js'
import { truncateForError } from '../internal/truncate.js'
import { protocol, type Comparable, type Equatable } from '../operators/protocol.js'
import { canonicalLocales, hasPlainPrototype } from './format.js'

export type DurationField =
  | 'years'
  | 'quarters'
  | 'months'
  | 'weeks'
  | 'days'
  | 'hours'
  | 'minutes'
  | 'seconds'
  | 'milliseconds'

export type DurationUnit =
  | DurationField
  | 'year'
  | 'quarter'
  | 'month'
  | 'week'
  | 'day'
  | 'hour'
  | 'minute'
  | 'second'
  | 'millisecond'

export interface DurationObject {
  years?: number
  quarters?: number
  months?: number
  weeks?: number
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
  milliseconds?: number
}

const FIELD_ORDER: readonly DurationField[] = [
  'years',
  'quarters',
  'months',
  'weeks',
  'days',
  'hours',
  'minutes',
  'seconds',
  'milliseconds'
]

const FIELD_SET: ReadonlySet<string> = new Set(FIELD_ORDER)

function isDurationField(key: string): key is DurationField {
  return FIELD_SET.has(key)
}

const NS_PER_SECOND = 1_000_000_000n
const NS_PER_DAY = 86_400n * NS_PER_SECOND
/** Nanoseconds in a 365-day year. */
const YEAR_NS_365_DAYS = 365n * NS_PER_DAY
/** Nanoseconds in a mean Gregorian year (365.2425 d). */
const YEAR_NS_MEAN_GREGORIAN = 31_556_952n * NS_PER_SECOND

const ROUND_LADDER: readonly DurationField[] = [
  'years',
  'months',
  'weeks',
  'days',
  'hours',
  'minutes',
  'seconds',
  'milliseconds'
]

const ISO_DATE_ORDER: ReadonlyMap<string, { ord: number; field: DurationField }> = new Map([
  ['Y', { ord: 0, field: 'years' }],
  ['M', { ord: 1, field: 'months' }],
  ['W', { ord: 2, field: 'weeks' }],
  ['D', { ord: 3, field: 'days' }]
])

const ISO_TIME_ORDER: ReadonlyMap<string, { ord: number; field: DurationField }> = new Map([
  ['H', { ord: 0, field: 'hours' }],
  ['M', { ord: 1, field: 'minutes' }],
  ['S', { ord: 2, field: 'seconds' }]
])

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER)

/** Reads as the exact flag; `Symbol.for`, so every copy of the library recognizes a Duration. */
const DURATION_BRAND: unique symbol = Symbol.for('atomic-fns.duration')

function isDuration(v: unknown): v is Duration {
  return typeof v === 'object' && v !== null && DURATION_BRAND in v
}

/** Temporal rounding modes as directions for [positive, negative] amounts. */
const ROUNDING_MODES = {
  ceil: ['infinity', 'zero'],
  floor: ['zero', 'infinity'],
  expand: ['infinity', 'infinity'],
  trunc: ['zero', 'zero'],
  halfCeil: ['halfInfinity', 'halfZero'],
  halfFloor: ['halfZero', 'halfInfinity'],
  halfExpand: ['halfInfinity', 'halfInfinity'],
  halfTrunc: ['halfZero', 'halfZero'],
  halfEven: ['halfEven', 'halfEven']
} as const

type RoundingMode = keyof typeof ROUNDING_MODES

interface DurationFormatLike {
  format(fields: Record<string, number>): string
}

type DurationFormatCtor = new (
  locale?: string,
  options?: Record<string, unknown>
) => DurationFormatLike

function isDurationFormatCtor(v: unknown): v is DurationFormatCtor {
  return typeof v === 'function'
}

function unitNanos(field: DurationField | 'microseconds' | 'nanoseconds', exact: boolean): bigint {
  const year = exact ? YEAR_NS_MEAN_GREGORIAN : YEAR_NS_365_DAYS
  switch (field) {
    case 'years':
      return year
    case 'quarters':
      return year / 4n
    case 'months':
      return year / 12n
    case 'weeks':
      return 604_800n * NS_PER_SECOND
    case 'days':
      return NS_PER_DAY
    case 'hours':
      return 3_600n * NS_PER_SECOND
    case 'minutes':
      return 60n * NS_PER_SECOND
    case 'seconds':
      return NS_PER_SECOND
    case 'milliseconds':
      return 1_000_000n
    case 'microseconds':
      return 1_000n
    case 'nanoseconds':
      return 1n
  }
}

function magnitude(n: bigint): bigint {
  return n < 0n ? -n : n
}

function roundsAway(
  direction: (typeof ROUNDING_MODES)[RoundingMode][number],
  doubledRest: bigint,
  unit: bigint,
  odd: boolean
): boolean {
  if (direction === 'zero' || direction === 'infinity') return direction === 'infinity'
  if (doubledRest !== unit) return doubledRest > unit
  return direction === 'halfInfinity' || (direction === 'halfEven' && odd)
}

function roundedCount(ns: bigint, unit: bigint, mode: RoundingMode): bigint {
  const negative = ns < 0n
  const count = ns / unit
  const rest = magnitude(ns % unit)
  if (rest === 0n) return count
  const direction = ROUNDING_MODES[mode][negative ? 1 : 0]
  if (!roundsAway(direction, 2n * rest, unit, count % 2n !== 0n)) return count
  return negative ? count - 1n : count + 1n
}

/** Nanoseconds of the shortest decimal that reads as `v`: `1.1` is 1.1, not its binary tail. */
function decimalNanos(v: number, unit: bigint): bigint {
  const [mantissa, exponent] = v.toExponential().split('e')
  const [whole, fraction = ''] = mantissa.split('.')
  const scaled = BigInt(whole + fraction) * unit
  const shift = Number(exponent) - fraction.length
  if (shift >= 0) return scaled * 10n ** BigInt(shift)
  return roundedCount(scaled, 10n ** BigInt(-shift), 'halfExpand')
}

function fieldNanos(v: number, field: DurationField, exact: boolean): bigint {
  const unit = unitNanos(field, exact)
  const nanos = decimalNanos(v, unit)
  if (Number.isInteger(v)) return nanos
  // A double cannot tell a third of a year from 4 months less 1 ns, so prefer the rounder count.
  const step = 10n ** BigInt(String(magnitude(nanos) >> 52n).length)
  const rounder = roundedCount(nanos, step, 'halfExpand') * step
  return ratio(rounder, unit) === v ? rounder : nanos
}

function totalNanos(values: Readonly<DurationObject>, exact: boolean): bigint {
  let sum = 0n
  for (const f of FIELD_ORDER) {
    const v = values[f]
    if (v !== undefined) sum += fieldNanos(v, f, exact)
  }
  return sum
}

function ratio(numerator: bigint, denominator: bigint): number {
  const n = Number(numerator)
  if (Number.isFinite(n) && BigInt(n) === numerator) {
    const r = n / Number(denominator)
    return r === 0 ? 0 : r
  }
  const q = numerator / denominator
  const r = numerator % denominator
  const out = Number(q) + Number(r) / Number(denominator)
  return out === 0 ? 0 : out
}

/** Whole counts down `fields`; the last rounds, and a count reaching the unit above carries up. */
function roundedSpread(
  ns: bigint,
  fields: readonly DurationField[],
  exact: boolean,
  mode: RoundingMode
): DurationObject {
  const units = fields.map((f) => unitNanos(f, exact))
  const counts: bigint[] = []
  let rem = ns
  for (const unit of units.slice(0, -1)) {
    const count = rem / unit
    counts.push(count)
    rem -= count * unit
  }
  counts.push(roundedCount(rem, units[units.length - 1], mode))
  for (let i = counts.length - 1; i > 0; i--) {
    if (magnitude(counts[i] * units[i]) < units[i - 1]) break
    counts[i - 1] += ns < 0n ? -1n : 1n
    counts[i] = 0n
  }
  return Object.fromEntries(fields.map((f, i) => [f, Number(counts[i])]))
}

function spread(ns: bigint, fields: readonly DurationField[], exact: boolean): DurationObject {
  const out: DurationObject = {}
  let rem = ns
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    const u = unitNanos(f, exact)
    if (i === fields.length - 1) {
      const v = ratio(rem, u)
      out[f] = v === 0 ? 0 : v
    } else {
      const q = rem / u
      out[f] = Number(q)
      rem -= q * u
    }
  }
  return out
}

function copyValues(src: Readonly<DurationObject>): DurationObject {
  const out: DurationObject = {}
  for (const f of FIELD_ORDER) {
    if (src[f] !== undefined) out[f] = src[f]
  }
  return out
}

function freezeValues(src: DurationObject): Readonly<DurationObject> {
  return Object.freeze(src)
}

function presentFields(values: Readonly<DurationObject>): DurationField[] {
  const out: DurationField[] = []
  for (const f of FIELD_ORDER) {
    if (values[f] !== undefined) out.push(f)
  }
  return out
}

function hasMixedSigns(values: Readonly<DurationObject>): boolean {
  let pos = false
  let neg = false
  for (const f of FIELD_ORDER) {
    const v = values[f]
    if (v === undefined || v === 0) continue
    if (v > 0) pos = true
    else neg = true
  }
  return pos && neg
}

function isNegativeDuration(values: Readonly<DurationObject>): boolean {
  for (const f of FIELD_ORDER) {
    const v = values[f]
    if (v !== undefined && v < 0) return true
  }
  return false
}

function nz(v: number): number {
  return v === 0 ? 0 : v
}

/**
 * Canonical plural field for a unit name (exact match, or singular via appending `s`).
 * @param unit Unit name
 * @throws ValueError when `unit` is not a known duration unit
 */
export function durationField(unit: string): DurationField {
  if (typeof unit !== 'string') {
    throw new ValueError(`unknown duration unit ${truncateForError(unit)}`)
  }
  if (isDurationField(unit)) return unit
  const plural = `${unit}s`
  if (isDurationField(plural)) return plural
  throw new ValueError(`unknown duration unit ${truncateForError(unit)}`)
}

/** Temporal's default: the largest non-zero field, or `smallest` when that is larger. */
function defaultLargestUnit(
  values: Readonly<DurationObject>,
  smallest: DurationField
): DurationField {
  const present = FIELD_ORDER.find((f) => (values[f] ?? 0) !== 0) ?? smallest
  const largest = present === 'quarters' ? 'months' : present
  return FIELD_ORDER.indexOf(largest) < FIELD_ORDER.indexOf(smallest) ? largest : smallest
}

function roundingFields(largest: DurationField, smallest: DurationField): DurationField[] {
  if (largest === 'quarters' || smallest === 'quarters') {
    throw new RangeError('quarters cannot be a rounding unit')
  }
  // Temporal: weeks join only when an end of the slice names them; else they fold into days.
  const keepWeeks = largest === 'weeks' || smallest === 'weeks'
  const ladder = keepWeeks ? ROUND_LADDER : ROUND_LADDER.filter((f) => f !== 'weeks')
  const li = ladder.indexOf(largest)
  const si = ladder.indexOf(smallest)
  if (li > si) throw new RangeError('largestUnit must not be smaller than smallestUnit')
  return ladder.slice(li, si + 1)
}

function isoError(text: string): ValueError {
  return new ValueError(`invalid ISO 8601 duration ${truncateForError(text)}`)
}

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9'
}

function asciiUpper(c: string): string {
  return c >= 'a' && c <= 'z' ? c.toUpperCase() : c
}

type AccKey =
  | 'years'
  | 'months'
  | 'weeks'
  | 'days'
  | 'hours'
  | 'minutes'
  | 'seconds'
  | 'milliseconds'
  | 'microseconds'
  | 'nanoseconds'

const CARRY_LADDER: readonly AccKey[] = [
  'years',
  'months',
  'days',
  'hours',
  'minutes',
  'seconds',
  'milliseconds',
  'microseconds',
  'nanoseconds'
]

/** Each field's magnitude carried down, never up: 1.5 hours is 1 h 30 min, 25 hours stays. */
function carriedParts(values: Readonly<DurationObject>, exact: boolean): Record<AccKey, bigint> {
  const parts: Record<AccKey, bigint> = {
    years: 0n,
    months: 0n,
    weeks: 0n,
    days: 0n,
    hours: 0n,
    minutes: 0n,
    seconds: 0n,
    milliseconds: 0n,
    microseconds: 0n,
    nanoseconds: 0n
  }
  const nanosOf = (field: DurationField): bigint => {
    const v = values[field]
    return v === undefined ? 0n : fieldNanos(v, field, exact)
  }
  const carry = (ladder: readonly AccKey[], nanos: bigint) => {
    let rest = magnitude(nanos)
    for (const unit of ladder) {
      const size = unitNanos(unit, exact)
      parts[unit] += rest / size
      rest %= size
    }
  }
  const from = (unit: AccKey) => CARRY_LADDER.slice(CARRY_LADDER.indexOf(unit))
  carry(from('years'), nanosOf('years'))
  carry(from('months'), nanosOf('quarters') + nanosOf('months'))
  carry(['weeks', ...from('days')], nanosOf('weeks'))
  for (const field of ['days', 'hours', 'minutes', 'seconds', 'milliseconds'] as const) {
    carry(from(field), nanosOf(field))
  }
  return parts
}

/**
 * An immutable length of time with optional exact (mean Gregorian) calendar conversion.
 * The protocol operators (`eq`, `compare`, `lt`, `deepEqual`, ...) compare total length, each
 * side in its own mode.
 */
export class Duration implements Comparable, Equatable {
  readonly #fields: Readonly<DurationObject>
  readonly #exact: boolean

  /**
   * @param dur Milliseconds, field object, or another Duration
   * @param exact When true, year/quarter/month use the mean Gregorian year
   */
  constructor(dur?: number | DurationObject | Duration, exact?: boolean)
  constructor(dur?: unknown, exact?: boolean) {
    if (dur === undefined) {
      this.#fields = freezeValues({})
      this.#exact = exact === true
    } else if (typeof dur === 'number') {
      if (!Number.isFinite(dur)) {
        throw new ValueError('duration must be a finite number')
      }
      this.#fields = freezeValues({ milliseconds: nz(dur) })
      this.#exact = exact === true
    } else if (isDuration(dur)) {
      this.#fields = freezeValues(dur.toObject())
      this.#exact = exact ?? dur[DURATION_BRAND]
    } else if (typeof dur === 'string') {
      throw new ValueError('use Duration.from to parse ISO 8601 strings')
    } else if (dur !== null && typeof dur === 'object' && hasPlainPrototype(dur)) {
      const out: DurationObject = {}
      for (const key of Object.keys(dur)) {
        if (!isDurationField(key)) {
          throw new ValueError(`unknown duration field ${truncateForError(key)}`)
        }
        const v: unknown = Reflect.get(dur, key)
        if (v === undefined) continue
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          throw new ValueError(`duration field ${truncateForError(key)} must be a finite number`)
        }
        out[key] = nz(v)
      }
      this.#fields = freezeValues(out)
      this.#exact = exact === true
    } else {
      throw new ValueError('expected a number, Duration, or DurationObject')
    }
    Object.freeze(this)
  }

  static #operand(d?: number | DurationObject | Duration): Duration {
    if (d === undefined) throw new ValueError('expected a number, Duration, or DurationObject')
    return new Duration(d)
  }

  get [DURATION_BRAND](): boolean {
    return this.#exact
  }

  get years(): number {
    return this.#fields.years ?? 0
  }
  get quarters(): number {
    return this.#fields.quarters ?? 0
  }
  get months(): number {
    return this.#fields.months ?? 0
  }
  get weeks(): number {
    return this.#fields.weeks ?? 0
  }
  get days(): number {
    return this.#fields.days ?? 0
  }
  get hours(): number {
    return this.#fields.hours ?? 0
  }
  get minutes(): number {
    return this.#fields.minutes ?? 0
  }
  get seconds(): number {
    return this.#fields.seconds ?? 0
  }
  get milliseconds(): number {
    return this.#fields.milliseconds ?? 0
  }

  /**
   * Field value for `unit`, or 0 when absent.
   * @param unit Singular or plural unit name
   * @example
```js
new Duration({ years: 2, days: 3 }).get('years') // 2
```
   * @example
```js
new Duration({ years: 2, days: 3 }).get('months') // 0
```
   * @example
```js
new Duration({ years: 2, days: 3 }).get('days') // 3
```
   */
  get(unit: string): number {
    return this.#fields[durationField(unit)] ?? 0
  }

  /**
   * Sum with another duration (this mode).
   * @param d Addend
   */
  add(d: number | DurationObject | Duration): Duration {
    const other = Duration.#operand(d)
    const out: DurationObject = {}
    for (const f of FIELD_ORDER) {
      const a = this.#fields[f]
      const b = other.#fields[f]
      if (a === undefined && b === undefined) continue
      out[f] = nz((a ?? 0) + (b ?? 0))
    }
    return new Duration(out, this.#exact)
  }

  /**
   * Difference with another duration (this mode).
   * @param d Subtrahend
   */
  subtract(d: number | DurationObject | Duration): Duration {
    return this.add(Duration.#operand(d).negated())
  }

  /**
   * Negates every field.
   * @example
```js
new Duration({ hours: 1, seconds: 30 }).negated().toObject()
// { hours: -1, seconds: -30 }
```
   */
  negated(): Duration {
    const out: DurationObject = {}
    for (const f of FIELD_ORDER) {
      const v = this.#fields[f]
      if (v === undefined) continue
      out[f] = v === 0 ? 0 : -v
    }
    return new Duration(out, this.#exact)
  }

  /**
   * Same length with no negative field; mixed signs balance first, as in {@link normalize}.
   * @example
```js
new Duration({ hours: 1, seconds: -30 }).abs().toObject()
// { hours: 0, seconds: 3570 }
```
   */
  abs(): Duration {
    const source = this.#balanced()
    const out: DurationObject = {}
    for (const f of FIELD_ORDER) {
      const v = source.#fields[f]
      if (v === undefined) continue
      out[f] = Math.abs(v)
    }
    return new Duration(out, this.#exact)
  }

  /**
   * Total length in `unit` under this conversion mode.
   * @param unit Target unit
   */
  total(unit: DurationUnit): number {
    return ratio(totalNanos(this.#fields, this.#exact), unitNanos(durationField(unit), this.#exact))
  }

  /** Same fields in exact mode. */
  exact(): Duration
  /**
   * Exact-mode total in `unit`.
   * @param unit Target unit
   */
  exact(unit: DurationUnit): number
  exact(unit?: DurationUnit): Duration | number {
    if (unit === undefined) return new Duration(this.#fields, true)
    return this.exact().total(unit)
  }

  /** Fresh mutable copy of the stored fields. */
  toObject(): DurationObject {
    return copyValues(this.#fields)
  }

  /**
   * Redistributes across the same present fields (largest first).
   * Units not present are never introduced.
   */
  normalize(): Duration {
    const fields = presentFields(this.#fields)
    if (fields.length === 0) return new Duration({}, this.#exact)
    return new Duration(
      spread(totalNanos(this.#fields, this.#exact), fields, this.#exact),
      this.#exact
    )
  }

  /**
   * Rounds to `smallestUnit` and balances across the unit slice from `largestUnit` down
   * (Temporal, with fixed unit lengths in place of `relativeTo`). A string means `smallestUnit`:
   * `new Duration({ minutes: 90 }).round('hours')` is `{ hours: 2 }`.
   * `largestUnit` defaults to the largest non-zero field, or `smallestUnit` when that is larger.
   * Without `smallestUnit` nothing rounds and the slice ends at milliseconds, which keep any
   * fraction. `roundingMode` defaults to `halfExpand`. Weeks join the slice only when
   * `largestUnit` or `smallestUnit` names them; otherwise week-sized time folds into days.
   * Drops zero fields.
   * @throws {RangeError} without either unit, with `quarters`, when `largestUnit` is smaller
   * than `smallestUnit`, or for an unknown `roundingMode`.
   */
  round(
    options:
      | DurationUnit
      | {
          largestUnit?: DurationUnit
          smallestUnit?: DurationUnit
          roundingMode?:
            | 'ceil'
            | 'floor'
            | 'expand'
            | 'trunc'
            | 'halfCeil'
            | 'halfFloor'
            | 'halfExpand'
            | 'halfTrunc'
            | 'halfEven'
        }
  ): Duration {
    const units: Exclude<typeof options, string> =
      typeof options === 'string' ? { smallestUnit: options } : options
    const { largestUnit, smallestUnit, roundingMode = 'halfExpand' } = units
    if (!Object.hasOwn(ROUNDING_MODES, roundingMode)) {
      throw new RangeError(`unknown rounding mode ${truncateForError(roundingMode)}`)
    }
    if (largestUnit === undefined && smallestUnit === undefined) {
      throw new RangeError('round needs smallestUnit or largestUnit')
    }
    const smallest = smallestUnit === undefined ? 'milliseconds' : durationField(smallestUnit)
    const largest =
      largestUnit === undefined
        ? defaultLargestUnit(this.#fields, smallest)
        : durationField(largestUnit)
    const fields = roundingFields(largest, smallest)
    const total = totalNanos(this.#fields, this.#exact)
    const spreadOut =
      smallestUnit === undefined
        ? spread(total, fields, this.#exact)
        : roundedSpread(total, fields, this.#exact, roundingMode)
    const out: DurationObject = {}
    for (const f of fields) {
      const v = spreadOut[f]
      if (v !== undefined && v !== 0) out[f] = v
    }
    return new Duration(out, this.#exact)
  }

  #balanced(): Duration {
    return hasMixedSigns(this.#fields) ? this.normalize() : this
  }

  /** ISO 8601 duration string (Temporal-style grammar). */
  toISOString(): string {
    const source = this.#balanced()
    const negative = isNegativeDuration(source.#fields)
    const parts = carriedParts(source.#fields, source.#exact)
    const { years: Y, months: M, weeks: W, days: D, hours: H, minutes: MIN } = parts
    const secNs =
      parts.seconds * NS_PER_SECOND +
      parts.milliseconds * 1_000_000n +
      parts.microseconds * 1_000n +
      parts.nanoseconds

    if (Y === 0n && M === 0n && W === 0n && D === 0n && H === 0n && MIN === 0n && secNs === 0n) {
      return 'PT0S'
    }

    const whole = secNs / NS_PER_SECOND
    const fracNs = secNs % NS_PER_SECOND
    let secText = String(whole)
    if (fracNs > 0n) {
      secText += `.${String(fracNs).padStart(9, '0').replace(/0+$/, '')}`
    }

    let datePart = ''
    if (Y !== 0n) datePart += `${String(Y)}Y`
    if (M !== 0n) datePart += `${String(M)}M`
    if (W !== 0n) datePart += `${String(W)}W`
    if (D !== 0n) datePart += `${String(D)}D`

    let timePart = ''
    if (H !== 0n) timePart += `${String(H)}H`
    if (MIN !== 0n) timePart += `${String(MIN)}M`
    if (secNs !== 0n) timePart += `${secText}S`
    if (timePart.length > 0) timePart = `T${timePart}`

    return `${negative ? '-' : ''}P${datePart}${timePart}`
  }

  /**
   * Same as {@link toISOString}.
   * @example
```js
new Duration({ years: 3, seconds: 45 }).toString() // 'P3YT45S'
```
   * @example
```js
new Duration({ months: 4, seconds: 45 }).toString() // 'P4MT45S'
```
   * @example
```js
new Duration({ months: 5 }).toString() // 'P5M'
```
   * @example
```js
new Duration({ minutes: 5 }).toString() // 'PT5M'
```
   * @example
```js
new Duration({ milliseconds: 6 }).toString() // 'PT0.006S'
```
   */
  toString(): string {
    return this.toISOString()
  }

  /** Same as {@link toISOString}, so `JSON.stringify` keeps the value. */
  toJSON(): string {
    return this.toISOString()
  }

  /** Implicit conversion is not allowed: `<` and `+` would act on the ISO text. */
  valueOf(): never {
    throw new TypeError('Duration cannot be converted implicitly; use total()')
  }

  /**
   * Same as {@link format}.
   * @param locale BCP 47 tag
   * @param options DurationFormat options
   */
  toLocaleString(locale?: string, options?: Record<string, unknown>): string {
    return this.format(locale, options)
  }

  /**
   * Locale string via `Intl.DurationFormat`. Mixed signs balance first, as in {@link normalize}.
   * Where the API is missing, or a value is past its range (2^32 calendar units, 2^53 seconds
   * of time), the result is {@link toISOString}.
   * @param locale BCP 47 tag
   * @param options DurationFormat options
   * @throws {RangeError} for an invalid tag, or one past 255 characters.
   */
  format(locale?: string, options?: Record<string, unknown>): string {
    canonicalLocales(locale)
    const Ctor = Reflect.get(Intl, 'DurationFormat')
    if (!isDurationFormatCtor(Ctor)) return this.toISOString()

    const source = this.#balanced()
    const sign = isNegativeDuration(source.#fields) ? -1 : 1
    const record: Record<string, number> = {}
    for (const [unit, amount] of Object.entries(carriedParts(source.#fields, source.#exact))) {
      if (amount !== 0n) record[unit] = sign * Number(amount)
    }

    const opts = options ?? {}
    if (Object.keys(record).length === 0) {
      const formatOpts =
        'secondsDisplay' in opts || opts.style === 'digital'
          ? opts
          : { ...opts, secondsDisplay: 'always' }
      return new Ctor(locale, formatOpts).format({ seconds: 0 })
    }

    const formatter = new Ctor(locale, opts)
    try {
      return formatter.format(record)
    } catch (error) {
      if (error instanceof RangeError) return this.toISOString()
      throw error
    }
  }

  [protocol.compare](o: unknown): number | undefined {
    if (!isDuration(o)) return undefined
    const mine = totalNanos(this.#fields, this.#exact)
    const theirs = totalNanos(o.toObject(), o[DURATION_BRAND])
    return mine < theirs ? -1 : mine > theirs ? 1 : 0
  }

  [protocol.equals](o: unknown): boolean {
    return this[protocol.compare](o) === 0
  }

  /**
   * Build a Duration from an ISO 8601 string, milliseconds, field object, or Duration.
   * ISO components stay as written, unlike Temporal's balancing: `PT1.5H` is `{ hours: 1.5 }`,
   * not 1 hour 30 minutes. A fraction a double cannot carry to 1 ns keeps its whole part in the
   * field and spills the rest into `milliseconds`.
   * @param input Source value
   * @example
```js
Duration.from('P3Y6M1W4DT12H30M5S').toObject()
// { years: 3, months: 6, weeks: 1, days: 4, hours: 12, minutes: 30, seconds: 5 }
Duration.from('PT23H').toObject() // { hours: 23 }
Duration.from('P5Y3M').toObject() // { years: 5, months: 3 }
```
   */
  static from(input: string | number | DurationObject | Duration): Duration {
    if (typeof input !== 'string') return Duration.#operand(input)
    const text = input

    const fail = (): never => {
      throw isoError(text)
    }

    let i = 0
    let negative = false
    if (text[i] === '+' || text[i] === '-') {
      negative = text[i] === '-'
      i++
    }
    if (i >= text.length || asciiUpper(text[i]) !== 'P') fail()
    i++

    const values: DurationObject = {}
    let componentCount = 0

    const store = (field: DurationField, value: number) => {
      values[field] = negative ? (value === 0 ? 0 : -value) : value
      componentCount += 1
    }

    const readWhole = (): string => {
      while (text[i] === '0') i++
      const start = i
      while (i < text.length && isDigit(text[i])) {
        if (i - start >= 16) fail()
        i++
      }
      return text.slice(start, i) || '0'
    }

    let prevDate = -1
    while (i < text.length) {
      const ch = text[i]
      if (asciiUpper(ch) === 'T') break
      if (!isDigit(ch)) fail()

      const intDigits = readWhole()
      if (i >= text.length) fail()
      if (text[i] === '.' || text[i] === ',') fail()

      const des = asciiUpper(text[i])
      i++
      const dateMeta = ISO_DATE_ORDER.get(des)
      if (dateMeta === undefined) fail()
      else {
        if (dateMeta.ord <= prevDate) fail()
        prevDate = dateMeta.ord
        const n = BigInt(intDigits)
        if (n > MAX_SAFE) fail()
        store(dateMeta.field, Number(n))
      }
    }

    if (i < text.length && asciiUpper(text[i]) === 'T') {
      i++
      let prevTime = -1
      let sawTime = false

      while (i < text.length) {
        if (!isDigit(text[i])) fail()

        const intDigits = readWhole()

        let fracDigits: string | undefined
        if (i < text.length && (text[i] === '.' || text[i] === ',')) {
          i++
          const fracStart = i
          while (i < text.length && isDigit(text[i])) {
            if (i - fracStart >= 9) fail()
            i++
          }
          fracDigits = text.slice(fracStart, i)
          if (fracDigits.length < 1 || fracDigits.length > 9) fail()
        }

        if (i >= text.length) fail()
        const des = asciiUpper(text[i])
        i++
        const timeMeta = ISO_TIME_ORDER.get(des)
        if (timeMeta === undefined) fail()
        else {
          if (timeMeta.ord <= prevTime) fail()
          prevTime = timeMeta.ord

          if (fracDigits !== undefined && i !== text.length) fail()

          const n = BigInt(intDigits)
          if (n > MAX_SAFE) fail()
          if (fracDigits === undefined) {
            store(timeMeta.field, Number(n))
          } else {
            const value = Number(`${intDigits}.${fracDigits}`)
            const u = unitNanos(timeMeta.field, false)
            const fractionNs = BigInt(fracDigits.padEnd(9, '0')) * (u / NS_PER_SECOND)
            if (n * u + fractionNs === fieldNanos(value, timeMeta.field, false)) {
              store(timeMeta.field, value)
            } else {
              store(timeMeta.field, Number(n))
              store('milliseconds', ratio(fractionNs, unitNanos('milliseconds', false)))
            }
          }
          sawTime = true
        }
      }

      if (!sawTime) fail()
    }

    if (i !== text.length) fail()
    if (componentCount === 0) fail()

    return new Duration(values)
  }
}
