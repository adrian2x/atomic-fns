const NATIVE_DATE =
  /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/

const TOKEN_RE =
  /\[([^\]]*)]|YYYY|YY|Q|MMMM|MMM|MM|M|DD|D|dddd|ddd|d|E|HH|H|hh|h|kk|k|mm|m|ss|s|SSS|A|a|ZZ|Z|zzz|z|NNNN|NNN|NN|N|X|x|LTS|LT|LLLL|LLL|LL|L|llll|lll|ll|l/g

const FORMAT_DEFAULT = 'YYYY-MM-DDTHH:mm:ssZ'

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function cachedFormatter(locale: string | undefined, opts: Intl.DateTimeFormatOptions) {
  const key = String(locale) + JSON.stringify(opts)
  let fmt = formatterCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, opts)
    formatterCache.set(key, fmt)
  }
  return fmt
}

function partValue(
  locale: string | undefined,
  opts: Intl.DateTimeFormatOptions,
  date: Date,
  type: Intl.DateTimeFormatPartTypes
): string {
  return (
    cachedFormatter(locale, opts)
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

function zoneOffset(date: Date): { sign: string; hh: string; mm: string } {
  const off = -date.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const abs = Math.abs(off)
  return { sign, hh: pad2(Math.trunc(abs / 60)), mm: pad2(abs % 60) }
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

  if (date === undefined) {
    date = Date.now()
  }

  if (typeof date === 'string' && !/Z$/i.test(date)) {
    const d = date.match(NATIVE_DATE)

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

  const src = new Date(date)
  if (utc) {
    if (Number.isNaN(src.getTime())) return src
    return new Date(
      src.getUTCFullYear(),
      src.getUTCMonth(),
      src.getUTCDate(),
      src.getUTCHours(),
      src.getUTCMinutes(),
      src.getUTCSeconds(),
      src.getUTCMilliseconds()
    )
  }
  return src
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

function buildValues(date: Date, locale: string | undefined): Map<string, () => string> {
  const h = date.getHours()
  const min = date.getMinutes()
  const sec = date.getSeconds()
  const ms = date.getMilliseconds()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const year = date.getFullYear()
  const dow = date.getDay()
  const isoDow = dow === 0 ? 7 : dow
  const kHour = h === 0 ? 24 : h
  const offset = () => zoneOffset(date)

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
    ['MMM', () => partValue(locale, { month: 'short' }, date, 'month')],
    ['MMMM', () => partValue(locale, { month: 'long' }, date, 'month')],
    ['Q', () => String(Math.ceil(month / 3))],
    ['D', () => String(day)],
    ['DD', () => pad2(day)],
    ['d', () => String(dow)],
    ['E', () => String(isoDow)],
    ['ddd', () => partValue(locale, { weekday: 'short' }, date, 'weekday')],
    ['dddd', () => partValue(locale, { weekday: 'long' }, date, 'weekday')],
    ['N', () => partValue(locale, { era: 'short' }, date, 'era')],
    ['NN', () => partValue(locale, { era: 'short' }, date, 'era')],
    ['NNN', () => partValue(locale, { era: 'short' }, date, 'era')],
    ['NNNN', () => partValue(locale, { era: 'long' }, date, 'era')],
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
    ['z', () => partValue(locale, { timeZoneName: 'short' }, date, 'timeZoneName')],
    ['zzz', () => partValue(locale, { timeZoneName: 'long' }, date, 'timeZoneName')],
    ['LT', () => `${hour12(h)}:${pad2(min)} ${formatMeridiem(h, false)}`],
    ['LTS', () => `${hour12(h)}:${pad2(min)}:${pad2(sec)} ${formatMeridiem(h, false)}`],
    ['L', () => cachedFormatter(locale, DATE_SHORT_DD).format(date)],
    ['LL', () => cachedFormatter(locale, DATE_FULL).format(date)],
    ['LLL', () => cachedFormatter(locale, DATE_LONG_TIME).format(date)],
    ['LLLL', () => cachedFormatter(locale, DATE_HUGE).format(date)],
    ['l', () => cachedFormatter(locale, DATE_SHORT).format(date)],
    ['ll', () => cachedFormatter(locale, DATE_MED).format(date)],
    ['lll', () => cachedFormatter(locale, DATE_MED_TIME).format(date)],
    ['llll', () => cachedFormatter(locale, DATE_MED_WITH_WEEKDAY).format(date)]
  ])
}

/**
 * Returns a localized string representation of this date, according to the given format string. Format codes use the same specification as {@link https://momentjs.com/docs/#/displaying/format/ moment}.
 * @param formatStr The format string to use
 * @param date The date value
 * @param locale The locale to use when formatting
 * @see {@link https://momentjs.com/docs/#/displaying/format/ List of formats}
 * @example
```js
formatDate('MM/DD/YYYY', new Date()) // '10/31/2022'
```
 */
export function formatDate(formatStr: string, date: Date, locale?: string): string {
  if (Number.isNaN(date.getTime())) {
    return 'Invalid Date'
  }

  const str = formatStr || FORMAT_DEFAULT
  const values = buildValues(date, locale)

  return str.replace(TOKEN_RE, (match, literal: string | undefined) => {
    if (literal !== undefined) return literal
    const getter = values.get(match)
    return getter ? getter() : match
  })
}

function strftimeValues(date: Date, locale: string | undefined): Map<string, () => string> {
  const h = date.getHours()
  const min = date.getMinutes()
  const sec = date.getSeconds()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const year = date.getFullYear()
  const kHour = h === 0 ? 24 : h

  return new Map<string, () => string>([
    ['%A', () => partValue(locale, { weekday: 'long' }, date, 'weekday')],
    ['%a', () => partValue(locale, { weekday: 'short' }, date, 'weekday')],
    ['%d', () => pad2(day)],
    ['%-d', () => String(day)],
    ['%m', () => pad2(month)],
    ['%-m', () => String(month)],
    ['%B', () => partValue(locale, { month: 'long' }, date, 'month')],
    ['%b', () => partValue(locale, { month: 'short' }, date, 'month')],
    ['%bb', () => String(month)],
    ['%Y', () => String(year)],
    ['%y', () => String(year).slice(-2)],
    ['%N', () => partValue(locale, { era: 'long' }, date, 'era')],
    ['%n', () => partValue(locale, { era: 'short' }, date, 'era')],
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
        const o = zoneOffset(date)
        return `${o.sign}${o.hh}${o.mm}`
      }
    ],
    ['%Z', () => partValue(locale, { timeZoneName: 'short' }, date, 'timeZoneName')]
  ])
}

/**
 * Formats a date using a formatting string in the {@link https://strftime.org/ strftime} format, in any given locale.
 * @param fmt The format string to apply
 * @param date The date value
 * @param locale The locale to use when formatting (default is system locale).
 * @returns The string representation of date
 * @see {@link https://strftime.org/ strftime format}
 * @example
```js
strftime('%A, %d/%m/%y', new Date())
// 'Saturday, 01/02/20'
```
 */
export function strftime(fmt: string, date: Date, locale?: string): string {
  if (Number.isNaN(date.getTime())) {
    return 'Invalid Date'
  }

  const values = strftimeValues(date, locale)
  const results: string[] = []

  for (let i = 0; i < fmt.length; i++) {
    const ch = fmt[i]
    if (ch !== '%') {
      results.push(ch)
      continue
    }

    if (i + 1 >= fmt.length) {
      results.push('%')
      break
    }

    const next = fmt[i + 1]
    if (next === '%') {
      results.push('%')
      i++
      continue
    }

    let token = '%'
    let j = i + 1
    if (fmt[j] === '-') {
      token += fmt[j]
      j++
    }
    if (j >= fmt.length) {
      results.push(token)
      break
    }
    token += fmt[j]
    while (j + 1 < fmt.length && fmt[j + 1] === fmt[j]) {
      j++
      token += fmt[j]
    }

    const getter = values.get(token)
    if (getter) {
      results.push(getter())
      i = j
    } else {
      results.push(token)
      i = j
    }
  }

  return results.join('')
}
