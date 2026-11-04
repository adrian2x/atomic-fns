/**
 * Unicode-aware word splitting via Intl.Segmenter and identifier case rules.
 *
 * @module
 */

import { notNull } from '../globals/index.js'

/** Lazy: Intl.Segmenter at module load fails where Intl is incomplete. */
let wordSegmenter: Intl.Segmenter | undefined

function getWordSegmenter(): Intl.Segmenter {
  wordSegmenter ??= new Intl.Segmenter(undefined, { granularity: 'word' })
  return wordSegmenter
}

const IS_UPPER = /^[\p{Lu}\p{Lt}]$/u
const IS_LOWER = /^\p{Ll}$/u
const IS_OTHER_LETTER = /^[\p{Lo}\p{Lm}]$/u
const IS_NUMBER = /^\p{N}$/u
const IS_MARK_OR_FORMAT = /^[\p{M}\p{Cf}]$/u
const HAS_LETTER_OR_NUMBER = /[\p{L}\p{N}]/u
const ZWJ_EMOJI = /\u200D\p{ExtPict}/u
// RegExp constructor: the `v` flag needs a runtime engine; TS target is ES2023.
const RGI_EMOJI_AT = new RegExp('\\p{RGI_Emoji}', 'vy')

const ORDINAL_LOWER = new Set(['st', 'nd', 'rd', 'th'])
const ORDINAL_UPPER = new Set(['ST', 'ND', 'RD', 'TH'])

type CharClass = 'U' | 'L' | 'O' | 'D' | 'K' | 'A' | 'X'

interface CpRef {
  readonly cp: number
  readonly ch: string
  readonly end: number
}

/** Lodash `toString`: `null` and `undefined` become `''`, anything else goes through `String`. */
export function toText(value: unknown): string {
  return notNull(value) ? String(value) : ''
}

export function isAsciiString(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0x7f) return false
  }
  return true
}

function classifyAscii(cp: number): CharClass {
  if (cp >= 0x41 && cp <= 0x5a) return 'U'
  if (cp >= 0x61 && cp <= 0x7a) return 'L'
  if (cp >= 0x30 && cp <= 0x39) return 'D'
  if (cp === 0x27) return 'A'
  return 'X'
}

function classifyNonAscii(ch: string): CharClass {
  if (ch === '\u2019') return 'A'
  if (IS_UPPER.test(ch)) return 'U'
  if (IS_LOWER.test(ch)) return 'L'
  if (IS_OTHER_LETTER.test(ch)) return 'O'
  if (IS_NUMBER.test(ch)) return 'D'
  if (IS_MARK_OR_FORMAT.test(ch)) return 'K'
  return 'X'
}

function classifyCp(cp: number, ch: string, cache: Map<number, CharClass>): CharClass {
  let cls = cache.get(cp)
  if (cls !== undefined) return cls
  cls = cp < 0x80 ? classifyAscii(cp) : classifyNonAscii(ch)
  cache.set(cp, cls)
  return cls
}

function isLetter(cls: CharClass): boolean {
  return cls === 'U' || cls === 'L' || cls === 'O'
}

function readCp(s: string, i: number): CpRef | undefined {
  if (i >= s.length) return undefined
  const cp = s.codePointAt(i)
  // codePointAt is defined for every in-range index of a JS string
  if (cp === undefined) return undefined
  const ch = String.fromCodePoint(cp)
  return { cp, ch, end: i + ch.length }
}

function isPluralAcronym(s: string, afterUpperEnd: number, cache: Map<number, CharClass>): boolean {
  const next = readCp(s, afterUpperEnd)
  if (next?.ch !== 's') return false
  const after = readCp(s, next.end)
  if (after === undefined) return true
  const afterCls = classifyCp(after.cp, after.ch, cache)
  return !isLetter(afterCls) || afterCls === 'U'
}

function isOrdinalSuffix(s: string, start: number, cache: Map<number, CharClass>): boolean {
  // Called only while splitRun is on a letter code point, so start is in range.
  const a = readCp(s, start)
  if (a === undefined) return false
  const b = readCp(s, a.end)
  if (b === undefined) return false
  const two = a.ch + b.ch
  const lower = ORDINAL_LOWER.has(two)
  const upper = ORDINAL_UPPER.has(two)
  if (!lower && !upper) return false
  const after = readCp(s, b.end)
  if (after === undefined) return true
  const afterCls = classifyCp(after.cp, after.ch, cache)
  if (!isLetter(afterCls)) return true
  return afterCls === 'U' && lower
}

/** A camel boundary right after a mid-word apostrophe strands it; it belongs to neither word. */
function endBeforeApostrophe(s: string, end: number): number {
  const last = s[end - 1]
  return last === "'" || last === '\u2019' ? end - 1 : end
}

/** ASCII-only splitter: charCodeAt + slice, no codePointAt / Map. */
function splitRunAscii(s: string): string[] {
  const out: string[] = []
  const n = s.length
  let wordStart = -1
  let prev: CharClass | undefined

  const flush = (end: number): void => {
    if (wordStart >= 0 && end > wordStart) out.push(s.slice(wordStart, end))
    wordStart = -1
    prev = undefined
  }

  const classAt = (j: number): CharClass | undefined =>
    j < n ? classifyAscii(s.charCodeAt(j)) : undefined

  for (let i = 0; i < n; i++) {
    const cls = classifyAscii(s.charCodeAt(i))

    if (cls === 'X') {
      flush(i)
      continue
    }
    if (cls === 'A') {
      const nextCls = classAt(i + 1)
      // Mid-word apostrophe: wordStart is already set whenever prev is a letter.
      if (!(prev !== undefined && isLetter(prev) && nextCls !== undefined && isLetter(nextCls))) {
        flush(i)
      }
      continue
    }

    let boundary = false
    if (prev !== undefined) {
      if ((prev === 'L' || prev === 'O') && cls === 'U') boundary = true
      else if (prev === 'U' && cls === 'U') {
        const nextCls = classAt(i + 1)
        if (nextCls === 'L') {
          // Plural acronym: next is `s` and after is absent / non-letter / U
          const nextCh = s[i + 1]
          if (nextCh !== 's') {
            boundary = true
          } else {
            const afterCls = classAt(i + 2)
            if (afterCls !== undefined && isLetter(afterCls) && afterCls !== 'U') boundary = true
          }
        }
      } else if (isLetter(prev) && cls === 'D') boundary = true
      else if (prev === 'D' && isLetter(cls)) {
        const a = s[i]
        const b = i + 1 < n ? s[i + 1] : undefined
        if (b !== undefined) {
          const two = a + b
          const lower = ORDINAL_LOWER.has(two)
          const upper = ORDINAL_UPPER.has(two)
          if (lower || upper) {
            const afterCls = classAt(i + 2)
            const ordinal =
              afterCls === undefined || !isLetter(afterCls) || (afterCls === 'U' && lower)
            if (!ordinal) boundary = true
          } else {
            boundary = true
          }
        } else {
          boundary = true
        }
      }
    }

    if (boundary) flush(endBeforeApostrophe(s, i))
    if (wordStart < 0) wordStart = i
    prev = cls
  }
  flush(n)
  return out
}

/** Split one word-like run by walking UTF-16 indices (no intermediate code-point array). */
function splitRun(s: string, cache: Map<number, CharClass>): string[] {
  const out: string[] = []
  let wordStart = -1
  let prev: CharClass | undefined
  let i = 0

  const flush = (end: number): void => {
    if (wordStart >= 0 && end > wordStart) out.push(s.slice(wordStart, end))
    wordStart = -1
    prev = undefined
  }

  while (i < s.length) {
    const cur = readCp(s, i)
    if (cur === undefined) break
    const cls = classifyCp(cur.cp, cur.ch, cache)

    if (cls === 'K') {
      // Segmenter word-like runs do not start with marks/format; wordStart is already set.
      i = cur.end
      continue
    }
    if (cls === 'X') {
      flush(i)
      i = cur.end
      continue
    }
    if (cls === 'A') {
      const next = readCp(s, cur.end)
      // Mid-word apostrophe: wordStart is already set whenever prev is a letter.
      if (!(
        prev !== undefined &&
        isLetter(prev) &&
        next !== undefined &&
        isLetter(classifyCp(next.cp, next.ch, cache))
      )) {
        flush(i)
      }
      i = cur.end
      continue
    }

    let boundary = false
    if (prev !== undefined) {
      if ((prev === 'L' || prev === 'O') && cls === 'U') {
        boundary = true
      } else if (prev === 'U' && cls === 'U') {
        const next = readCp(s, cur.end)
        if (
          next !== undefined &&
          classifyCp(next.cp, next.ch, cache) === 'L' &&
          !isPluralAcronym(s, cur.end, cache)
        ) {
          boundary = true
        }
      } else if (isLetter(prev) && cls === 'D') {
        boundary = true
      } else if (prev === 'D' && isLetter(cls) && !isOrdinalSuffix(s, i, cache)) {
        boundary = true
      }
    }

    if (boundary) flush(endBeforeApostrophe(s, i))
    if (wordStart < 0) wordStart = i
    prev = cls
    i = cur.end
  }
  flush(s.length)
  return out
}

/** Steps one emoji at a time: `\p{RGI_Emoji}+` overflows the regexp stack on a long segment. */
function isRgiEmojiRun(s: string): boolean {
  RGI_EMOJI_AT.lastIndex = 0
  while (RGI_EMOJI_AT.lastIndex < s.length) {
    if (!RGI_EMOJI_AT.test(s)) return false
  }
  return true
}

function fromSegments(s: string): string[] {
  const out: string[] = []
  const cache = new Map<number, CharClass>()

  const pushWords = (run: string): void => {
    const parts = isAsciiString(run) ? splitRunAscii(run) : splitRun(run, cache)
    for (const part of parts) out.push(part)
  }

  const pushEmoji = (run: string): void => {
    if (isRgiEmojiRun(run)) out.push(run)
  }

  const pushNonWord = (segment: string): void => {
    if (!HAS_LETTER_OR_NUMBER.test(segment)) {
      pushEmoji(segment)
      return
    }
    // ICU glues `word ZWJ emoji` into one segment and calls it non-word-like.
    const glue = segment.search(ZWJ_EMOJI)
    pushWords(glue < 0 ? segment : segment.slice(0, glue))
    if (glue >= 0) pushEmoji(segment.slice(glue + 1))
  }

  for (const { segment, isWordLike } of getWordSegmenter().segment(s)) {
    if (isWordLike) pushWords(segment)
    else if (segment.length > 1 || segment.charCodeAt(0) > 0x7f) pushNonWord(segment)
  }
  return out
}

/** Word extraction forced through Intl.Segmenter, for path-equivalence tests. */
export { fromSegments as segmenterWords }

/**
 * Split a value into words; non-strings convert through {@link toText}.
 * Without `pattern`, uses Unicode word segmentation plus identifier-case rules.
 * With `pattern`, treats it as a separator (`String.prototype.split`); empty pieces are dropped.
 */
export function words(s: unknown, pattern?: RegExp | string | null): string[] {
  const text = toText(s)
  if (pattern != null) {
    return text.split(pattern).filter((w) => w !== '')
  }
  return isAsciiString(text) ? splitRunAscii(text) : fromSegments(text)
}

function toParts(s: unknown): string[] {
  return words(s)
    .map((w) => w.replace(/['\u2019]/g, ''))
    .filter((w) => w !== '')
}

function upperFirstLowerRest(part: string): string {
  const [first = ''] = part
  return first.toUpperCase() + part.toLowerCase().slice(first.toLowerCase().length)
}

/** Join the words of `s` with `sep`. */
export function join(s: unknown, sep = ' '): string {
  return words(s).join(sep)
}

/** Convert `s` to camelCase (apostrophes stripped; first code point uppercased with `toUpperCase`). */
export function camelCase(s: unknown): string {
  const parts = toParts(s)
  if (parts.length === 0) return ''
  let out = parts[0].toLowerCase()
  for (let i = 1; i < parts.length; i++) {
    out += upperFirstLowerRest(parts[i])
  }
  return out
}

/** Convert `s` to PascalCase (apostrophes stripped; `toUpperCase` on each part's first code point). */
export function pascalCase(s: unknown): string {
  return toParts(s).map(upperFirstLowerRest).join('')
}

/** Convert `s` to snake_case (apostrophes stripped). */
export function snakeCase(s: unknown): string {
  return toParts(s)
    .map((w) => w.toLowerCase())
    .join('_')
}

/** Convert `s` to kebab-case (apostrophes stripped). */
export function kebabCase(s: unknown): string {
  return toParts(s)
    .map((w) => w.toLowerCase())
    .join('-')
}
