import { describe, expect, it } from 'vitest'
import { civilFromDayNumber, dayNumber, utcWallToTime } from '../src/i18n/date/calendar.js'

/** Epoch day number via Date.UTC + setUTCFullYear (literal years 0..99). */
function refDayNumber(year: number, month: number, day: number): number {
  const d = new Date(0)
  d.setUTCFullYear(year, month - 1, day)
  d.setUTCHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 86_400_000)
}

function refCivil(dn: number): { year: number; month: number; day: number } {
  const d = new Date(dn * 86_400_000)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate()
  }
}

describe('dayNumber / civilFromDayNumber', () => {
  it('round-trips edge years through utcWallToTime and dayNumber', () => {
    const years = [0, 1, 99, 100, -1, -271820, 275759]
    for (const year of years) {
      const wall = {
        year,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0
      }
      const t = utcWallToTime(wall)
      expect(Number.isFinite(t)).toBe(true)
      const dn = dayNumber(year, 1, 1)
      expect(t).toBe(dn * 86_400_000)
      expect(civilFromDayNumber(dn)).toEqual({ year, month: 1, day: 1 })
      expect(dn).toBe(refDayNumber(year, 1, 1))
    }
  })

  it('matches Date.UTC day numbers for every day from -1000-01-01 to 3000-12-31', () => {
    const start = refDayNumber(-1000, 1, 1)
    const end = refDayNumber(3000, 12, 31)
    for (let dn = start; dn <= end; dn++) {
      const civil = civilFromDayNumber(dn)
      const ref = refCivil(dn)
      if (
        civil.year !== ref.year ||
        civil.month !== ref.month ||
        civil.day !== ref.day ||
        dayNumber(civil.year, civil.month, civil.day) !== dn ||
        dayNumber(ref.year, ref.month, ref.day) !== dn
      ) {
        expect({ dn, civil, ref, back: dayNumber(civil.year, civil.month, civil.day) }).toEqual({
          dn,
          civil: ref,
          ref,
          back: dn
        })
        return
      }
    }
    expect(end - start + 1).toBeGreaterThan(1_000_000)
  }, 60_000)
})
