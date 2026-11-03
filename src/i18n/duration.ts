import { isNumber, isObject, ValueError } from '../globals/index.js'
import { round } from '../math/index.js'
import { parseISODuration } from './date/utils.js'

export type DurationUnit =
  | 'year'
  | 'years'
  | 'quarter'
  | 'quarters'
  | 'month'
  | 'months'
  | 'week'
  | 'weeks'
  | 'day'
  | 'days'
  | 'hour'
  | 'hours'
  | 'minute'
  | 'minutes'
  | 'second'
  | 'seconds'
  | 'millisecond'
  | 'milliseconds'

/** Calendar and clock fields for a Duration. */
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

const lowOrderMatrix = {
  weeks: {
    days: 7,
    hours: 7 * 24,
    minutes: 7 * 24 * 60,
    seconds: 7 * 24 * 60 * 60,
    milliseconds: 7 * 24 * 60 * 60 * 1000
  },
  days: {
    hours: 24,
    minutes: 24 * 60,
    seconds: 24 * 60 * 60,
    milliseconds: 24 * 60 * 60 * 1000
  },
  hours: { minutes: 60, seconds: 60 * 60, milliseconds: 60 * 60 * 1000 },
  minutes: { seconds: 60, milliseconds: 60 * 1000 },
  seconds: { milliseconds: 1000 }
}
const casualMatrix = {
  years: {
    quarters: 4,
    months: 12,
    weeks: 52,
    days: 365,
    hours: 365 * 24,
    minutes: 365 * 24 * 60,
    seconds: 365 * 24 * 60 * 60,
    milliseconds: 365 * 24 * 60 * 60 * 1000
  },
  quarters: {
    months: 3,
    weeks: 13,
    days: 91,
    hours: 91 * 24,
    minutes: 91 * 24 * 60,
    seconds: 91 * 24 * 60 * 60,
    milliseconds: 91 * 24 * 60 * 60 * 1000
  },
  months: {
    weeks: 4,
    days: 30,
    hours: 30 * 24,
    minutes: 30 * 24 * 60,
    seconds: 30 * 24 * 60 * 60,
    milliseconds: 30 * 24 * 60 * 60 * 1000
  },

  ...lowOrderMatrix
}
const exactDaysInYear = 146097.0 / 400
const exactDaysInMonth = 146097.0 / 4800
const exactMatrix = {
  years: {
    quarters: 4,
    months: 12,
    weeks: exactDaysInYear / 7,
    days: exactDaysInYear,
    hours: exactDaysInYear * 24,
    minutes: exactDaysInYear * 24 * 60,
    seconds: exactDaysInYear * 24 * 60 * 60,
    milliseconds: exactDaysInYear * 24 * 60 * 60 * 1000
  },
  quarters: {
    months: 3,
    weeks: exactDaysInYear / 28,
    days: exactDaysInYear / 4,
    hours: (exactDaysInYear * 24) / 4,
    minutes: (exactDaysInYear * 24 * 60) / 4,
    seconds: (exactDaysInYear * 24 * 60 * 60) / 4,
    milliseconds: (exactDaysInYear * 24 * 60 * 60 * 1000) / 4
  },
  months: {
    weeks: exactDaysInMonth / 7,
    days: exactDaysInMonth,
    hours: exactDaysInMonth * 24,
    minutes: exactDaysInMonth * 24 * 60,
    seconds: exactDaysInMonth * 24 * 60 * 60,
    milliseconds: exactDaysInMonth * 24 * 60 * 60 * 1000
  },

  ...lowOrderMatrix
}

type ConversionMatrix = Record<string, Record<string, number>>

/** Maps singular and plural unit names to the plural form. */
export const UNITS_PLURAL: Record<string, DurationUnit | undefined> = {
  year: 'years',
  years: 'years',
  quarter: 'quarters',
  quarters: 'quarters',
  month: 'months',
  months: 'months',
  week: 'weeks',
  weeks: 'weeks',
  day: 'days',
  days: 'days',
  hour: 'hours',
  hours: 'hours',
  minute: 'minutes',
  minutes: 'minutes',
  second: 'seconds',
  seconds: 'seconds',
  millisecond: 'milliseconds',
  milliseconds: 'milliseconds'
}

const orderedUnits = [
  'years',
  'quarters',
  'months',
  'weeks',
  'days',
  'hours',
  'minutes',
  'seconds',
  'milliseconds'
] as const

type OrderedUnit = (typeof orderedUnits)[number]

const reverseUnits = orderedUnits.slice(0).reverse()

function unitValue(value: number | undefined): number {
  return value === undefined || value === 0 || Number.isNaN(value) ? 0 : value
}

/**
 * An immutable length of time in calendar and clock units.
 * Construct from a number (milliseconds), a field object, or another Duration.
 * ISO-8601 strings go through {@link Duration.fromISO}.
 */
export class Duration {
  /** The stored unit fields. */
  readonly values: DurationObject
  readonly #exact: boolean
  readonly #matrix: ConversionMatrix

  /**
   * @param dur Milliseconds, unit fields, or another Duration.
   * @param exact When true, year/month conversions use average Gregorian lengths.
   */
  constructor(dur: number | DurationObject | Duration = {}, exact?: boolean) {
    if (typeof dur === 'string') {
      throw new ValueError('use Duration.fromISO')
    }
    if (dur instanceof Duration) {
      this.values = { ...dur.values }
      this.#exact = exact ?? dur.#exact
    } else if (isNumber(dur)) {
      this.values = { milliseconds: dur }
      this.#exact = exact ?? false
    } else if (isObject(dur)) {
      this.values = normalizeUnits(dur)
      this.#exact = exact ?? false
    } else {
      throw new ValueError('Duration input must be a number, Duration, or DurationObject')
    }
    this.#matrix = this.#exact ? exactMatrix : casualMatrix
  }

  /** Get the years. */
  get years(): number {
    return unitValue(this.values.years)
  }

  /** Get the quarters. */
  get quarters(): number {
    return unitValue(this.values.quarters)
  }

  /** Get the months. */
  get months(): number {
    return unitValue(this.values.months)
  }

  /** Get the weeks. */
  get weeks(): number {
    return unitValue(this.values.weeks)
  }

  /** Get the days. */
  get days(): number {
    return unitValue(this.values.days)
  }

  /** Get the hours. */
  get hours(): number {
    return unitValue(this.values.hours)
  }

  /** Get the minutes. */
  get minutes(): number {
    return unitValue(this.values.minutes)
  }

  /** Get the seconds. */
  get seconds(): number {
    return unitValue(this.values.seconds)
  }

  /** Get the milliseconds. */
  get milliseconds(): number {
    return unitValue(this.values.milliseconds)
  }

  /**
   * Get the value of unit.
   * @param unit a unit such as 'minute' or 'day'
   * @example new Duration({years: 2, days: 3}).get('years') // 2
   * @example new Duration({years: 2, days: 3}).get('months') // 0
   * @example new Duration({years: 2, days: 3}).get('days') // 3
   */
  get(unit: string): number {
    const key = UNITS_PLURAL[unit.toLowerCase()]
    return key ? this[key as OrderedUnit] : 0
  }

  /**
   * Add another duration. Returns a new Duration; keeps this instance's exact mode.
   * @param duration The amount to add.
   */
  add(duration: number | DurationObject | Duration): Duration {
    const dur = new Duration(duration)
    const result: DurationObject = {}

    for (const k of orderedUnits) {
      if (dur.values[k] || this.values[k]) {
        result[k] = dur.get(k) + this.get(k)
      }
    }

    return new Duration(result, this.#exact)
  }

  /**
   * Make this Duration shorter by the specified amount. Return a newly-constructed Duration.
   * @param duration The amount to subtract.
   */
  subtract(duration: number | DurationObject | Duration): Duration {
    const dur = new Duration(duration)
    return this.add(dur.negated())
  }

  /**
   * Return the negative of this Duration.
   * @example
```js
new Duration({ hours: 1, seconds: 30 }).negated().toObject()
// { hours: -1, seconds: -30 }
```
   */
  negated(): Duration {
    const negated: DurationObject = {}
    for (const k of Object.keys(this.values) as OrderedUnit[]) {
      const v = this.values[k]
      if (v !== undefined) negated[k] = v === 0 ? 0 : -v
    }
    return new Duration(negated, this.#exact)
  }

  /**
   * Return the absolute values of this Duration.
   * @example
```js
new Duration({ hours: 1, seconds: -30 }).abs().toObject()
// { hours: 1, seconds: 30 }
```
   */
  abs(): Duration {
    const parts: DurationObject = {}
    for (const k of Object.keys(this.values) as OrderedUnit[]) {
      const v = this.values[k]
      if (v !== undefined) parts[k] = Math.abs(v)
    }
    return new Duration(parts, this.#exact)
  }

  #shiftToAll() {
    return this.#shiftTo(
      'years',
      'months',
      'weeks',
      'days',
      'hours',
      'minutes',
      'seconds',
      'milliseconds'
    )
  }

  #shiftTo(...units: string[]) {
    if (units.length === 0) {
      return this
    }

    const targetUnits = units.map((u) => UNITS_PLURAL[u.toLowerCase()])

    const built: DurationObject = {}
    const accumulated: DurationObject = {}
    const vals = this.toObject()
    let lastUnit: OrderedUnit | undefined

    for (const toUnit of orderedUnits) {
      if (targetUnits.includes(toUnit)) {
        lastUnit = toUnit
        let own = 0

        for (const fromUnit in accumulated) {
          own += (accumulated[fromUnit as OrderedUnit] ?? 0) * this.#matrix[fromUnit][toUnit]
          accumulated[fromUnit as OrderedUnit] = 0
        }

        if (typeof vals[toUnit] === 'number') {
          own += vals[toUnit]
        }

        const i = Math.trunc(own)
        built[toUnit] = i
        accumulated[toUnit] = (own * 1000 - i * 1000) / 1000

        for (const fromUnit in vals) {
          if (orderedUnits.indexOf(fromUnit as OrderedUnit) > orderedUnits.indexOf(toUnit)) {
            convert(this.#matrix, vals, fromUnit as OrderedUnit, built, toUnit)
          }
        }
      } else if (isNumber(vals[toUnit])) {
        accumulated[toUnit] = vals[toUnit]
      }
    }

    for (const key in accumulated) {
      const pending = accumulated[key as OrderedUnit] ?? 0
      if (pending !== 0 && lastUnit !== undefined) {
        built[lastUnit] =
          (built[lastUnit] ?? 0) +
          (key === lastUnit ? pending : pending / this.#matrix[lastUnit][key])
      }
    }

    return new Duration(built, this.#exact)
  }

  /**
   * Convert this duration to a single unit total.
   * @param unit Target unit.
   */
  total(unit: DurationUnit): number {
    return this.#shiftTo(unit).get(unit)
  }

  /**
   * Return a Duration using exact (average Gregorian) conversions, or the total in `unit`.
   * Never mutates the receiver.
   * @param unit Optional unit for a numeric total.
   */
  exact(unit: DurationUnit): number
  exact(): Duration
  exact(unit?: DurationUnit): Duration | number {
    const d = new Duration(this.values, true)
    if (!unit) return d
    return d.total(unit)
  }

  /** Shallow copy of the unit fields. */
  toObject(): DurationObject {
    return { ...this.values }
  }

  /**
   * Normalize overlapping units (e.g. 90 minutes -> 1 hour 30 minutes).
   * Returns a new Duration; the receiver is unchanged.
   */
  normalize(): Duration {
    const vals = { ...this.values }
    normalizeValues(this.#matrix, vals)
    return new Duration(vals, this.#exact)
  }

  /**
   * Normalize, shift to all units, and drop zeroes.
   */
  rescale(): Duration {
    const dur = this.normalize().#shiftToAll()
    const vals = removeZeroes(dur.values)
    return new Duration(vals, this.#exact)
  }

  /**
   * Returns an ISO 8601-compliant string representation of this Duration.
   * Quarters are folded into months (3 months per quarter).
   * @see https://en.wikipedia.org/wiki/ISO_8601#Durations
   * @example new Duration({ years: 3, seconds: 45 }).toString() // 'P3YT45S'
   * @example new Duration({ months: 4, seconds: 45 }).toString() // 'P4MT45S'
   * @example new Duration({ months: 5 }).toString() // 'P5M'
   * @example new Duration({ minutes: 5 }).toString() // 'PT5M'
   * @example new Duration({ milliseconds: 6 }).toString() // 'PT0.006S'
   */
  toISOString(): string {
    let s = 'P'
    if (this.years !== 0) s += `${String(this.years)}Y`
    const months = this.months + this.quarters * 3
    if (months !== 0) s += `${String(months)}M`
    if (this.weeks !== 0) s += `${String(this.weeks)}W`
    if (this.days !== 0) s += `${String(this.days)}D`
    if (this.hours !== 0 || this.minutes !== 0 || this.seconds !== 0 || this.milliseconds !== 0)
      s += 'T'
    if (this.hours !== 0) s += `${String(this.hours)}H`
    if (this.minutes !== 0) s += `${String(this.minutes)}M`
    if (this.seconds !== 0 || this.milliseconds !== 0)
      s += `${String(round(this.seconds + this.milliseconds / 1000, 3))}S`
    if (s === 'P') s += 'T0S'
    return s
  }

  /** Same as {@link toISOString}. */
  toString(): string {
    return this.toISOString()
  }

  /**
   * Format with `Intl.DurationFormat` when available; otherwise {@link toISOString}.
   * @param locale BCP 47 locale tag.
   * @param options `Intl.DurationFormat` options.
   */
  format(locale?: string, options?: Record<string, unknown>): string {
    const intl = Intl as typeof Intl & {
      DurationFormat?: new (
        locales?: string | string[],
        opts?: Record<string, unknown>
      ) => { format(duration: DurationObject): string }
    }
    if (typeof intl.DurationFormat !== 'function') {
      return this.toISOString()
    }
    const obj = this.toObject()
    if (obj.quarters) {
      obj.months = (obj.months ?? 0) + obj.quarters * 3
      delete obj.quarters
    }
    return new intl.DurationFormat(locale, options).format(obj)
  }

  /**
   * Create a Duration from an ISO 8601 duration string.
   *
   * @example
```js
Duration.fromISO('P3Y6M1W4DT12H30M5S').toObject()
// { years: 3, months: 6, weeks: 1, days: 4, hours: 12, minutes: 30, seconds: 5 }
Duration.fromISO('PT23H').toObject()
// { hours: 23 }
Duration.fromISO('P5Y3M').toObject()
// { years: 5, months: 3 }
```
   */
  static fromISO(text: string): Duration {
    const [parsed] = parseISODuration(text)
    if (!parsed) {
      throw new ValueError(`The input "${text}" can't be parsed as ISO 8601`)
    }
    const hasUnit = Object.values(parsed).some((v) => v != null)
    if (!hasUnit) {
      throw new ValueError(`The input "${text}" can't be parsed as ISO 8601`)
    }
    return new Duration(parsed)
  }
}

function normalizeUnits(obj: Record<string, unknown>): DurationObject {
  const vals: DurationObject = {}
  for (const unit of Object.keys(obj)) {
    const plural = UNITS_PLURAL[unit]
    if (plural && typeof obj[unit] === 'number') {
      vals[plural as OrderedUnit] = obj[unit]
    }
  }
  return vals
}

function antiTrunc(n: number) {
  return n < 0 ? Math.floor(n) : Math.ceil(n)
}

function convert(
  matrix: ConversionMatrix,
  sources: DurationObject,
  fromUnit: OrderedUnit,
  result: DurationObject,
  toUnit: OrderedUnit
) {
  const conv = matrix[toUnit][fromUnit]
  const sourceValue = sources[fromUnit] ?? 0
  const resultValue = result[toUnit] ?? 0
  const raw = sourceValue / conv
  const sameSign = Math.sign(raw) === Math.sign(resultValue)
  const added =
    !sameSign && resultValue !== 0 && Math.abs(raw) <= 1 ? antiTrunc(raw) : Math.trunc(raw)
  result[toUnit] = resultValue + added
  sources[fromUnit] = sourceValue - added * conv
}

function normalizeValues(matrix: ConversionMatrix, vals: DurationObject) {
  reverseUnits.reduce<OrderedUnit | null>((previous, current) => {
    if (vals[current]) {
      if (previous) {
        convert(matrix, vals, previous, vals, current)
      }
      return current
    }
    return previous
  }, null)
}

function removeZeroes(vals: DurationObject): DurationObject {
  const out: DurationObject = {}
  for (const k of orderedUnits) {
    const v = vals[k]
    if (v !== undefined && v !== 0) out[k] = v
  }
  return out
}
