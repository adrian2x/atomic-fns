import {
  daysInMonthOf,
  isDateBrand,
  localWallToTime,
  MAX_TIME_MS,
  utcWallToTime,
  type WallFields
} from './date/calendar.js'

const ISO_8601_PATTERN = 'YYYY-MM-DDTHH:mm:ssZ'
const FORMATTER_CACHE_CAPACITY = 64
const MAX_LOCALE_LENGTH = 255
const MAX_PENDING_PIECES = 65_536
const DAY_TOKENS: ReadonlySet<string> = new Set(['D', 'DD', 'Do'])

function isAsciiLetter(c: string): boolean {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')
}

function formatYearYYYY(year: number): string {
  return year >= 0 ? String(year).padStart(4, '0') : '-' + String(-year).padStart(4, '0')
}

function formatYearYY(year: number): string {
  return String(Math.abs(year) % 100).padStart(2, '0')
}

/** Scanner output, joined in chunks: one array slot per token aborts the heap on huge patterns. */
class PieceWriter {
  #text = ''
  #pieces: string[] = []

  write(piece: string): void {
    this.#pieces.push(piece)
    if (this.#pieces.length === MAX_PENDING_PIECES) {
      this.#text += this.#pieces.join('')
      this.#pieces = []
    }
  }

  toString(): string {
    return this.#text + this.#pieces.join('')
  }
}

/**
 * Single-pass formatDate scanner: maximal ASCII letter runs, compound Do/LT/LTS,
 * bracket literals. O(n); see SPEC-R85.
 */
function scanFormat(
  pattern: string,
  onLiteral: (text: string) => void,
  onToken: (token: string) => void
): void {
  const n = pattern.length
  let i = 0
  let noMoreClosers = false
  while (i < n) {
    const c = pattern.charAt(i)
    if (c === '[') {
      const j = noMoreClosers ? -1 : pattern.indexOf(']', i + 1)
      if (j === -1) {
        noMoreClosers = true
        onLiteral('[')
        i += 1
        continue
      }
      onLiteral(pattern.slice(i + 1, j))
      i = j + 1
      continue
    }
    if (isAsciiLetter(c)) {
      let r = 1
      while (i + r < n && pattern.charAt(i + r) === c) {
        r += 1
      }
      let token = pattern.slice(i, i + r)
      if (c === 'D' && r === 1 && pattern.charAt(i + 1) === 'o') {
        token = 'Do'
      } else if (c === 'L' && r === 1 && pattern.charAt(i + 1) === 'T') {
        token = pattern.charAt(i + 2) === 'S' ? 'LTS' : 'LT'
      }
      onToken(token)
      i += token.length
      continue
    }
    let j = i + 1
    while (j < n) {
      const next = pattern.charAt(j)
      if (isAsciiLetter(next) || next === '[') break
      j += 1
    }
    onLiteral(pattern.slice(i, j))
    i = j
  }
}

function hasDayToken(pattern: string): boolean {
  let found = false
  scanFormat(
    pattern,
    () => undefined,
    (token) => {
      found ||= DAY_TOKENS.has(token)
    }
  )
  return found
}

/**
 * Single-pass strftime scanner: %-flag, %bb, %%, unknown directives rescan after `%`.
 * O(n); see SPEC-R86.
 */
function scanStrftime(fmt: string, valueOf: (directive: string) => string | undefined): string {
  const out = new PieceWriter()
  const n = fmt.length
  let i = 0
  while (i < n) {
    const p = fmt.indexOf('%', i)
    if (p === -1) {
      out.write(fmt.slice(i))
      break
    }
    out.write(fmt.slice(i, p))
    let k = p + 1
    const flag = fmt.charAt(k) === '-' ? '-' : ''
    if (flag) {
      k += 1
    }
    if (k >= n) {
      out.write(fmt.slice(p))
      break
    }
    const letter = fmt.charAt(k)
    let directive = '%' + flag + letter
    if (flag === '' && letter === 'b' && fmt.charAt(k + 1) === 'b') {
      directive = '%bb'
    }
    if (flag === '' && letter === '%') {
      out.write('%')
      i = k + 1
      continue
    }
    const v = valueOf(directive)
    if (v === undefined) {
      out.write('%')
      i = p + 1
      continue
    }
    out.write(v)
    i = p + directive.length
  }
  return out.toString()
}

/** Options shared by {@link formatDate} and {@link strftime}. */
export interface FormatOptions {
  /** BCP 47 locale tag, `Intl.Locale`, or a list of them (default is the system locale). */
  locale?: Intl.LocalesArgument
  /** When true, read UTC fields of the date instead of local fields. */
  utc?: boolean
}

interface ResolvedFormatOptions {
  locales: string[]
  utc: boolean
}

/** True for object literals and `Object.create(null)`, from any realm. */
export function hasPlainPrototype(value: object): boolean {
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === null || Object.getPrototypeOf(proto) === null
}

/** Canonical tags for `locale`; an empty list means the system locale. */
export function canonicalLocales(locale: Intl.LocalesArgument): string[] {
  if (locale === undefined) return []
  const tags = [locale].flat().map(String)
  // The engine's canonicalization is quadratic in the tag length.
  if (tags.join().length > MAX_LOCALE_LENGTH) {
    throw new RangeError(`locale is longer than ${String(MAX_LOCALE_LENGTH)} characters`)
  }
  return Intl.getCanonicalLocales(tags)
}

function isFormatOptions(value: unknown): value is FormatOptions {
  return typeof value === 'object' && value !== null && hasPlainPrototype(value)
}

function resolveOptions(
  localeOrOptions: Intl.LocalesArgument | FormatOptions
): ResolvedFormatOptions {
  if (isFormatOptions(localeOrOptions)) {
    return { locales: canonicalLocales(localeOrOptions.locale), utc: localeOrOptions.utc === true }
  }
  return { locales: canonicalLocales(localeOrOptions), utc: false }
}

/** Calendar and clock fields of an instant, read from the local or UTC view. */
interface DateFields extends WallFields {
  dow: number
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
      millisecond: date.getUTCMilliseconds()
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
    millisecond: date.getMilliseconds()
  }
}

/** Capacity-64 LRU of Intl.DateTimeFormat; contents are not observable through results. */
class FormatterCache {
  #entries = new Map<string, Intl.DateTimeFormat>()
  #hostZone = ''

  get(locales: string[], opts: Intl.DateTimeFormatOptions, utc: boolean): Intl.DateTimeFormat {
    // A formatter keeps the zone it was built in, and this text changes with the host zone.
    const hostZone = new Date(0).toTimeString()
    if (hostZone !== this.#hostZone) {
      this.#hostZone = hostZone
      this.#entries.clear()
    }
    const resolved = utc ? { ...opts, timeZone: 'UTC' } : opts
    const key = String(locales) + JSON.stringify(resolved)
    const hit = this.#entries.get(key)
    if (hit) {
      this.#entries.delete(key)
      this.#entries.set(key, hit)
      return hit
    }
    if (this.#entries.size >= FORMATTER_CACHE_CAPACITY) {
      const oldest = this.#entries.keys().next().value
      if (oldest !== undefined) {
        this.#entries.delete(oldest)
      }
    }
    const fmt = new Intl.DateTimeFormat(locales, resolved)
    this.#entries.set(key, fmt)
    return fmt
  }
}

const formatterCache = new FormatterCache()

/** Cached ordinal PluralRules keyed by canonical locale; `null` means non-English. */
const ordinalPluralCache = new Map<string, Intl.PluralRules | null>()

function cachedFormatter(
  locales: string[],
  opts: Intl.DateTimeFormatOptions,
  utc: boolean
): Intl.DateTimeFormat {
  return formatterCache.get(locales, opts, utc)
}

function cachedOrdinalPlural(tag: string): Intl.PluralRules | null {
  const hit = ordinalPluralCache.get(tag)
  if (hit !== undefined) {
    ordinalPluralCache.delete(tag)
    ordinalPluralCache.set(tag, hit)
    return hit
  }
  const language = new Intl.Locale(tag).language
  const rules = language === 'en' ? new Intl.PluralRules(tag, { type: 'ordinal' }) : null
  if (ordinalPluralCache.size >= FORMATTER_CACHE_CAPACITY) {
    const oldest = ordinalPluralCache.keys().next().value
    if (oldest !== undefined) ordinalPluralCache.delete(oldest)
  }
  ordinalPluralCache.set(tag, rules)
  return rules
}

function partValue(
  { locales, utc }: ResolvedFormatOptions,
  opts: Intl.DateTimeFormatOptions,
  date: Date,
  type: Intl.DateTimeFormatPartTypes
): string {
  return (
    cachedFormatter(locales, opts, utc)
      .formatToParts(date)
      .find((p) => p.type === type)?.value ?? ''
  )
}

function monthName(
  { locales, utc }: ResolvedFormatOptions,
  date: Date,
  month: 'short' | 'long'
): string {
  return cachedFormatter(locales, { calendar: 'gregory', month }, utc).format(date)
}

/** The long month as it reads next to a day, which is the genitive in `ru`, `pl`, `cs`, `uk`. */
function monthNameWithDay(opts: ResolvedFormatOptions, date: Date): string {
  const options = { calendar: 'gregory', day: 'numeric', month: 'long' } as const
  const name = partValue(opts, options, date, 'month')
  // Japanese and Chinese put 月 in a literal part, leaving a bare number here.
  return /^\p{Nd}+$/u.test(name) ? monthName(opts, date, 'long') : name
}

function eraName(opts: ResolvedFormatOptions, date: Date, era: 'short' | 'long'): string {
  return partValue(opts, { calendar: 'gregory', era }, date, 'era')
}

function dayPeriod(opts: ResolvedFormatOptions, date: Date): string {
  return partValue(opts, { hour: 'numeric', hour12: true }, date, 'dayPeriod')
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

/** Local minus UTC, read off the wall fields: `getTimezoneOffset` drops the seconds of old zones. */
function zoneOffset(
  fields: WallFields,
  date: Date
): { sign: string; hh: string; mm: string; ss: string } {
  const offsetSeconds = (utcWallToTime(fields) - date.getTime()) / 1000
  const abs = Math.abs(offsetSeconds)
  return {
    sign: offsetSeconds >= 0 ? '+' : '-',
    hh: pad2(Math.trunc(abs / 3600)),
    mm: pad2(Math.trunc(abs / 60) % 60),
    ss: abs % 60 === 0 ? '' : pad2(abs % 60)
  }
}

/**
 * English ordinal suffix for a day of month (`1st`, `2nd`, `3rd`, `4th`, `11th`, `21st`).
 * Other languages return the bare number. PluralRules are cached per resolved locale.
 */
function ordinalDay(day: number, locales: string[]): string {
  const tag = locales.at(0) ?? new Intl.DateTimeFormat().resolvedOptions().locale
  const rules = cachedOrdinalPlural(tag)
  if (rules === null) return String(day)
  const category = rules.select(day)
  const suffixes: Record<string, string> = { one: 'st', two: 'nd', few: 'rd' }
  return `${String(day)}${suffixes[category] ?? 'th'}`
}

function isAsciiDigit(c: string): boolean {
  return c >= '0' && c <= '9'
}

const MONTH_ABBREVIATIONS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ')

// V8 reads any word starting with a month name as that month, so only these tokens reach it.
const ENGINE_TIME_TAIL = /^(?: (?:[ap]m|utc|gmt|[ecmp][ds]t|[+-]\d{2}:?\d{2}))+$/i

/**
 * Parse an ISO-8601 / ECMA-262 Date Time String subset.
 * Returns a Date, or the sentinel `'fallback'` when the caller may try engine parsing: the scan
 * failed before committing to a signed year, a year-month form, or a time, or a valid date and
 * time carry only meridiem and zone tokens.
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
    committed = true
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

  if (peek() === '-') {
    i += 1
    committed = true
    const named = MONTH_ABBREVIATIONS.indexOf(text.slice(i, i + 3).toLowerCase())
    if (named >= 0) {
      month = named + 1
      i += 3
    } else {
      const m = readDigits(1, 2)
      if (m === undefined) return fail()
      month = m
    }
    if (peek() === '-') {
      i += 1
      const d = readDigits(1, 2)
      if (d === undefined) return fail()
      day = d
    }
  }

  let hour = 0
  let minute = 0
  let second = 0
  let millisecond = 0
  let fraction = 0
  let hasZone = false
  let zoneSign = 1
  let zoneHour = 0
  let zoneMinute = 0
  let zoneSecond = 0

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
    committed = true

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
        fraction = frac
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
      const separator = peek() === ':' ? ':' : ''
      const hasField = (): boolean =>
        separator === '' ? isAsciiDigit(text.charAt(i)) : peek() === separator
      if (hasField()) {
        i += separator.length
        const om = readDigits(2, 2)
        if (om === undefined) return fail()
        zoneMinute = om
        if (hasField()) {
          i += separator.length
          const os = readDigits(2, 2)
          if (os === undefined) return fail()
          zoneSecond = os
        }
      }
    }
  }

  if (month < 1 || month > 12) return new Date(Number.NaN)
  const dim = daysInMonthOf(year, month)
  if (day < 1 || day > dim) return new Date(Number.NaN)

  if (hour === 24) {
    if (minute !== 0 || second !== 0 || fraction !== 0) return new Date(Number.NaN)
  } else if (hour < 0 || hour > 23) {
    return new Date(Number.NaN)
  }
  if (minute < 0 || minute > 59) return new Date(Number.NaN)
  if (second < 0 || second > 59) return new Date(Number.NaN)
  if (hasZone) {
    if (zoneHour < 0 || zoneHour > 23) return new Date(Number.NaN)
    if (zoneMinute < 0 || zoneMinute > 59) return new Date(Number.NaN)
    if (zoneSecond < 0 || zoneSecond > 59) return new Date(Number.NaN)
  }
  if (i !== text.length) return ENGINE_TIME_TAIL.test(text.slice(i)) ? 'fallback' : fail()

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
    t = utcWallToTime(fields) - zoneSign * ((zoneHour * 60 + zoneMinute) * 60 + zoneSecond) * 1000
  } else if (utc) {
    t = utcWallToTime(fields)
  } else {
    t = localWallToTime(fields)
  }

  if (!(Math.abs(t) <= MAX_TIME_MS)) return new Date(Number.NaN)
  return new Date(t)
}

/**
 * Coerce a value to a `Date`. A `Date` from any realm keeps its instant.
 * Strings are trimmed, then parsed as the ISO-8601 / ECMA-262 Date Time String format, also
 * accepting one-digit months and days, `YYYY-Mon-DD` with an English month abbreviation, and
 * offsets with seconds (`-04:56:02`, `-045602`).
 * Out-of-range fields yield an invalid Date; the 4-digit years 0000-0099 are literal; date-only
 * and zone-less strings use local wall time unless `utc` is true. Any other text after a signed
 * year, a `YYYY-M` date, or a time is invalid, except meridiem and zone tokens after a time
 * (`10:00 PM`, `10:00:00 UTC`, `10:00:00 +0000`), which go to engine parsing. Other non-ISO
 * strings of length 1..128 also go to engine parsing, where two-digit years follow the engine.
 * `utc` does not apply to engine parsing. Longer non-ISO input is invalid.
 * @param date The date value
 * @param utc When true, zone-less ISO strings are read as UTC
 * @returns The new date object
 */
export function asDate(date: string | number | Date | null | undefined, utc = false): Date {
  if (date === undefined) return new Date()
  if (typeof date === 'number') return new Date(date)
  if (typeof date !== 'string') return new Date(isDateBrand(date) ? date.getTime() : Number.NaN)

  const parsed = parseDateString(date.trim(), utc)
  if (parsed !== 'fallback') return parsed
  if (date.length === 0 || date.length > 128) return new Date(Number.NaN)
  return new Date(date)
}

const LOCALIZED_TOKEN_OPTIONS: Readonly<
  Record<
    'LT' | 'LTS' | 'L' | 'LL' | 'LLL' | 'LLLL' | 'l' | 'll' | 'lll' | 'llll',
    Intl.DateTimeFormatOptions
  >
> = Object.freeze({
  LT: { hour: 'numeric', minute: '2-digit' },
  LTS: { hour: 'numeric', minute: '2-digit', second: '2-digit' },
  L: { year: 'numeric', month: '2-digit', day: '2-digit' },
  LL: { year: 'numeric', month: 'long', day: 'numeric' },
  LLL: {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  },
  LLLL: {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric'
  },
  l: { year: 'numeric', month: 'numeric', day: 'numeric' },
  ll: { year: 'numeric', month: 'short', day: 'numeric' },
  lll: {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  },
  llll: {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric'
  }
})

function buildValues(
  date: Date,
  opts: ResolvedFormatOptions,
  pattern: string
): Map<string, () => string> {
  const { locales, utc } = opts
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
  const offset = () => zoneOffset(f, date)
  const intl = (fmtOpts: Intl.DateTimeFormatOptions) =>
    cachedFormatter(locales, fmtOpts, utc).format(date)

  return new Map<string, () => string>([
    ['H', () => String(h)],
    ['HH', () => pad2(h)],
    ['h', () => String(hour12(h))],
    ['hh', () => pad2(hour12(h))],
    ['k', () => String(kHour)],
    ['kk', () => pad2(kHour)],
    ['a', () => dayPeriod(opts, date).toLocaleLowerCase(locales)],
    ['A', () => dayPeriod(opts, date).toLocaleUpperCase(locales)],
    ['m', () => String(min)],
    ['mm', () => pad2(min)],
    ['s', () => String(sec)],
    ['ss', () => pad2(sec)],
    ['SSS', () => pad3(ms)],
    ['X', () => String(Math.floor(date.getTime() / 1000))],
    ['x', () => String(date.getTime())],
    ['YY', () => formatYearYY(year)],
    ['YYYY', () => formatYearYYYY(year)],
    ['M', () => String(month)],
    ['MM', () => pad2(month)],
    ['MMM', () => monthName(opts, date, 'short')],
    [
      'MMMM',
      () => (hasDayToken(pattern) ? monthNameWithDay(opts, date) : monthName(opts, date, 'long'))
    ],
    ['Q', () => String(Math.ceil(month / 3))],
    ['D', () => String(day)],
    ['Do', () => ordinalDay(day, locales)],
    ['DD', () => pad2(day)],
    ['d', () => String(dow)],
    ['E', () => String(isoDow)],
    ['ddd', () => partValue(opts, { weekday: 'short' }, date, 'weekday')],
    ['dddd', () => partValue(opts, { weekday: 'long' }, date, 'weekday')],
    ['N', () => eraName(opts, date, 'short')],
    ['NN', () => eraName(opts, date, 'short')],
    ['NNN', () => eraName(opts, date, 'short')],
    ['NNNN', () => eraName(opts, date, 'long')],
    [
      'Z',
      () => {
        const o = offset()
        return `${o.sign}${o.hh}:${o.mm}${o.ss && `:${o.ss}`}`
      }
    ],
    [
      'ZZ',
      () => {
        const o = offset()
        return `${o.sign}${o.hh}${o.mm}${o.ss}`
      }
    ],
    ['z', () => (utc ? 'UTC' : partValue(opts, { timeZoneName: 'short' }, date, 'timeZoneName'))],
    ['zzz', () => partValue(opts, { timeZoneName: 'long' }, date, 'timeZoneName')],
    ['LT', () => intl(LOCALIZED_TOKEN_OPTIONS.LT)],
    ['LTS', () => intl(LOCALIZED_TOKEN_OPTIONS.LTS)],
    ['L', () => intl(LOCALIZED_TOKEN_OPTIONS.L)],
    ['LL', () => intl(LOCALIZED_TOKEN_OPTIONS.LL)],
    ['LLL', () => intl(LOCALIZED_TOKEN_OPTIONS.LLL)],
    ['LLLL', () => intl(LOCALIZED_TOKEN_OPTIONS.LLLL)],
    ['l', () => intl(LOCALIZED_TOKEN_OPTIONS.l)],
    ['ll', () => intl(LOCALIZED_TOKEN_OPTIONS.ll)],
    ['lll', () => intl(LOCALIZED_TOKEN_OPTIONS.lll)],
    ['llll', () => intl(LOCALIZED_TOKEN_OPTIONS.llll)]
  ])
}

/** ISO pattern for `date`: years past 4 digits need the signed form to stay valid ISO 8601. */
function isoPattern(date: Date, utc: boolean): string {
  const year = utc ? date.getUTCFullYear() : date.getFullYear()
  if (year >= 0 && year <= 9999) return ISO_8601_PATTERN
  const expanded = `${year < 0 ? '-' : '+'}${String(Math.abs(year)).padStart(6, '0')}`
  return `[${expanded}]${ISO_8601_PATTERN.slice('YYYY'.length)}`
}

function memoized(getters: Map<string, () => string>): (token: string) => string | undefined {
  const seen = new Map<string, string>()
  return (token) => {
    const known = seen.get(token)
    if (known !== undefined) return known
    const value = getters.get(token)?.()
    if (value !== undefined) seen.set(token, value)
    return value
  }
}

/**
 * Returns a localized string representation of this date for the given format string.
 * Tokens are maximal runs of one ASCII letter, plus compound `Do` / `LT` / `LTS`.
 * Known tokens: `H HH h hh k kk a A m mm s ss SSS X x YY YYYY M MM MMM MMMM Q D DD Do d E ddd dddd N NN NNN NNNN Z ZZ z zzz L LL LLL LLLL l ll lll llll LT LTS`.
 * Unknown letter runs stay literal as a whole (`Y`, `YYY`, `dd`). `YYYY` is zero-padded to 4 digits (`0050`, `-0001`); `YY` is `|year| % 100` zero-padded to 2. Bracket text `[...]` is literal (unclosed `[` stays). Empty `formatStr` means `YYYY-MM-DDTHH:mm:ssZ`, with a signed 6-digit year (`+275760`, `-000001`) outside 0-9999, so {@link asDate} reads it back.
 * Numeric tokens and month and era names are Gregorian whatever the locale's calendar. `MMMM` takes the form the locale uses next to a day when the pattern has `D`, `DD`, or `Do` (`31 октября`), and the standalone form otherwise (`октябрь`). `LT`, `LTS`, `a`, `A`, and the `L` / `l` families follow the locale, including its hour cycle.
 * `Z` and `ZZ` add seconds for offsets that have them (`-04:56:02` for New York in 1800). With `utc: true`, UTC fields are read and `Z`/`ZZ`/`z` render `+00:00`/`+0000`/`UTC`. `Do` renders English ordinals only (other languages render the bare day number).
 * @param formatStr The format string to use
 * @param date The date value
 * @param localeOrOptions A locale (tag, `Intl.Locale`, or list), or a plain options object with `locale` and `utc`
 * @throws {RangeError} for an invalid locale tag, or one past 255 characters.
 * @example
```js
formatDate('MM/DD/YYYY', new Date(2022, 9, 31)) // '10/31/2022'
formatDate('Do MMMM', new Date(2022, 9, 1), 'en') // '1st October'
```
 */
export function formatDate(
  formatStr: string | undefined,
  date: Date,
  localeOrOptions?: Intl.LocalesArgument | FormatOptions
): string {
  const opts = resolveOptions(localeOrOptions)
  if (Number.isNaN(date.getTime())) {
    return 'Invalid Date'
  }

  const str = formatStr === undefined || formatStr === '' ? isoPattern(date, opts.utc) : formatStr
  const valueOf = memoized(buildValues(date, opts, str))
  const out = new PieceWriter()
  scanFormat(
    str,
    (text) => {
      out.write(text)
    },
    (token) => {
      out.write(valueOf(token) ?? token)
    }
  )
  return out.toString()
}

function strftimeValues(date: Date, opts: ResolvedFormatOptions): Map<string, () => string> {
  const { locales, utc } = opts
  const f = readFields(date, utc)
  const h = f.hour
  const min = f.minute
  const sec = f.second
  const month = f.month
  const day = f.day
  const year = f.year

  return new Map<string, () => string>([
    ['%A', () => partValue(opts, { weekday: 'long' }, date, 'weekday')],
    ['%a', () => partValue(opts, { weekday: 'short' }, date, 'weekday')],
    ['%d', () => pad2(day)],
    ['%-d', () => String(day)],
    ['%m', () => pad2(month)],
    ['%-m', () => String(month)],
    ['%B', () => monthName(opts, date, 'long')],
    ['%b', () => monthName(opts, date, 'short')],
    ['%bb', () => String(month)],
    ['%Y', () => formatYearYYYY(year)],
    ['%y', () => formatYearYY(year)],
    ['%N', () => eraName(opts, date, 'long')],
    ['%n', () => '\n'],
    ['%I', () => pad2(hour12(h))],
    ['%-I', () => String(hour12(h))],
    ['%H', () => pad2(h)],
    ['%-H', () => String(h)],
    ['%K', () => pad2(h % 12)],
    ['%k', () => String(h).padStart(2, ' ')],
    ['%M', () => pad2(min)],
    ['%-M', () => String(min)],
    ['%S', () => pad2(sec)],
    ['%-S', () => String(sec)],
    ['%p', () => dayPeriod(opts, date).toLocaleUpperCase(locales)],
    ['%P', () => dayPeriod(opts, date).toLocaleLowerCase(locales)],
    [
      '%z',
      () => {
        const o = zoneOffset(f, date)
        return `${o.sign}${o.hh}${o.mm}${o.ss}`
      }
    ],
    ['%Z', () => (utc ? 'UTC' : partValue(opts, { timeZoneName: 'short' }, date, 'timeZoneName'))]
  ])
}

/**
 * Formats a date using a formatting string in the {@link https://strftime.org/ strftime} format, in any given locale.
 * Directives: `%A %a %d %-d %m %-m %B %b %bb %Y %y %N %n %I %-I %H %-H %K %k %M %-M %S %-S %p %P %z %Z`, plus `%%` -> `%`.
 * `%Y` / `%y` match `YYYY` / `YY` (4-digit padded year / `|year| % 100`). `%k` is the hour 0-23, space-padded, `%K` the hour 0-11, zero-padded. `%n` is a newline, as in every strftime; `%N` is the long era, and `formatDate` has `N` for the short one. `%p` and `%P` are the locale's day period, upper- and lowercased. Month and era names are Gregorian, like the numeric directives. Unknown directives and a trailing `%` stay literal (`%Q` -> `%Q`); scanning resumes after a lone `%` for unknown forms.
 * `%z` adds seconds for offsets that have them. With `utc: true`, UTC fields are read and `%z`/`%Z` render `+0000`/`UTC`.
 * @param fmt The format string to apply
 * @param date The date value
 * @param localeOrOptions A locale (tag, `Intl.Locale`, or list; default is system locale), or a plain options object with `locale` and `utc`.
 * @returns The string representation of date
 * @throws {RangeError} for an invalid locale tag, or one past 255 characters.
 * @see {@link https://strftime.org/ strftime format}
 * @example
```js
strftime('%A, %d/%m/%y', new Date(2020, 1, 1), 'en-US')
// 'Saturday, 01/02/20'
```
 */
export function strftime(
  fmt: string,
  date: Date,
  localeOrOptions?: Intl.LocalesArgument | FormatOptions
): string {
  const opts = resolveOptions(localeOrOptions)
  if (Number.isNaN(date.getTime())) {
    return 'Invalid Date'
  }

  return scanStrftime(fmt, memoized(strftimeValues(date, opts)))
}
