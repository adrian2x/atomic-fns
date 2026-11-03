const NATIVE_DATE =
  /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/

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

/**
 * Returns a new Date from the given arguments.
 * @param date The date value
 * @param utc Interprets the given value as a UTC date
 * @returns The new date object
 */
export function asDate(date: string | number | Date | null | undefined, utc = false): Date {
  if (date === null) {
    return new Date(NaN)
  }

  date ??= Date.now()

  if (typeof date === 'string' && !/Z$/i.test(date)) {
    const d: (string | undefined)[] | null = NATIVE_DATE.exec(date)

    if (d) {
      const year = Number(d[1])
      const month = d[2] !== undefined && d[2] !== '' ? Number(d[2]) - 1 : 0
      const day = d[3] !== undefined && d[3] !== '' ? Number(d[3]) : 1
      const hour = d[4] !== undefined ? Number(d[4]) : 0
      const minute = d[5] !== undefined ? Number(d[5]) : 0
      const second = d[6] !== undefined ? Number(d[6]) : 0
      const ms = Number((d[7] ?? '0').padEnd(3, '0').slice(0, 3))

      if (utc) {
        return new Date(Date.UTC(year, month, day, hour, minute, second, ms))
      }

      return new Date(year, month, day, hour, minute, second, ms)
    }
  }

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
