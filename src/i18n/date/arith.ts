import { ValueError } from '../../globals/index.js'

/** Calendar and clock fields for duration arithmetic. */
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

const CALENDAR_UNITS = ['years', 'quarters', 'months', 'weeks', 'days'] as const

function lastDayOfMonth(year: number, monthIndex: number, utc: boolean): number {
  const d = new Date(0)
  if (utc) {
    d.setUTCFullYear(year, monthIndex + 1, 0)
    return d.getUTCDate()
  }
  d.setFullYear(year, monthIndex + 1, 0)
  return d.getDate()
}

/**
 * Adds a duration to a date. Calendar units keep wall-clock time; time units add exact ms.
 * @param date Base instant.
 * @param dur Duration fields.
 * @param sign `1` to add, `-1` to subtract.
 * @param utc When true, calendar math uses UTC accessors.
 */
export function addDuration(date: Date, dur: DurationObject, sign: 1 | -1 = 1, utc = false): Date {
  for (const unit of CALENDAR_UNITS) {
    const v = dur[unit] ?? 0
    if (!Number.isInteger(v)) {
      throw new ValueError(`calendar unit ${unit} must be an integer`)
    }
  }

  const years = dur.years ?? 0
  const quarters = dur.quarters ?? 0
  const monthsIn = dur.months ?? 0
  const weeks = dur.weeks ?? 0
  const daysIn = dur.days ?? 0
  const hours = dur.hours ?? 0
  const minutes = dur.minutes ?? 0
  const seconds = dur.seconds ?? 0
  const milliseconds = dur.milliseconds ?? 0

  const months = sign * (12 * years + 3 * quarters + monthsIn)
  const days = sign * (7 * weeks + daysIn)

  const out = new Date(date.getTime())
  if (months !== 0) {
    const y = utc ? out.getUTCFullYear() : out.getFullYear()
    const m0 = utc ? out.getUTCMonth() : out.getMonth()
    const d = utc ? out.getUTCDate() : out.getDate()
    const m = m0 + months
    const ty = y + Math.floor(m / 12)
    const tm = ((m % 12) + 12) % 12
    const last = lastDayOfMonth(ty, tm, utc)
    const day = Math.min(d, last)
    if (utc) out.setUTCFullYear(ty, tm, day)
    else out.setFullYear(ty, tm, day)
  }

  if (days !== 0) {
    if (utc) out.setUTCDate(out.getUTCDate() + days)
    else out.setDate(out.getDate() + days)
  }

  const ms = sign * (hours * 3_600_000 + minutes * 60_000 + seconds * 1000 + milliseconds)
  return new Date(out.getTime() + ms)
}

/**
 * Subtracts a duration from a date.
 * @param date Base instant.
 * @param dur Duration fields.
 * @param utc When true, calendar math uses UTC accessors.
 */
export function subDuration(date: Date, dur: DurationObject, utc = false): Date {
  return addDuration(date, dur, -1, utc)
}
