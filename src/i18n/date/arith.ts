import { ValueError } from '../../globals/index.js'
import type { DurationField, DurationObject } from '../duration.js'
import {
  civilFromDayNumber,
  dayNumber,
  daysInMonthOf,
  localWallToTime,
  readWall,
  utcWallToTime
} from './calendar.js'

export type { DurationObject }

const DURATION_FIELDS: ReadonlySet<string> = new Set([
  'years',
  'quarters',
  'months',
  'weeks',
  'days',
  'hours',
  'minutes',
  'seconds',
  'milliseconds'
])

const CALENDAR_FIELDS: ReadonlySet<string> = new Set([
  'years',
  'quarters',
  'months',
  'weeks',
  'days'
])

const DATE_TIME_MAX_MS = 8.64e15

/**
 * Last calendar day of the month for `year` and 0-based `monthIndex`.
 * @param year Calendar year.
 * @param monthIndex Month index 0-11.
 * @param utc When true, use UTC accessors.
 */
export function lastDayOfMonth(year: number, monthIndex: number, utc: boolean): number {
  const d = new Date(0)
  if (utc) {
    d.setUTCFullYear(year, monthIndex + 1, 0)
    return d.getUTCDate()
  }
  d.setFullYear(year, monthIndex + 1, 0)
  return d.getDate()
}

function readField(dur: DurationObject, key: DurationField): number {
  return dur[key] ?? 0
}

/**
 * Adds a duration to a date. Calendar units keep wall-clock time; time units add exact ms.
 * @param date Base instant.
 * @param dur Duration fields.
 * @param sign `1` to add, `-1` to subtract.
 * @param utc When true, calendar math uses UTC accessors.
 */
export function addDuration(date: Date, dur: DurationObject, sign: 1 | -1 = 1, utc = false): Date {
  for (const key of Object.keys(dur)) {
    if (!DURATION_FIELDS.has(key)) {
      throw new ValueError(`unknown duration field "${key}"`)
    }
    const value = dur[key as DurationField]
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new ValueError(`duration field ${key} must be a finite number`)
    }
    if (CALENDAR_FIELDS.has(key) && value !== undefined && !Number.isInteger(value)) {
      throw new ValueError(`calendar unit ${key} must be an integer`)
    }
  }

  if (Number.isNaN(date.getTime())) return new Date(Number.NaN)

  const years = readField(dur, 'years')
  const quarters = readField(dur, 'quarters')
  const monthsIn = readField(dur, 'months')
  const weeks = readField(dur, 'weeks')
  const daysIn = readField(dur, 'days')
  const hours = readField(dur, 'hours')
  const minutes = readField(dur, 'minutes')
  const seconds = readField(dur, 'seconds')
  const milliseconds = readField(dur, 'milliseconds')

  const months = sign * (12 * years + 3 * quarters + monthsIn)
  const days = sign * (7 * weeks + daysIn)

  let t: number
  if (months === 0 && days === 0) {
    t = date.getTime()
  } else {
    const w = readWall(date.getTime(), utc)
    const idx = w.year * 12 + (w.month - 1) + months
    const ty = Math.floor(idx / 12)
    const tm = idx - ty * 12 + 1
    const td = Math.min(w.day, daysInMonthOf(ty, tm))
    const civil = civilFromDayNumber(dayNumber(ty, tm, td) + days)
    const wall = {
      year: civil.year,
      month: civil.month,
      day: civil.day,
      hour: w.hour,
      minute: w.minute,
      second: w.second,
      millisecond: w.millisecond
    }
    t = utc ? utcWallToTime(wall) : localWallToTime(wall)
  }

  const timeMs = hours * 3_600_000 + minutes * 60_000 + seconds * 1000 + milliseconds
  t += sign * Math.sign(timeMs) * Math.round(Math.abs(timeMs))

  if (!(Math.abs(t) <= DATE_TIME_MAX_MS)) {
    throw new RangeError('date out of range')
  }
  return new Date(t)
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
