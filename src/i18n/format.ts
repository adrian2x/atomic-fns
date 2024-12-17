const NATIVE_DATE =
  /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/
const REGEX_PARSE =
  /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/
const REGEX_FORMAT =
  /\[([^\]]+)]|Y{1,4}|M{1,4}|Q|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|z{1,4}|N{1,4}|LTS?|L{1,4}|l{1,4}|x|X|SSS/g

const FORMAT_DEFAULT = 'YYYY-MM-DDTHH:mm:ssZ'

function padStart(string, length, pad) {
  return String(string).padStart(length, pad)
}

function padZoneStr(instance: Date) {
  const negMinutes = -instance.getTimezoneOffset()
  const minutes = Math.abs(negMinutes)
  const hourOffset = Math.floor(minutes / 60)
  const minuteOffset = minutes % 60
  return `${negMinutes <= 0 ? '+' : '-'}${padStart(hourOffset, 2, '0')}:${padStart(
    minuteOffset,
    2,
    '0'
  )}`
}

/**
 * Returns a new Date from the given arguments.
 * @param {string | number | Date} date The date value
 * @param {?boolean} [utc=false] Interprets the given value as a UTC date
 * @returns {Date} The new date object
 */
export function asDate(date: string | number | Date, utc = false): Date {
  if (date === null) {
    return new Date(NaN)
  }

  if (date === undefined) {
    date = Date.now()
  }

  if (typeof date === 'string' && !/Z$/i.test(date)) {
    const d = date.match(NATIVE_DATE) as any

    if (d) {
      const m = d[2] - 1 || 0
      const ms = (d[7] || '0').slice(0, 3)

      if (utc) {
        return new Date(Date.UTC(d[1], m, d[3] || 1, d[4] || 0, d[5] || 0, d[6] || 0, ms))
      }

      return new Date(d[1], m, d[3] || 1, d[4] || 0, d[5] || 0, d[6] || 0, ms)
    }
  }

  const fromDate = new Date(date)
  if (utc) {
    fromDate.setFullYear(fromDate.getUTCFullYear())
    fromDate.setMonth(fromDate.getUTCMonth())
    fromDate.setDate(fromDate.getUTCDate())
    fromDate.setHours(fromDate.getUTCHours())
    fromDate.setMinutes(fromDate.getUTCMinutes())
    fromDate.setSeconds(fromDate.getUTCSeconds())
    fromDate.setMilliseconds(fromDate.getUTCMilliseconds())
  }
  return fromDate
}

const n = 'numeric'
const s = 'short'
const l = 'long'
const dd = '2-digit'
const STRFTIME = {
  // weekday
  '%A': { weekday: l },
  '%a': { weekday: s },
  '%aa': { weekday: n },
  // day
  '%d': { day: dd },
  '%-d': { day: n },
  // month
  '%m': { month: dd },
  '%-m': { month: n },
  '%B': { month: l },
  '%b': { month: s },
  '%bb': { month: n },
  // year
  '%y': { year: n },
  '%Y': { year: dd },
  // hour
  '%K': { hourCycle: 'h11', hour: dd },
  '%I': { hourCycle: 'h12', hour: dd },
  '%-I': { hourCycle: 'h12', hour: n },
  '%H': { hourCycle: 'h23', hour: dd },
  '%-H': { hourCycle: 'h23', hour: n },
  '%k': { hourCycle: 'h24', hour: n },
  // minutes
  '%M': { minute: dd },
  '%-M': { minute: n },
  // seconds
  '%S': { second: dd },
  '%-S': { second: n },
  // day period
  '%P': { dayPeriod: l },
  '%p': { dayPeriod: s },
  '%pp': { dayPeriod: 'narrow' },
  // era
  '%N': { era: l, year: dd },
  '%n': { era: s, year: dd },
  '%nn': { era: n, year: 'narrow' },
  // timeZoneName
  // '%Z': { timeZoneName: 'longGeneric', year: dd },
  // '%-Z': { timeZoneName: 'shortGeneric', year: dd },
  '%z': { timeZoneName: 'longOffset', year: dd },
  '%-z': { timeZoneName: 'shortOffset', year: dd },
  '%Z': { timeZoneName: l, year: dd },
  '%-Z': { timeZoneName: s, year: dd }
}
const TOKENS = {
  // weekday
  dddd: { weekday: l },
  ddd: { weekday: s },
  E: { weekday: n },
  // day
  DD: { day: dd },
  D: { day: n },
  // month
  MM: { month: dd },
  M: { month: n },
  MMMM: { month: l },
  MMM: { month: s },
  // year
  YYYY: { year: n },
  YY: { year: dd },
  // hour
  hh: { hourCycle: 'h12', hour: dd },
  h: { hourCycle: 'h12', hour: n },
  HH: { hourCycle: 'h23', hour: dd },
  H: { hourCycle: 'h23', hour: n },
  kk: { hourCycle: 'h11', hour: dd },
  k: { hourCycle: 'h24', hour: n },
  // minutes
  mm: { minute: dd },
  m: { minute: n },
  // seconds
  ss: { second: dd },
  s: { second: n },
  // day period
  A: { dayPeriod: l },
  a: { dayPeriod: s },
  // era
  N: { era: s, year: dd },
  NN: { era: s, year: dd },
  NNN: { era: s, year: dd },
  NNNN: { era: l, year: dd },
  // timeZoneName
  ZZ: { timeZoneName: 'longOffset', year: dd },
  Z: { timeZoneName: 'shortOffset', year: dd },
  zzz: { timeZoneName: l, year: dd },
  z: { timeZoneName: s, year: dd }
}

const HOUR_PARTS = { '%I': 1, '%-I': 1, '%K': 1, '%k': 1 }
const ERA_PARTS = { '%n': 1, '%N': 1, '%nn': 1 }
const TZ_PARTS = { '%ZZ': 1, '%-ZZ': 1, '%-z': 1, '%z': 1, '%-Z': 1, '%Z': 1 }

function formatter(locale: string, opts) {
  return new Intl.DateTimeFormat(locale, opts)
}

function formatHour(h, maxLength) {
  return String(h % 12 || 12).padStart(maxLength, '0')
}

function formatMeridiem(hour, isLowercase?) {
  const m = hour < 12 ? 'AM' : 'PM'
  return isLowercase ? m.toLowerCase() : m
}

function formatPart(locale, t, date) {
  const value = formatter(locale, TOKENS[t]).format(date)
  return value.split(/\s+/g).slice(1).join(' ')
}

/**
 * Returns a localized string representation of this date, according to the given format string. Format codes use the same specification as {@link https://momentjs.com/docs/#/displaying/format/ moment}.
 * @param {string} str The format string to use
 * @see {@link https://momentjs.com/docs/#/displaying/format/ List of formats}
 * @example
```js
formatDate(new Date(), 'MM/DD/YYYY') // '10/31/2022'
```
  */
export function formatDate(formatStr: string, date: Date, locale?: string): string {
  const str = formatStr || FORMAT_DEFAULT
  const zoneStr = padZoneStr(date)

  const time = {
    H: date.getHours(),
    HH: padStart(date.getHours(), 2, '0'),
    h: formatHour(date.getHours(), 1),
    hh: formatHour(date.getHours(), 2),
    a: formatMeridiem(date.getHours(), true),
    A: formatMeridiem(date.getHours()),
    m: date.getMinutes(),
    mm: padStart(date.getMinutes(), 2, '0'),
    s: date.getSeconds(),
    ss: padStart(date.getSeconds(), 2, '0'),
    SSS: padStart(date.getMilliseconds(), 3, '0'),
    X: Math.floor(date.getTime() / 1000),
    x: date.getTime()
  }

  const matches = {
    ...time,
    N: formatPart(locale, 'N', date),
    NN: formatPart(locale, 'NN', date),
    NNN: formatPart(locale, 'NNN', date),
    NNNN: formatPart(locale, 'NNNN', date),
    YY: String(date.getFullYear()).slice(-2),
    YYYY: date.getFullYear(),
    M: date.getMonth() + 1,
    MM: padStart(date.getMonth() + 1, 2, '0'),
    MMM: formatter(locale, TOKENS.MMM).format(date),
    MMMM: formatter(locale, TOKENS.MMMM).format(date),
    Q: Math.ceil((date.getMonth() + 1) / 3),
    D: date.getDate(),
    DD: padStart(date.getDate(), 2, '0'),
    d: date.getDay(),
    ddd: formatter(locale, TOKENS.ddd).format(date),
    dddd: formatter(locale, TOKENS.dddd).format(date),
    Z: formatPart(locale, 'Z', date),
    ZZ: formatPart(locale, 'ZZ', date),
    z: formatPart(locale, 'z', date),
    zzz: formatPart(locale, 'zzz', date),
    LT: `${time.h}:${time.mm} ${time.A}`,
    LTS: `${time.h}:${time.mm}:${time.ss} ${time.A}`,
    L: formatter(locale, DATE_SHORT_DD).format(date),
    LL: formatter(locale, DATE_FULL).format(date),
    LLL: formatter(locale, DATE_LONG_TIME).format(date),
    LLLL: formatter(locale, DATE_HUGE).format(date),
    l: formatter(locale, DATE_SHORT).format(date),
    ll: formatter(locale, DATE_MED).format(date),
    lll: formatter(locale, DATE_MED_TIME).format(date),
    llll: formatter(locale, DATE_MED_WITH_WEEKDAY).format(date)
  }

  return str.replace(REGEX_FORMAT, (match, $1) => $1 || matches[match] || zoneStr.replace(':', '')) // 'ZZ'
}

/**
 * Formats a date using a formatting string in the {@link https://strftime.org/ strftime} format, in any given locale.
 * @param {string} fmt The format string to apply
 * @param {Date} date The date value
 * @param {?string} locale The locale to use when formatting (default is system locale).
 * @returns {string} The string representation of date
 * @see {@link https://strftime.org/ strftime format}
 * @example
```js
strftime('%A, %d/%m/%y', new Date())
// 'Saturday, 01/02/2020'
```
 */
export function strftime(fmt: string, date: Date, locale?: string): string {
  const results: string[] = []
  let dayPeriod: string = ''
  let dayPeriodIndex = -1
  for (let i = 0; i < fmt.length; i++) {
    let part = fmt[i]
    if (part === '%') {
      // check for escaped '%'
      if (fmt[++i] === '%') {
        results.push('%')
        continue
      }

      if (fmt[i] === '-') {
        part += fmt[i++]
      }

      part += fmt[i]
      // add any repeated characters that come after
      while (i < fmt.length - 1 && fmt[i + 1] === fmt[i]) part += fmt[++i]

      if (HOUR_PARTS[part]) {
        const res = formatter(locale, STRFTIME[part]).format(date).split(/\s+/g)
        // save the AM/PM for the correct spot
        results.push(res[0])
        dayPeriod = res[1]
        continue
      }

      if (part === '%P' || part === '%p') {
        // leave this flag in place for later
        dayPeriodIndex = results.length
        if (part === '%p' && dayPeriod) {
          dayPeriod = dayPeriod.toLowerCase()
        }
        results.push(part)
        continue
      }

      if (ERA_PARTS[part] || TZ_PARTS[part]) {
        // the formatting includes the date/year so we take what comes after
        const res = formatter(locale, STRFTIME[part]).format(date).split(/\s+/g)
        results.push(res.slice(1).join(' '))
        continue
      }

      // format any other parts
      let res = formatter(locale, STRFTIME[part]).format(date)
      // fix bugs in time formatter
      if ((part === '%S' || part === '%M') && res.length === 1) res = '0' + res
      results.push(res)
    } else {
      // output as literal
      results.push(part)
    }
  }

  // insert the AM/PM at the correct spot
  if (dayPeriodIndex >= 0) results[dayPeriodIndex] = dayPeriod || ''

  return results.join('').trim()
}

const DATETIME_DEFAULT = {}

/** L: 09/04/1983 */
const DATE_SHORT_DD = {
  year: n,
  month: dd,
  day: dd
}

/** l: 9/4/1983 */
const DATE_SHORT = {
  year: n,
  month: n,
  day: n
}

/** ll: Oct 14, 1983 */
const DATE_MED = {
  year: n,
  month: s,
  day: n
}

/** LL: October 14, 1983 */
const DATE_FULL = {
  year: n,
  month: l,
  day: n
}

/** lll: Oct 14, 1983 8:30 PM */
const DATE_MED_TIME = {
  year: n,
  month: s,
  day: n,
  hour: n,
  minute: n,
  hourCycle: 'h12'
}

/** LLL: October 14, 1983 8:30 PM */
const DATE_LONG_TIME = {
  year: n,
  month: l,
  day: n,
  hour: n,
  minute: n,
  hourCycle: 'h12'
}

/** llll: Fri, Oct 14, 1983, 8:30 PM */
const DATE_MED_WITH_WEEKDAY = {
  year: n,
  month: s,
  day: n,
  weekday: s,
  hour: n,
  minute: n,
  hourCycle: 'h12'
}

/** LLLL: Tuesday, October 14, 1983, 8:30 PM */
const DATE_HUGE = {
  year: n,
  month: l,
  day: n,
  weekday: l,
  hour: n,
  minute: n,
  hourCycle: 'h12'
}

/** LT: 09:30 AM */
const TIME_SIMPLE = {
  hour: n,
  minute: n,
  hourCycle: 'h12'
}

/** LTS: 09:30:23 AM */
const TIME_WITH_SECONDS = {
  hour: n,
  minute: n,
  second: n,
  hourCycle: 'h12'
}

/** 09:30:23 AM EDT */
const TIME_WITH_SHORT_OFFSET = {
  hour: n,
  minute: n,
  second: n,
  timeZoneName: s,
  hourCycle: 'h12'
}

/** 09:30:23 AM Eastern Daylight Time */
const TIME_WITH_LONG_OFFSET = {
  hour: n,
  minute: n,
  second: n,
  timeZoneName: l,
  hourCycle: 'h12'
}

/** 09:30 */
const TIME_24_SIMPLE = {
  hour: n,
  minute: n,
  hourCycle: 'h23'
}

/** 09:30:23 */
const TIME_24_WITH_SECONDS = {
  hour: n,
  minute: n,
  second: n,
  hourCycle: 'h23'
}

/** 09:30:23 EDT */
const TIME_24_WITH_SHORT_OFFSET = {
  hour: n,
  minute: n,
  second: n,
  hourCycle: 'h23',
  timeZoneName: s
}

/** 09:30:23 Eastern Daylight Time */
const TIME_24_WITH_LONG_OFFSET = {
  hour: n,
  minute: n,
  second: n,
  hourCycle: 'h23',
  timeZoneName: l
}

/** 10/14/1983, 9:30 AM */
const DATETIME_SHORT = {
  year: n,
  month: n,
  day: n,
  hour: n,
  minute: n,
  hourCycle: 'h12'
}

/** 10/14/1983, 9:30:33 AM */
const DATETIME_SHORT_WITH_SECONDS = {
  year: n,
  month: n,
  day: n,
  hour: n,
  minute: n,
  second: n,
  hourCycle: 'h12'
}

/** Oct 14, 1983, 9:30 AM */
const DATETIME_MED = {
  year: n,
  month: s,
  day: n,
  hour: n,
  minute: n,
  hourCycle: 'h12'
}

/** Oct 14, 1983, 9:30:33 AM */
const DATETIME_MED_WITH_SECONDS = {
  year: n,
  month: s,
  day: n,
  hour: n,
  minute: n,
  second: n,
  hourCycle: 'h12'
}

/** Fri, 14 Oct 1983, 9:30 AM */
const DATETIME_MED_WITH_WEEKDAY = {
  year: n,
  month: s,
  day: n,
  weekday: s,
  hour: n,
  minute: n,
  hourCycle: 'h12'
}

/** October 14, 1983, 9:30 AM EDT */
const DATETIME_FULL = {
  year: n,
  month: l,
  day: n,
  hour: n,
  minute: n,
  timeZoneName: s,
  hourCycle: 'h12'
}

/** October 14, 1983, 9:30:33 AM EDT */
const DATETIME_FULL_WITH_SECONDS = {
  year: n,
  month: l,
  day: n,
  hour: n,
  minute: n,
  second: n,
  timeZoneName: s,
  hourCycle: 'h12'
}

/** Friday, October 14, 1983, 9:30 AM Eastern Daylight Time */
const DATETIME_HUGE = {
  year: n,
  month: l,
  day: n,
  weekday: l,
  hour: n,
  minute: n,
  timeZoneName: l,
  hourCycle: 'h12'
}

/** Friday, October 14, 1983, 9:30:33 AM Eastern Daylight Time */
const DATETIME_HUGE_WITH_SECONDS = {
  year: n,
  month: l,
  day: n,
  weekday: l,
  hour: n,
  minute: n,
  second: n,
  timeZoneName: l,
  hourCycle: 'h12'
}
