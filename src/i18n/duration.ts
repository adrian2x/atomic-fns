import { pick } from '../collections/index.js'
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

export interface TDuration {
  years?: number
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

export const UNITS_PLURAL: Record<DurationUnit, DurationUnit> = {
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
]
const reverseUnits = orderedUnits.slice(0).reverse()

export class Duration {
  values: TDuration
  private matrix = casualMatrix

  constructor(dur: number | TDuration | Duration = {}, exact = false) {
    if (dur instanceof Duration) {
      this.values = { ...dur.values }
    } else if (isNumber(dur)) {
      this.values = { milliseconds: dur }
    } else if (isObject(dur)) {
      this.values = normalizeUnits(dur)
    }
    if (exact) {
      // Set the conversion matrix to use
      this.matrix = exactMatrix
    }
  }

  /** Get the years. */
  get years() {
    return this.values.years || 0
  }

  /** Get the months. */
  get months() {
    return this.values.months || 0
  }

  /** Get the weeks. */
  get weeks() {
    return this.values.weeks || 0
  }

  /** Get the days. */
  get days() {
    return this.values.days || 0
  }

  /** Get the hours. */
  get hours() {
    return this.values.hours || 0
  }

  /** et the minutes. */
  get minutes() {
    return this.values.minutes || 0
  }

  /** Get the seconds. */
  get seconds() {
    return this.values.seconds || 0
  }

  /** Get the milliseconds. */
  get milliseconds() {
    return this.values.milliseconds || 0
  }

  /**
   * Get the value of unit.
   * @param {string} unit - a unit such as 'minute' or 'day'
   * @example Duration.fromObject({years: 2, days: 3}).get('years') // 2
   * @example Duration.fromObject({years: 2, days: 3}).get('months') // 0
   * @example Duration.fromObject({years: 2, days: 3}).get('days') // 3
   * @return {number}
   */
  get(unit) {
    return this[UNITS_PLURAL[unit.toLowerCase()]]
  }

  add(duration: TDuration) {
    const dur = new Duration(duration)
    const result = {}

    for (const k of orderedUnits) {
      if (dur.values[k] || this.values[k]) {
        result[k] = dur.get(k) + this.get(k)
      }
    }

    return new Duration(result)
  }

  /**
   * Make this Duration shorter by the specified amount. Return a newly-constructed Duration.
   * @param {Duration|Object|number} duration - The amount to subtract.
   * @return {Duration}
   */
  subtract(duration) {
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
   * @returns {Duration}
   */
  negated() {
    const negated = {}
    for (const k of Object.keys(this.values)) {
      negated[k] = this.values[k] === 0 ? 0 : -this.values[k]
    }
    return new Duration(negated)
  }

  /**
   * Return the absolute values of this Duration.
   * @example
```js
new Duration({ hours: 1, seconds: -30 }).abs().toObject()
// { hours: 1, seconds: 30 }
```
   * @returns {Duration}
   */
  abs() {
    const parts = {}
    for (const k of Object.keys(this.values)) {
      parts[k] = Math.abs(this.values[k])
    }
    return new Duration(parts)
  }

  private shiftToAll() {
    return this.shiftTo(
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

  private shiftTo(...units: string[]) {
    if (units.length === 0) {
      return this
    }

    units = units.map((u) => UNITS_PLURAL[u.toLowerCase()])

    const built: TDuration = {}
    const accumulated: TDuration = {}
    const vals = this.toObject()
    let lastUnit

    for (const toUnit of orderedUnits) {
      if (units.includes(toUnit)) {
        lastUnit = toUnit
        let own = 0

        // anything we haven't boiled down yet should get boiled to this unit
        for (const fromUnit in accumulated) {
          own += accumulated[fromUnit] * this.matrix[fromUnit][toUnit]
          accumulated[fromUnit] = 0
        }

        // plus anything that's already in this unit
        if (typeof vals[toUnit] === 'number') {
          own += vals[toUnit]
        }

        const i = Math.trunc(own)
        built[toUnit] = i
        accumulated[toUnit] = (own * 1000 - i * 1000) / 1000

        // plus anything further down the chain that should be rolled up in to this
        for (const fromUnit in vals) {
          if (orderedUnits.indexOf(fromUnit) > orderedUnits.indexOf(toUnit)) {
            convert(this.matrix, vals, fromUnit, built, toUnit)
          }
        }
      } else if (isNumber(vals[toUnit])) {
        accumulated[toUnit] = vals[toUnit]
      }
    }

    // anything leftover becomes the decimal for the last unit
    // lastUnit must be defined since units is not empty
    for (const key in accumulated) {
      if (accumulated[key] !== 0) {
        built[lastUnit] +=
          key === lastUnit ? accumulated[key] : accumulated[key] / this.matrix[lastUnit][key]
      }
    }

    return new Duration(built)
  }

  total(unit: DurationUnit) {
    return this.shiftTo(unit).get(unit) as number
  }

  exact(unit?: DurationUnit) {
    this.matrix = exactMatrix
    if (!unit) return this
    return this.total(unit)
  }

  toObject() {
    return { ...this.values }
  }

  normalize() {
    normalizeValues(this.matrix, this.values)
    return new Duration(this.values)
  }

  rescale() {
    const dur = this.normalize().shiftToAll()
    const vals = removeZeroes(dur.values)
    return new Duration(vals)
  }

  /**
   * Returns an ISO 8601-compliant string representation of this Duration.
   * @see https://en.wikipedia.org/wiki/ISO_8601#Durations
   * @example Duration.fromObject({ years: 3, seconds: 45 }).toString() // 'P3YT45S'
   * @example Duration.fromObject({ months: 4, seconds: 45 }).toString() // 'P4MT45S'
   * @example Duration.fromObject({ months: 5 }).toString() // 'P5M'
   * @example Duration.fromObject({ minutes: 5 }).toString() // 'PT5M'
   * @example Duration.fromObject({ milliseconds: 6 }).toString() // 'PT0.006S'
   * @return {string}
   */
  toISOString() {
    let s = 'P'
    if (this.years !== 0) s += this.years + 'Y'
    if (this.months !== 0) s += this.months + 'M'
    if (this.weeks !== 0) s += this.weeks + 'W'
    if (this.days !== 0) s += this.days + 'D'
    if (this.hours !== 0 || this.minutes !== 0 || this.seconds !== 0 || this.milliseconds !== 0)
      s += 'T'
    if (this.hours !== 0) s += this.hours + 'H'
    if (this.minutes !== 0) s += this.minutes + 'M'
    if (this.seconds !== 0 || this.milliseconds !== 0)
      // this will handle "floating point madness" by removing extra decimal places
      // https://stackoverflow.com/questions/588004/is-floating-point-math-broken
      s += round(this.seconds + this.milliseconds / 1000, 3) + 'S'
    if (s === 'P') s += 'T0S'
    return s
  }

  toString() {
    return this.toISOString()
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
   * @return {Duration}
   */
  static fromISO(text: string) {
    const [parsed] = parseISODuration(text)
    if (parsed) return new Duration(parsed)
    throw new ValueError(`The input "${text}" can't be parsed as ISO 8601`)
  }
}

function normalizeUnits(obj) {
  const vals = {}
  for (const unit of Object.keys(obj)) {
    vals[UNITS_PLURAL[unit]] = obj[unit]
  }
  return vals
}

function antiTrunc(n) {
  return n < 0 ? Math.floor(n) : Math.ceil(n)
}

// NB: mutates parameters
function convert(matrix, sources, fromUnit, result, toUnit) {
  const conv = matrix[toUnit][fromUnit]
  const raw = sources[fromUnit] / conv
  const sameSign = Math.sign(raw) === Math.sign(result[toUnit])
  // ok, so this is wild, but see the matrix in the tests
  const added =
    !sameSign && result[toUnit] !== 0 && Math.abs(raw) <= 1 ? antiTrunc(raw) : Math.trunc(raw)
  result[toUnit] += added
  sources[fromUnit] -= added * conv
}

// NB: mutates parameters
function normalizeValues(matrix, vals) {
  reverseUnits.reduce((previous, current) => {
    if (vals[current]) {
      if (previous) {
        convert(matrix, vals, previous, vals, current)
      }
      return current
    }
    return previous
  }, null)
}

// Remove all properties with a value of 0 from an object
function removeZeroes(vals) {
  return pick(vals, (value) => value !== 0)
}
