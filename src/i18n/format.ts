import { daysInMonthOf, localWallToTime, utcWallToTime, type WallFields } from './date/calendar.js'

const TOKEN_RE =
  /\[([^\]]*)]|YYYY|YY|Q|MMMM|MMM|MM|M|Do|DD|D|dddd|ddd|d|E|HH|H|hh|h|kk|k|mm|m|ss|s|SSS|A|a|ZZ|Z|zzz|z|NNNN|NNN|NN|N|X|x|LTS|LT|LLLL|LLL|LL|L|llll|lll|ll|l/g

const STRFTIME_RE = /%%|%(?:-?)([A-Za-z])\1*/g

const FORMAT_DEFAULT = 'YYYY-MM-DDTHH:mm:ssZ'

/** Options shared by {@link formatDate} and {@link strftime}. */
export interface FormatOptions {
  /** BCP 47 locale tag (default is the system locale). */
  locale?: string
  /** When true, read UTC fields of the date instead of local fields. */
  utc?: boolean
}

interface ResolvedFormatOptions {
  locale: string | undefined
  utc: boolean
}

function resolveOptions(
  localeOrOptions: string | FormatOptions | undefined
): ResolvedFormatOptions {
  if (typeof localeOrOptions === 'object') {
    return { locale: localeOrOptions.locale, utc: localeOrOptions.utc === true }
  }
  return { locale: localeOrOptions, utc: false }
}

/** Calendar and clock fields of an instant, read from the local or UTC view. */
interface DateFields {
  year: number
  month: number
  day: number
  dow: number
  hour: number
  minute: number
  second: number
  millisecond: number
  /** Local minus UTC, in minutes. Always 0 for the UTC view. */
  offsetMinutes: number
}

function readFields(date: Date, utc: boolean): DateFields {
  if (utc) {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      dow: date.getUTCDay(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
      millisecond: date.getUTCMilliseconds(),
      offsetMinutes: 0
    }
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    dow: date.getDay(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    millisecond: date.getMilliseconds(),
    offsetMinutes: -date.getTimezoneOffset()
  }
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function cachedFormatter(
  locale: string | undefined,
  opts: Intl.DateTimeFormatOptions,
  utc: boolean
) {
  const resolved = utc ? { ...opts, timeZone: 'UTC' } : opts
  const key = String(locale) + JSON.stringify(resolved)
  let fmt = formatterCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, resolved)
    formatterCache.set(key, fmt)
  }
  return fmt
}

function partValue(
  { locale, utc }: ResolvedFormatOptions,
  opts: Intl.DateTimeFormatOptions,
  date: Date,
  type: Intl.DateTimeFormatPartTypes
): string {
  return (
    cachedFormatter(locale, opts, utc)
      .formatToParts(date)
      .find((p) => p.type === type)?.value ?? ''
  )
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function pad3(n: number): string {
  return String(n).padStart(3, '0')
}

function hour12(h: number): number {
  return h % 12 || 12
}

function formatMeridiem(hour: number, lower: boolean): string {
  const m = hour < 12 ? 'AM' : 'PM'
  return lower ? m.toLowerCase() : m
}

function zoneOffset(offsetMinutes: number): { sign: string; hh: string; mm: string } {
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMinutes)
  return { sign, hh: pad2(Math.trunc(abs / 60)), mm: pad2(abs % 60) }
}

/**
 * English ordinal suffix for a day of month (`1st`, `2nd`, `3rd`, `4th`, `11th`, `21st`).
 * Other languages return the bare number.
 */
function ordinalDay(day: number, locale: string | undefined): string {
  const tag = locale ?? new Intl.DateTimeFormat().resolvedOptions().locale
  let language: string
  try {
    language = new Intl.Locale(tag).language
  } catch {
    return String(day)
  }
  if (language !== 'en') return String(day)
  const category = new Intl.PluralRules(tag, { type: 'ordinal' }).select(day)
  const suffixes: Record<string, string> = { one: 'st', two: 'nd', few: 'rd' }
  return `${String(day)}${suffixes[category] ?? 'th'}`
}

function isAsciiDigit(c: string): boolean {
  return c >= '0' && c <= '9'
}

/**
 * Parse an ISO-8601 / ECMA-262 Date Time String subset.
 * Returns a Date, or the sentinel `'fallback'` when the scan fails before committing
 * to a year-month form (caller may try engine parsing).
 */
function parseDateString(text: string, utc: boolean): Date | 'fallback' {
  let i = 0
  let committed = false

  const peek = (): string | undefined => (i < text.length ? text.charAt(i) : undefined)

  const readDigits = (min: number, max: number): number | undefined => {
    let n = 0
    let count = 0
    while (count < max && i < text.length) {
      const c = text.charAt(i)
      if (!isAsciiDigit(c)) break
      n = n * 10 + (c.charCodeAt(0) - 48)
      i += 1
      count += 1
    }
    if (count < min) return undefined
    return n
  }

  const fail = (): Date | 'fallback' => (committed ? new Date(Number.NaN) : 'fallback')

  let year: number
  const first = peek()
  if (first === '+' || first === '-') {
    const sign = first === '-' ? -1 : 1
    i += 1
    const y = readDigits(6, 6)
    if (y === undefined) return fail()
    // ECMA-262 Date Time String Format rejects "-000000"
    if (sign === -1 && y === 0) return new Date(Number.NaN)
    year = sign * y
  } else {
    const y = readDigits(4, 4)
    if (y === undefined) return fail()
    year = y
  }

  let month = 1
  let day = 1

  if (i === text.length) {
    // year only
  } else if (peek() === '-') {
    i += 1
    committed = true
    const m = readDigits(1, 2)
    if (m === undefined) return fail()
    month = m
    if (peek() === '-') {
      i += 1
      const d = readDigits(1, 2)
      if (d === undefined) return fail()
      day = d
    }
  } else {
    return fail()
  }

  let hour = 0
  let minute = 0
  let second = 0
  let millisecond = 0
  let hasZone = false
  let zoneSign = 1
  let zoneHour = 0
  let zoneMinute = 0

  if (i < text.length) {
    const sep = peek()
    if (sep !== 'T' && sep !== 't' && sep !== ' ') return fail()
    i += 1

    const hh = readDigits(2, 2)
    if (hh === undefined) return fail()
    hour = hh
    if (peek() !== ':') return fail()
    i += 1
    const mm = readDigits(2, 2)
    if (mm === undefined) return fail()
    minute = mm

    if (peek() === ':') {
      i += 1
      const ss = readDigits(2, 2)
      if (ss === undefined) return fail()
      second = ss
      const fracSep = peek()
      if (fracSep === '.' || fracSep === ',') {
        i += 1
        const fracStart = i
        const frac = readDigits(1, 9)
        if (frac === undefined) return fail()
        if (i < text.length && isAsciiDigit(text.charAt(i))) return fail()
        const digits = text.slice(fracStart, i)
        millisecond = Number(digits.padEnd(3, '0').slice(0, 3))
      }
    }

    const z = peek()
    if (z === 'Z' || z === 'z') {
      hasZone = true
      i += 1
    } else if (z === '+' || z === '-') {
      hasZone = true
      zoneSign = z === '-' ? -1 : 1
      i += 1
      const oh = readDigits(2, 2)
      if (oh === undefined) return fail()
      zoneHour = oh
      if (peek() === ':') {
        i += 1
        const om = readDigits(2, 2)
        if (om === undefined) return fail()
        zoneMinute = om
      } else if (i < text.length && isAsciiDigit(text.charAt(i))) {
        const om = readDigits(2, 2)
        if (om === undefined) return fail()
        zoneMinute = om
      }
    }

    if (i !== text.length) return fail()
  }

  if (month < 1 || month > 12) return new Date(Number.NaN)
  const dim = daysInMonthOf(year, month)
  if (day < 1 || day > dim) return new Date(Number.NaN)

  if (hour === 24) {
    if (minute !== 0 || second !== 0 || millisecond !== 0) return new Date(Number.NaN)
  } else if (hour < 0 || hour > 23) {
    return new Date(Number.NaN)
  }
  if (minute < 0 || minute > 59) return new Date(Number.NaN)
  if (second < 0 || second > 59) return new Date(Number.NaN)
  if (hasZone) {
    if (zoneHour < 0 || zoneHour > 23) return new Date(Number.NaN)
    if (zoneMinute < 0 || zoneMinute > 59) return new Date(Number.NaN)
  }

  const fields: WallFields = {
    year,
    month,
    day,
    hour,
    minute,
    second,
    millisecond
  }

  let t: number
  if (hasZone) {
    t = utcWallToTime(fields) - zoneSign * (zoneHour * 60 + zoneMinute) * 60_000
  } else if (utc) {
    t = utcWallToTime(fields)
  } else {
    t = localWallToTime(fields)
  }

  if (!(Math.abs(t) <= 8.64e15)) return new Date(Number.NaN)
  return new Date(t)
}

/**
 * Coerce a value to a `Date`.
 * Strings are parsed with a strict ISO-8601 / ECMA-262 Date Time String subset:
 * out-of-range fields yield an invalid Date; years 0-99 are literal; date-only and
 * zone-less strings use local wall time unless `utc` is true. Non-ISO strings of
 * length 1..128 fall back to engine parsing (`utc` does not apply). Longer non-ISO
 * input is invalid.
 * @param date The date value
 * @param utc When true, zone-less ISO strings are read as UTC
 * @returns The new date object
 */
export function asDate(date: string | number | Date | null | undefined, utc = false): Date {
  if (date === undefined) return new Date()
  if (date === null) return new Date(Number.NaN)
  if (date instanceof Date) return new Date(date.getTime())
  if (typeof date === 'number') return new Date(date)
  if (typeof date !== 'string') return new Date(Number.NaN)

  const parsed = parseDateString(date, utc)
  if (parsed !== 'fallback') return parsed
  if (date.length === 0 || date.length > 128) return new Date(Number.NaN)
  return new Date(date)
}

const DATE_SHORT_DD: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}
const DATE_SHORT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' }
const DATE_MED: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
const DATE_FULL: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
const DATE_MED_TIME: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h12'
}
const DATE_LONG_TIME: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h12'
}
const DATE_MED_WITH_WEEKDAY: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h12'
}
const DATE_HUGE: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h12'
}

function buildValues(date: Date, opts: ResolvedFormatOptions): Map<string, () => string> {
  const { locale, utc } = opts
  const f = readFields(date, utc)
  const h = f.hour
  const min = f.minute
  const sec = f.second
  const ms = f.millisecond
  const month = f.month
  const day = f.day
  const year = f.year
  const dow = f.dow
  const isoDow = dow === 0 ? 7 : dow
  const kHour = h === 0 ? 24 : h
  const offset = () => zoneOffset(f.offsetMinutes)
  const intl = (fmtOpts: Intl.DateTimeFormatOptions) =>
    cachedFormatter(locale, fmtOpts, utc).format(date)

  return new Map<string, () => string>([
    ['H', () => String(h)],
    ['HH', () => pad2(h)],
    ['h', () => String(hour12(h))],
    ['hh', () => pad2(hour12(h))],
    ['k', () => String(kHour)],
    ['kk', () => pad2(kHour)],
    ['a', () => formatMeridiem(h, true)],
    ['A', () => formatMeridiem(h, false)],
    ['m', () => String(min)],
    ['mm', () => pad2(min)],
    ['s', () => String(sec)],
    ['ss', () => pad2(sec)],
    ['SSS', () => pad3(ms)],
    ['X', () => String(Math.floor(date.getTime() / 1000))],
    ['x', () => String(date.getTime())],
    ['YY', () => String(year).slice(-2)],
    ['YYYY', () => String(year)],
    ['M', () => String(month)],
    ['MM', () => pad2(month)],
    ['MMM', () => partValue(opts, { month: 'short' }, date, 'month')],
    ['MMMM', () => partValue(opts, { month: 'long' }, date, 'month')],
    ['Q', () => String(Math.ceil(month / 3))],
    ['D', () => String(day)],
    ['Do', () => ordinalDay(day, locale)],
    ['DD', () => pad2(day)],
    ['d', () => String(dow)],
    ['E', () => String(isoDow)],
    ['ddd', () => partValue(opts, { weekday: 'short' }, date, 'weekday')],
    ['dddd', () => partValue(opts, { weekday: 'long' }, date, 'weekday')],
    ['N', () => partValue(opts, { era: 'short' }, date, 'era')],
    ['NN', () => partValue(opts, { era: 'short' }, date, 'era')],
    ['NNN', () => partValue(opts, { era: 'short' }, date, 'era')],
    ['NNNN', () => partValue(opts, { era: 'long' }, date, 'era')],
    [
      'Z',
      () => {
        const o = offset()
        return `${o.sign}${o.hh}:${o.mm}`
      }
    ],
    [
      'ZZ',
      () => {
        const o = offset()
        return `${o.sign}${o.hh}${o.mm}`
      }
    ],
    ['z', () => (utc ? 'UTC' : partValue(opts, { timeZoneName: 'short' }, date, 'timeZoneName'))],
    ['zzz', () => partValue(opts, { timeZoneName: 'long' }, date, 'timeZoneName')],
    ['LT', () => `${String(hour12(h))}:${pad2(min)} ${formatMeridiem(h, false)}`],
    ['LTS', () => `${String(hour12(h))}:${pad2(min)}:${pad2(sec)} ${formatMeridiem(h, false)}`],
    ['L', () => intl(DATE_SHORT_DD)],
    ['LL', () => intl(DATE_FULL)],
    ['LLL', () => intl(DATE_LONG_TIME)],
    ['LLLL', () => intl(DATE_HUGE)],
    ['l', () => intl(DATE_SHORT)],
    ['ll', () => intl(DATE_MED)],
    ['lll', () => intl(DATE_MED_TIME)],
    ['llll', () => intl(DATE_MED_WITH_WEEKDAY)]
  ])
}

/**
 * Returns a localized string representation of this date for the given format string. Tokens overlap with {@link https://momentjs.com/docs/#/displaying/format/ moment} (`YYYY`, `MM`, `DD`, ...). Differ from moment: default format is `YYYY-MM-DDTHH:mm:ssZ`; `Z`/`ZZ` are numeric offsets; `k`/`kk`/`E` are supported; `Do` renders English ordinals only (other languages render the bare day number).
 * With `utc: true`, UTC fields are read and `Z`/`ZZ`/`z` render `+00:00`/`+0000`/`UTC`.
 * @param formatStr The format string to use
 * @param date The date value
 * @param localeOrOptions A locale tag, or options with `locale` and `utc`
 * @see {@link https://momentjs.com/docs/#/displaying/format/ List of formats}
 * @example
```js
formatDate('MM/DD/YYYY', new Date(2022, 9, 31)) // '10/31/2022'
formatDate('Do MMMM', new Date(2022, 9, 1), 'en') // '1st October'
```
 */
export function formatDate(
  formatStr: string,
  date: Date,
  localeOrOptions?: string | FormatOptions
): string {
  if (Number.isNaN(date.getTime())) {
    return 'Invalid Date'
  }

  const str = formatStr || FORMAT_DEFAULT
  const values = buildValues(date, resolveOptions(localeOrOptions))

  return str.replace(TOKEN_RE, (match, literal: string | undefined) => {
    if (literal !== undefined) return literal
    const getter = values.get(match)
    return getter ? getter() : match
  })
}

function strftimeValues(date: Date, opts: ResolvedFormatOptions): Map<string, () => string> {
  const { utc } = opts
  const f = readFields(date, utc)
  const h = f.hour
  const min = f.minute
  const sec = f.second
  const month = f.month
  const day = f.day
  const year = f.year
  const kHour = h === 0 ? 24 : h

  return new Map<string, () => string>([
    ['%A', () => partValue(opts, { weekday: 'long' }, date, 'weekday')],
    ['%a', () => partValue(opts, { weekday: 'short' }, date, 'weekday')],
    ['%d', () => pad2(day)],
    ['%-d', () => String(day)],
    ['%m', () => pad2(month)],
    ['%-m', () => String(month)],
    ['%B', () => partValue(opts, { month: 'long' }, date, 'month')],
    ['%b', () => partValue(opts, { month: 'short' }, date, 'month')],
    ['%bb', () => String(month)],
    ['%Y', () => String(year)],
    ['%y', () => String(year).slice(-2)],
    ['%N', () => partValue(opts, { era: 'long' }, date, 'era')],
    ['%n', () => partValue(opts, { era: 'short' }, date, 'era')],
    ['%I', () => pad2(hour12(h))],
    ['%-I', () => String(hour12(h))],
    ['%H', () => pad2(h)],
    ['%-H', () => String(h)],
    ['%K', () => pad2(h % 12)],
    ['%k', () => pad2(kHour)],
    ['%M', () => pad2(min)],
    ['%-M', () => String(min)],
    ['%S', () => pad2(sec)],
    ['%-S', () => String(sec)],
    ['%p', () => formatMeridiem(h, false)],
    ['%P', () => formatMeridiem(h, true)],
    [
      '%z',
      () => {
        const o = zoneOffset(f.offsetMinutes)
        return `${o.sign}${o.hh}${o.mm}`
      }
    ],
    ['%Z', () => (utc ? 'UTC' : partValue(opts, { timeZoneName: 'short' }, date, 'timeZoneName'))]
  ])
}

/**
 * Formats a date using a formatting string in the {@link https://strftime.org/ strftime} format, in any given locale.
 * With `utc: true`, UTC fields are read and `%z`/`%Z` render `+0000`/`UTC`.
 * @param fmt The format string to apply
 * @param date The date value
 * @param localeOrOptions A locale tag (default is system locale), or options with `locale` and `utc`.
 * @returns The string representation of date
 * @see {@link https://strftime.org/ strftime format}
 * @example
```js
strftime('%A, %d/%m/%y', new Date(2020, 1, 1))
// 'Saturday, 01/02/20'
```
 */
export function strftime(
  fmt: string,
  date: Date,
  localeOrOptions?: string | FormatOptions
): string {
  if (Number.isNaN(date.getTime())) {
    return 'Invalid Date'
  }

  const values = strftimeValues(date, resolveOptions(localeOrOptions))

  return fmt.replace(STRFTIME_RE, (match) => {
    if (match === '%%') return '%'
    const getter = values.get(match)
    return getter ? getter() : match
  })
}
