const NATIVE_DATE =
  /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/

/**
 * Returns a new Date from the given arguments.
 * @param {string | number | Date} date The date value
 * @param {?boolean} [utc=false] Interprets the given value as a UTC date
 * @returns {Date} The new date object
 */
export function asDate(date: string | number | Date, utc = false) {
  if (date === null) {
    return new Date(NaN)
  }

  if (date == undefined) {
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
const TOKEN_MAP = {
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
  '%Z': { timeZoneName: 'longGeneric', year: dd },
  '%-Z': { timeZoneName: 'shortGeneric', year: dd },
  '%z': { timeZoneName: 'longOffset', year: dd },
  '%-z': { timeZoneName: 'shortOffset', year: dd },
  '%ZZ': { timeZoneName: l, year: dd },
  '%-ZZ': { timeZoneName: s, year: dd }
}

const HOUR_PARTS = { '%I': 1, '%-I': 1, '%K': 1, '%k': 1 }
const ERA_PARTS = { '%n': 1, '%N': 1, '%nn': 1 }
const TZ_PARTS = { '%ZZ': 1, '%-ZZ': 1, '%-z': 1, '%z': 1, '%-Z': 1, '%Z': 1 }

const formatter = (locale: string, opts) => new Intl.DateTimeFormat(locale, opts)

/**
 * Formats a date using a formatting string in the {@link https://strftime.org/ strftime} format, in any given locale.
 * @param {string} fmt The format string to apply
 * @param {number | Date} date The date value
 * @param {?string} locale The locale to use when formatting (default is system locale).
 * @returns {string} The string representation of date
 * @see {@link https://strftime.org/ strftime format}
 */
export function format(fmt: string, date: number | Date, locale?) {
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
        const res = formatter(locale, TOKEN_MAP[part]).format(date).split(' ')
        // save the AM/PM for the correct spot
        results.push(res[0])
        dayPeriod = res[1]
        continue
      }

      if (part === '%P' || part === '%p') {
        // leave this flag in place for later
        dayPeriodIndex = results.length
        results.push(part)
        continue
      }

      if (ERA_PARTS[part] || TZ_PARTS[part]) {
        // the formatting includes the date/year so we take what comes after
        const res = formatter(locale, TOKEN_MAP[part]).format(date).split(' ')
        results.push(res.slice(1).join(' '))
        continue
      }

      // format any other parts
      let res = formatter(locale, TOKEN_MAP[part]).format(date)
      if (part === '%S' && res.length === 1) res = '0' + res
      results.push(res)
    } else {
      // output as literal
      results.push(part)
    }
  }

  // insert the AM/PM at the correct spot
  if (dayPeriodIndex >= 0) results[dayPeriodIndex] = dayPeriod || ''

  return results.join('')
}

const DATETIME_DEFAULT = {}

/** 10/14/1983 */
const DATE_SHORT = {
  year: n,
  month: n,
  day: n
}

/** Oct 14, 1983 */
const DATE_MED = {
  year: n,
  month: s,
  day: n
}

/** Fri, Oct 14, 1983 */
const DATE_MED_WITH_WEEKDAY = {
  year: n,
  month: s,
  day: n,
  weekday: s
}

/** October 14, 1983 */
const DATE_FULL = {
  year: n,
  month: l,
  day: n
}

/** Tuesday, October 14, 1983 */
const DATE_HUGE = {
  year: n,
  month: l,
  day: n,
  weekday: l
}

/** 09:30 AM */
const TIME_SIMPLE = {
  hour: n,
  minute: n
}

/** 09:30:23 AM */
const TIME_WITH_SECONDS = {
  hour: n,
  minute: n,
  second: n
}

/** 09:30:23 AM EDT */
const TIME_WITH_SHORT_OFFSET = {
  hour: n,
  minute: n,
  second: n,
  timeZoneName: s
}

/** 09:30:23 AM Eastern Daylight Time */
const TIME_WITH_LONG_OFFSET = {
  hour: n,
  minute: n,
  second: n,
  timeZoneName: l
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
  minute: n
}

/** 10/14/1983, 9:30:33 AM */
const DATETIME_SHORT_WITH_SECONDS = {
  year: n,
  month: n,
  day: n,
  hour: n,
  minute: n,
  second: n
}

/** Oct 14, 1983, 9:30 AM */
const DATETIME_MED = {
  year: n,
  month: s,
  day: n,
  hour: n,
  minute: n
}

/** Oct 14, 1983, 9:30:33 AM */
const DATETIME_MED_WITH_SECONDS = {
  year: n,
  month: s,
  day: n,
  hour: n,
  minute: n,
  second: n
}

/** Fri, 14 Oct 1983, 9:30 AM */
const DATETIME_MED_WITH_WEEKDAY = {
  year: n,
  month: s,
  day: n,
  weekday: s,
  hour: n,
  minute: n
}

/** October 14, 1983, 9:30 AM EDT */
const DATETIME_FULL = {
  year: n,
  month: l,
  day: n,
  hour: n,
  minute: n,
  timeZoneName: s
}

/** October 14, 1983, 9:30:33 AM EDT */
const DATETIME_FULL_WITH_SECONDS = {
  year: n,
  month: l,
  day: n,
  hour: n,
  minute: n,
  second: n,
  timeZoneName: s
}

/** Friday, October 14, 1983, 9:30 AM Eastern Daylight Time */
const DATETIME_HUGE = {
  year: n,
  month: l,
  day: n,
  weekday: l,
  hour: n,
  minute: n,
  timeZoneName: l
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
  timeZoneName: l
}
