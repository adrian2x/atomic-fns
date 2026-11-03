import { ValueError } from '../globals/index.js'

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

function snap(v: number): number {
  const r = Math.round(v)
  const tol = Math.max(5e-10, Math.abs(v) * 4 * Number.EPSILON)
  return Math.abs(v - r) < tol ? r : v
}

function fieldNanos(v: number, field: DurationField, exact: boolean): bigint {
  const s = snap(v)
  const whole = Math.trunc(s)
  const frac = s - whole
  const u = unitNanos(field, exact)
  const fracNs = Math.sign(frac) * Math.round(Math.abs(frac) * Number(u))
  return BigInt(whole) * u + BigInt(fracNs)
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
  if (BigInt(Number(numerator)) === numerator && BigInt(Number(denominator)) === denominator) {
    const r = Number(numerator) / Number(denominator)
    return r === 0 ? 0 : r
  }
  const q = numerator / denominator
  const r = numerator % denominator
  const out = Number(q) + Number(r) / Number(denominator)
  return out === 0 ? 0 : out
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
    throw new ValueError(`unknown duration unit "${String(unit)}"`)
  }
  if (isDurationField(unit)) return unit
  const plural = `${unit}s`
  if (isDurationField(plural)) return plural
  throw new ValueError(`unknown duration unit "${unit}"`)
}

function roundingFields(largestUnit: DurationUnit, smallestUnit?: DurationUnit): DurationField[] {
  const largest = durationField(largestUnit)
  const smallest = durationField(smallestUnit ?? 'milliseconds')
  if (largest === 'quarters' || smallest === 'quarters') {
    throw new RangeError('quarters cannot be a rounding unit')
  }
  // Temporal: weeks on the ladder only when largestUnit is 'weeks' (no years/months
  // above). For largestUnit 'years' the ladder still includes weeks so the result
  // matches the previous full-ladder redistribution for that largest unit.
  let ladder: readonly DurationField[]
  if (largest === 'weeks') {
    ladder = ['weeks', 'days', 'hours', 'minutes', 'seconds', 'milliseconds']
  } else if (largest === 'years') {
    ladder = ROUND_LADDER
  } else {
    ladder = ROUND_LADDER.filter((f) => f !== 'weeks')
  }
  const li = ladder.indexOf(largest)
  const si = ladder.indexOf(smallest)
  if (li === -1 || si === -1 || li > si) {
    throw new RangeError('largestUnit must not be smaller than smallestUnit')
  }
  return ladder.slice(li, si + 1)
}

function isoError(text: string): ValueError {
  const shown = text.length > 40 ? `${text.slice(0, 40)}...` : text
  return new ValueError(`invalid ISO 8601 duration "${shown}"`)
}

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9'
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

function carryChain(start: DurationField, forFormat: boolean): readonly AccKey[] {
  if (start === 'seconds' || start === 'milliseconds') {
    if (!forFormat) return []
  }
  switch (start) {
    case 'years':
      return forFormat
        ? [
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
        : ['years', 'months', 'days', 'hours', 'minutes']
    case 'quarters':
      return forFormat
        ? [
            'months',
            'days',
            'hours',
            'minutes',
            'seconds',
            'milliseconds',
            'microseconds',
            'nanoseconds'
          ]
        : ['months', 'days', 'hours', 'minutes']
    case 'months':
      return forFormat
        ? [
            'months',
            'days',
            'hours',
            'minutes',
            'seconds',
            'milliseconds',
            'microseconds',
            'nanoseconds'
          ]
        : ['months', 'days', 'hours', 'minutes']
    case 'weeks':
      return forFormat
        ? [
            'weeks',
            'days',
            'hours',
            'minutes',
            'seconds',
            'milliseconds',
            'microseconds',
            'nanoseconds'
          ]
        : ['weeks', 'days', 'hours', 'minutes']
    case 'days':
      return forFormat
        ? ['days', 'hours', 'minutes', 'seconds', 'milliseconds', 'microseconds', 'nanoseconds']
        : ['days', 'hours', 'minutes']
    case 'hours':
      return forFormat
        ? ['hours', 'minutes', 'seconds', 'milliseconds', 'microseconds', 'nanoseconds']
        : ['hours', 'minutes']
    case 'minutes':
      return forFormat
        ? ['minutes', 'seconds', 'milliseconds', 'microseconds', 'nanoseconds']
        : ['minutes']
    case 'seconds':
      return ['seconds', 'milliseconds', 'microseconds', 'nanoseconds']
    case 'milliseconds':
      return ['milliseconds', 'microseconds', 'nanoseconds']
  }
}

/**
 * An immutable length of time with optional exact (mean Gregorian) calendar conversion.
 */
export class Duration {
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
    } else if (dur instanceof Duration) {
      this.#fields = freezeValues(copyValues(dur.#fields))
      this.#exact = exact ?? dur.#exact
    } else if (typeof dur === 'string') {
      throw new ValueError('use Duration.from to parse ISO 8601 strings')
    } else if (dur !== null && typeof dur === 'object' && !Array.isArray(dur)) {
      const out: DurationObject = {}
      for (const key of Object.keys(dur)) {
        if (!isDurationField(key)) {
          throw new ValueError(`unknown duration field "${key}"`)
        }
        const v: unknown = Reflect.get(dur, key)
        if (v === undefined) continue
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          throw new ValueError(`duration field ${key} must be a finite number`)
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
    const other = new Duration(d)
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
    return this.add(new Duration(d).negated())
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
   * Absolute value of every field.
   * @example
```js
new Duration({ hours: 1, seconds: -30 }).abs().toObject()
// { hours: 1, seconds: 30 }
```
   */
  abs(): Duration {
    const out: DurationObject = {}
    for (const f of FIELD_ORDER) {
      const v = this.#fields[f]
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
   * Redistributes the exact total across the unit slice from `largestUnit` down to
   * `smallestUnit` (default milliseconds). Drops zero fields; keeps a fractional
   * remainder on the smallest unit.
   */
  round(options: { largestUnit: DurationUnit; smallestUnit?: DurationUnit }): Duration {
    const fields = roundingFields(options.largestUnit, options.smallestUnit)
    const spreadOut = spread(totalNanos(this.#fields, this.#exact), fields, this.#exact)
    const out: DurationObject = {}
    for (const f of fields) {
      const v = spreadOut[f]
      if (v !== undefined && v !== 0) out[f] = v
    }
    return new Duration(out, this.#exact)
  }

  /** ISO 8601 duration string (Temporal-style grammar). */
  toISOString(): string {
    const source = hasMixedSigns(this.#fields) ? this.normalize() : this
    const exact = source.#exact
    const negative = isNegativeDuration(source.#fields)

    const monthsCombined = (source.#fields.months ?? 0) + 3 * (source.#fields.quarters ?? 0)
    const monthsPresent =
      source.#fields.months !== undefined || source.#fields.quarters !== undefined

    let Y = 0n
    let M = 0n
    let W = 0n
    let D = 0n
    let H = 0n
    let MIN = 0n
    let secNs = 0n

    const addCarry = (start: DurationField, absVal: number) => {
      let ns = fieldNanos(absVal, start === 'months' ? 'months' : start, exact)
      if (start === 'seconds' || start === 'milliseconds') {
        secNs += ns
        return
      }
      const chain = carryChain(start, false)
      for (const c of chain) {
        const u = unitNanos(c, exact)
        const q = ns / u
        if (c === 'years') Y += q
        else if (c === 'months') M += q
        else if (c === 'weeks') W += q
        else if (c === 'days') D += q
        else if (c === 'hours') H += q
        else if (c === 'minutes') MIN += q
        ns -= q * u
      }
      secNs += ns
    }

    const years = source.#fields.years
    if (years !== undefined && years !== 0) addCarry('years', Math.abs(years))
    if (monthsPresent && monthsCombined !== 0) addCarry('months', Math.abs(monthsCombined))
    const weeks = source.#fields.weeks
    if (weeks !== undefined && weeks !== 0) addCarry('weeks', Math.abs(weeks))
    const days = source.#fields.days
    if (days !== undefined && days !== 0) addCarry('days', Math.abs(days))
    const hours = source.#fields.hours
    if (hours !== undefined && hours !== 0) addCarry('hours', Math.abs(hours))
    const minutes = source.#fields.minutes
    if (minutes !== undefined && minutes !== 0) addCarry('minutes', Math.abs(minutes))
    const seconds = source.#fields.seconds
    if (seconds !== undefined && seconds !== 0) addCarry('seconds', Math.abs(seconds))
    const milliseconds = source.#fields.milliseconds
    if (milliseconds !== undefined && milliseconds !== 0) {
      addCarry('milliseconds', Math.abs(milliseconds))
    }

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

  /**
   * Locale string via `Intl.DurationFormat`, or ISO when unavailable.
   * @param locale BCP 47 tag
   * @param options DurationFormat options
   */
  format(locale?: string, options?: Record<string, unknown>): string {
    const Ctor = Reflect.get(Intl, 'DurationFormat')
    if (!isDurationFormatCtor(Ctor)) return this.toISOString()

    if (hasMixedSigns(this.#fields)) {
      throw new RangeError('cannot format a duration with mixed signs')
    }

    const exact = this.#exact
    const monthsCombined = (this.#fields.months ?? 0) + 3 * (this.#fields.quarters ?? 0)
    const monthsPresent = this.#fields.months !== undefined || this.#fields.quarters !== undefined
    const weeksPresent = this.#fields.weeks !== undefined

    const acc: Record<AccKey, bigint> = {
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

    const feed = (start: DurationField, absVal: number) => {
      let ns = fieldNanos(absVal, start === 'months' ? 'months' : start, exact)
      const chain = carryChain(start, true)
      for (const c of chain) {
        const u = unitNanos(c, exact)
        const q = ns / u
        acc[c] += q
        ns -= q * u
      }
    }

    const sign = isNegativeDuration(this.#fields) ? -1 : 1

    const years = this.#fields.years
    if (years !== undefined && years !== 0) feed('years', Math.abs(years))
    if (monthsPresent && monthsCombined !== 0) feed('months', Math.abs(monthsCombined))
    const weeks = this.#fields.weeks
    if (weeks !== undefined && weeks !== 0) feed('weeks', Math.abs(weeks))
    const days = this.#fields.days
    if (days !== undefined && days !== 0) feed('days', Math.abs(days))
    const hours = this.#fields.hours
    if (hours !== undefined && hours !== 0) feed('hours', Math.abs(hours))
    const minutes = this.#fields.minutes
    if (minutes !== undefined && minutes !== 0) feed('minutes', Math.abs(minutes))
    const seconds = this.#fields.seconds
    if (seconds !== undefined && seconds !== 0) feed('seconds', Math.abs(seconds))
    const milliseconds = this.#fields.milliseconds
    if (milliseconds !== undefined && milliseconds !== 0) {
      feed('milliseconds', Math.abs(milliseconds))
    }

    if (!weeksPresent) acc.weeks = 0n

    const record: Record<string, number> = {}
    const keys: AccKey[] = [
      'years',
      'months',
      'weeks',
      'days',
      'hours',
      'minutes',
      'seconds',
      'milliseconds',
      'microseconds',
      'nanoseconds'
    ]
    for (const k of keys) {
      if (acc[k] === 0n) continue
      if (k === 'weeks' && !weeksPresent) continue
      record[k] = sign * Number(acc[k])
    }

    const opts = options ?? {}
    if (Object.keys(record).length === 0) {
      const formatOpts =
        'secondsDisplay' in opts || opts.style === 'digital'
          ? opts
          : { ...opts, secondsDisplay: 'always' }
      return new Ctor(locale, formatOpts).format({ seconds: 0 })
    }

    return new Ctor(locale, opts).format(record)
  }

  /**
   * Build a Duration from an ISO 8601 string, milliseconds, field object, or Duration
   * (Temporal.Duration.from shape).
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
    if (typeof input !== 'string') return new Duration(input)
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
    if (i >= text.length || text[i].toUpperCase() !== 'P') fail()
    i++

    const values: DurationObject = {}
    let componentCount = 0

    const store = (field: DurationField, value: number) => {
      values[field] = negative ? (value === 0 ? 0 : -value) : value
      componentCount += 1
    }

    let prevDate = -1
    while (i < text.length) {
      const ch = text[i]
      if (ch.toUpperCase() === 'T') break
      if (!isDigit(ch)) fail()

      const intStart = i
      while (i < text.length && isDigit(text[i])) {
        if (i - intStart >= 16) fail()
        i++
      }
      const intDigits = text.slice(intStart, i)
      if (intDigits.length === 0) fail()
      if (i >= text.length) fail()
      if (text[i] === '.' || text[i] === ',') fail()

      const des = text[i].toUpperCase()
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

    if (i < text.length && text[i].toUpperCase() === 'T') {
      i++
      let prevTime = -1
      let sawTime = false

      while (i < text.length) {
        if (!isDigit(text[i])) fail()

        const intStart = i
        while (i < text.length && isDigit(text[i])) {
          if (i - intStart >= 16) fail()
          i++
        }
        const intDigits = text.slice(intStart, i)
        if (intDigits.length === 0) fail()

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
        const des = text[i].toUpperCase()
        i++
        const timeMeta = ISO_TIME_ORDER.get(des)
        if (timeMeta === undefined) fail()
        else {
          if (timeMeta.ord <= prevTime) fail()
          prevTime = timeMeta.ord

          if (fracDigits !== undefined && i !== text.length) fail()

          if (fracDigits === undefined) {
            const n = BigInt(intDigits)
            if (n > MAX_SAFE) fail()
            store(timeMeta.field, Number(n))
          } else {
            const value = Number(`${intDigits}.${fracDigits}`)
            if (!(value <= Number.MAX_SAFE_INTEGER)) fail()
            const u = unitNanos(timeMeta.field, false)
            const exactNs =
              BigInt(intDigits) * u + BigInt(fracDigits.padEnd(9, '0')) * (u / NS_PER_SECOND)
            if (exactNs !== fieldNanos(value, timeMeta.field, false)) fail()
            store(timeMeta.field, value)
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
