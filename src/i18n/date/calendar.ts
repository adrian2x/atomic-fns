/** Milliseconds in one civil day. */
export const MS_PER_DAY = 86_400_000

/** Largest absolute time value a `Date` holds. */
export const MAX_TIME_MS = 8.64e15

/** Wall-clock fields in a local or UTC view. */
export interface WallFields {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  millisecond: number
}

/** CLDR week rule: first day of week and minimum days in the first week. */
export interface WeekRule {
  readonly firstDay: number
  readonly minimalDays: number
}

/** ISO 8601 week rule (Monday, four days). */
export const ISO_WEEK_RULE: WeekRule = Object.freeze({ firstDay: 1, minimalDays: 4 })

/**
 * Territories whose first week of the year needs at least four days of that year
 * ([CLDR] weekData minDays=4). Snapshot; engines that expose `minimalDays` override it.
 */
export const MIN_DAYS_4_REGIONS: ReadonlySet<string> = new Set(
  'AD AN AT AX BE BG CH CZ DE DK EE ES FI FJ FO FR GB GF GG GI GP GR HU IE IM IS IT JE LI LT LU MC MQ NL NO PL PT RE RU SE SJ SK SM VA'.split(
    ' '
  )
)

/** CLDR firstDay fallback by region (used when the engine has no week info). */
export const FIRST_DAY_FALLBACK: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>()
  for (const code of 'MV'.split(' ')) map.set(code, 5)
  for (const code of 'AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY'.split(' ')) map.set(code, 6)
  for (const code of 'AG AS BD BR BS BT BW BZ CA CO DM DO ET GT GU HK HN ID IL IN IS JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW'.split(
    ' '
  )) {
    map.set(code, 0)
  }
  return map
})()

/**
 * Proleptic Gregorian day number since 1970-01-01 (Howard Hinnant days_from_civil).
 * Month may overflow (13 -> next January); day may overflow or be non-positive.
 */
function daysFromCivil(year: number, month: number, day: number): number {
  let y = year + Math.floor((month - 1) / 12)
  let m = ((((month - 1) % 12) + 12) % 12) + 1
  if (m <= 2) {
    y -= 1
    m += 12
  }
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const doy = Math.floor((153 * (m - 3) + 2) / 5) + day - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** Inverse of {@link daysFromCivil} (Howard Hinnant civil_from_days). */
function civilFromDays(z: number): { year: number; month: number; day: number } {
  const zAdj = z + 719468
  const era = Math.floor(zAdj / 146097)
  const doe = zAdj - era * 146097
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
  )
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0)
  return { year: y, month: m, day: d }
}

/**
 * Epoch ms of wall fields read as UTC. Years 0..99 are literal.
 * Out-of-range fields roll like MakeDay/MakeTime.
 */
export function utcWallToTime(f: WallFields): number {
  const days = dayNumber(f.year, f.month, f.day)
  const tod = ((f.hour * 60 + f.minute) * 60 + f.second) * 1000 + f.millisecond
  return days * MS_PER_DAY + tod
}

/**
 * Epoch ms of wall fields in the host time zone, with "compatible" disambiguation
 * (gap -> forward by the gap, overlap -> earlier offset).
 */
export function localWallToTime(f: WallFields): number {
  // `Date` reads a year argument of 0-99 as 19xx; the same month counted from 400 years on is literal.
  const shift = f.year >= 0 && f.year <= 99 ? 400 : 0
  return new Date(
    f.year + shift,
    f.month - 1 - shift * 12,
    f.day,
    f.hour,
    f.minute,
    f.second,
    f.millisecond
  ).getTime()
}

/** Epoch ms of wall fields in the UTC or local view. */
export function wallToTime(f: WallFields, utc: boolean): number {
  return utc ? utcWallToTime(f) : localWallToTime(f)
}

/** UTC offset of an instant in milliseconds (local minus UTC). UTC view is 0. */
export function offsetMsAt(time: number, utc: boolean): number {
  return utc ? 0 : utcWallToTime(readWall(time, false)) - time
}

/**
 * Epoch ms for wall fields, preferring `preferredOffsetMs` when that offset is valid
 * for the fields (Temporal `offset: "prefer"`); otherwise "compatible".
 */
export function wallToTimePreferOffset(
  f: WallFields,
  utc: boolean,
  preferredOffsetMs: number
): number {
  if (utc) return utcWallToTime(f)
  const candidate = utcWallToTime(f) - preferredOffsetMs
  if (offsetMsAt(candidate, false) === preferredOffsetMs) {
    const w = readWall(candidate, false)
    if (
      w.year === f.year &&
      w.month === f.month &&
      w.day === f.day &&
      w.hour === f.hour &&
      w.minute === f.minute &&
      w.second === f.second &&
      w.millisecond === f.millisecond
    ) {
      return candidate
    }
  }
  return localWallToTime(f)
}

/** Wall fields of an instant in the local or UTC view. */
export function readWall(time: number, utc: boolean): WallFields {
  const d = new Date(time)
  if (utc) {
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      millisecond: d.getUTCMilliseconds()
    }
  }
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
    millisecond: d.getMilliseconds()
  }
}

/** Civil day number since 1970-01-01. Month may overflow (13 -> next January). */
export function dayNumber(year: number, month: number, day: number): number {
  return daysFromCivil(year, month, day)
}

/** Proleptic Gregorian civil date for a day number. */
export function civilFromDayNumber(dn: number): { year: number; month: number; day: number } {
  return civilFromDays(dn)
}

/** Weekday of a day number: 0 = Sunday .. 6 = Saturday. */
export function weekdayOf(dn: number): number {
  return (((dn + 4) % 7) + 7) % 7
}

/** Days in the given month (1-12); month may overflow. */
export function daysInMonthOf(year: number, month: number): number {
  return dayNumber(year, month + 1, 1) - dayNumber(year, month, 1)
}

/** Wall fields `months` on (day clamped to the target month), then `days` on. */
export function advanceWall(w: WallFields, months: number, days: number): WallFields {
  const index = w.year * 12 + w.month - 1 + months
  const year = Math.floor(index / 12)
  const month = index - year * 12 + 1
  const day = Math.min(w.day, daysInMonthOf(year, month))
  return { ...w, ...civilFromDayNumber(dayNumber(year, month, day) + days) }
}

/** True for a `Date` from any realm, which `instanceof` misses. */
export function isDateBrand(value: unknown): value is Date {
  try {
    Date.prototype.getTime.call(value)
    return true
  } catch {
    return false
  }
}

/**
 * Validates and normalizes a week rule. `firstDay` 7 is Sunday (same as 0).
 * @param firstDay 0..7 (0 or 7 = Sunday, 1 = Monday, ...)
 * @param minimalDays 1..7 days of the new year required in week 1
 */
export function toWeekRule(firstDay = 1, minimalDays = 4): WeekRule {
  if (!Number.isInteger(firstDay) || firstDay < 0 || firstDay > 7) {
    throw new RangeError('firstDay must be an integer from 0 to 7')
  }
  if (!Number.isInteger(minimalDays) || minimalDays < 1 || minimalDays > 7) {
    throw new RangeError('minimalDays must be an integer from 1 to 7')
  }
  return { firstDay: firstDay === 7 ? 0 : firstDay, minimalDays }
}

/** Day number of day 1 of week 1 of week-year `year`. */
export function firstWeekStart(year: number, rule: WeekRule): number {
  const jan1 = dayNumber(year, 1, 1)
  const lead = (weekdayOf(jan1) - rule.firstDay + 7) % 7
  const daysOfYInThatWeek = 7 - lead
  if (daysOfYInThatWeek >= rule.minimalDays) return jan1 - lead
  return jan1 - lead + 7
}

/** Week number and week-numbering year for a civil day number. */
export function weekDateOf(dn: number, rule: WeekRule): { week: number; year: number } {
  let Y = civilFromDayNumber(dn).year
  let start = firstWeekStart(Y, rule)
  if (dn < start) {
    Y = Y - 1
    start = firstWeekStart(Y, rule)
  } else if (dn >= firstWeekStart(Y + 1, rule)) {
    return { week: 1, year: Y + 1 }
  }
  return { week: Math.floor((dn - start) / 7) + 1, year: Y }
}

/** Number of weeks in a week-numbering year (52 or 53). */
export function weekCount(year: number, rule: WeekRule): number {
  return (firstWeekStart(year + 1, rule) - firstWeekStart(year, rule)) / 7
}

function isWeekInfoShape(value: unknown): value is { firstDay?: unknown; minimalDays?: unknown } {
  return value !== null && typeof value === 'object'
}

function readWeekInfo(loc: Intl.Locale): { firstDay?: unknown; minimalDays?: unknown } | undefined {
  const getWeekInfo: unknown = Reflect.get(loc, 'getWeekInfo')
  if (typeof getWeekInfo === 'function') {
    const info: unknown = Reflect.apply(getWeekInfo, loc, [])
    if (isWeekInfoShape(info)) return info
    return undefined
  }
  const weekInfo: unknown = Reflect.get(loc, 'weekInfo')
  if (isWeekInfoShape(weekInfo)) return weekInfo
  return undefined
}

type WeekInfoReader = (
  loc: Intl.Locale
) => { firstDay?: unknown; minimalDays?: unknown } | undefined

/**
 * Locale week rule from `Intl.Locale` week info when available, else CLDR fallback tables.
 * `minimalDays` comes from the engine when present; otherwise from {@link MIN_DAYS_4_REGIONS}
 * (CLDR snapshot - not observable on current engines). A `-u-rg-` override picks the table region.
 * @param locale BCP 47 tag, or the host default when omitted
 * @param readInfo Injectable week-info reader (tests only)
 */
export function localeWeekRule(
  locale: string | undefined,
  readInfo: WeekInfoReader = readWeekInfo
): WeekRule {
  const tag = locale ?? new Intl.DateTimeFormat().resolvedOptions().locale
  const loc = new Intl.Locale(tag)
  const info = readInfo(loc)
  const override = /-rg-([a-z]{2})[a-z0-9]{1,4}(?=-|$)/.exec(loc.toString())?.[1]
  const region = override?.toUpperCase() ?? loc.maximize().region ?? '001'

  let firstDay: number
  if (
    info !== undefined &&
    typeof info.firstDay === 'number' &&
    Number.isInteger(info.firstDay) &&
    info.firstDay >= 1 &&
    info.firstDay <= 7
  ) {
    firstDay = info.firstDay % 7
  } else {
    firstDay = FIRST_DAY_FALLBACK.get(region) ?? 1
  }

  let minimalDays: number
  if (
    info !== undefined &&
    typeof info.minimalDays === 'number' &&
    Number.isInteger(info.minimalDays) &&
    info.minimalDays >= 1 &&
    info.minimalDays <= 7
  ) {
    minimalDays = info.minimalDays
  } else {
    minimalDays = MIN_DAYS_4_REGIONS.has(region) ? 4 : 1
  }

  return { firstDay, minimalDays }
}
