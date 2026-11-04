import { ValueError } from '../../globals/index.js'
import { truncateForError } from '../../internal/truncate.js'
import type { DurationField, DurationObject } from '../duration.js'
import { advanceWall, daysInMonthOf, MAX_TIME_MS, readWall, wallToTime } from './calendar.js'

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

/**
 * Last calendar day of the month for `year` and 0-based `monthIndex`.
 * @param year Calendar year.
 * @param monthIndex Month index 0-11.
 */
export function lastDayOfMonth(year: number, monthIndex: number): number {
  return daysInMonthOf(year, monthIndex + 1)
}

function readField(dur: DurationObject, key: DurationField): number {
  const value = dur[key]
  if (value === undefined) return 0
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValueError(`duration field ${truncateForError(key)} must be a finite number`)
  }
  if (CALENDAR_FIELDS.has(key) && !Number.isInteger(value)) {
    throw new ValueError(`calendar unit ${truncateForError(key)} must be an integer`)
  }
  return value
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
      throw new ValueError(`unknown duration field ${truncateForError(key)}`)
    }
  }

  const years = readField(dur, 'years')
  const quarters = readField(dur, 'quarters')
  const monthsIn = readField(dur, 'months')
  const weeks = readField(dur, 'weeks')
  const daysIn = readField(dur, 'days')
  const hours = readField(dur, 'hours')
  const minutes = readField(dur, 'minutes')
  const seconds = readField(dur, 'seconds')
  const milliseconds = readField(dur, 'milliseconds')

  if (Number.isNaN(date.getTime())) return new Date(Number.NaN)

  const months = sign * (12 * years + 3 * quarters + monthsIn)
  const days = sign * (7 * weeks + daysIn)

  let t = date.getTime()
  if (months !== 0 || days !== 0) {
    t = wallToTime(advanceWall(readWall(t, utc), months, days), utc)
  }

  const timeMs = hours * 3_600_000 + minutes * 60_000 + seconds * 1000 + milliseconds
  t += sign * Math.sign(timeMs) * Math.round(Math.abs(timeMs))

  if (!(Math.abs(t) <= MAX_TIME_MS)) {
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
