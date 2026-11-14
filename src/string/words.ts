/**
 * Unicode-aware word splitting on `Intl.Segmenter` with identifier case rules.
 * @module
 */

import { isAsciiString, toText } from '../internal/text.ts'

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
/** Format characters the segmenter keeps inside a word, but that must not reach a slug or key. */
const IS_BIDI_CONTROL = /^[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]$/u
const IS_MARK_OR_FORMAT = /^[\p{M}\p{Cf}]$/u
const HAS_LETTER_OR_NUMBER = /[\p{L}\p{N}]/u
const ZWJ_EMOJI = /\u200D\p{ExtPict}/u
const RGI_EMOJI_AT = /\p{RGI_Emoji}/vy

const COMBINING_ENCLOSING_KEYCAP = 0x20e3

const ORDINAL_LOWER = new Set(['st', 'nd', 'rd', 'th'])
const ORDINAL_UPPER = new Set(['ST', 'ND', 'RD', 'TH'])

type CharClass = 'U' | 'L' | 'O' | 'D' | 'K' | 'A' | 'X'

function isAsciiDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39
}

function classifyAscii(cp: number): CharClass {
  if (cp >= 0x41 && cp <= 0x5a) return 'U'
  if (cp >= 0x61 && cp <= 0x7a) return 'L'
  if (isAsciiDigit(cp)) return 'D'
  if (cp === 0x27) return 'A'
  return 'X'
}

function classifyNonAscii(ch: string): CharClass {
  if (ch === '\u2019') return 'A'
  if (IS_UPPER.test(ch)) return 'U'
  if (IS_LOWER.test(ch)) return 'L'
  if (IS_OTHER_LETTER.test(ch)) return 'O'
  if (IS_NUMBER.test(ch)) return 'D'
  if (IS_BIDI_CONTROL.test(ch)) return 'X'
  if (IS_MARK_OR_FORMAT.test(ch)) return 'K'
  return 'X'
}

/** ASCII takes a few compares; only the regexp-based non-ASCII classes are worth caching. */
function classifyCp(cp: number, cache: Map<number, CharClass>): CharClass {
  if (cp < 0x80) return classifyAscii(cp)
  let cls = cache.get(cp)
  if (cls === undefined) {
    cls = classifyNonAscii(String.fromCodePoint(cp))
    cache.set(cp, cls)
  }
  return cls
}

/** The code point at UTF-16 index `i`, which the caller keeps below `s.length`. */
function codePointAt(s: string, i: number): number {
  return s.codePointAt(i) as number
}

/** The class of the code point at UTF-16 index `i`, or `undefined` past the end. */
function classAt(s: string, i: number, cache: Map<number, CharClass>): CharClass | undefined {
  return i < s.length ? classifyCp(codePointAt(s, i), cache) : undefined
}

function isLetter(cls: CharClass): boolean {
  return cls === 'U' || cls === 'L' || cls === 'O'
}

/** `IDs`, `APIs`: an `s` at `sIndex`, then the end, a non-letter or a new capital. */
function isPluralAcronym(s: string, sIndex: number, cache: Map<number, CharClass>): boolean {
  if (s[sIndex] !== 's') return false
  const afterCls = classAt(s, sIndex + 1, cache)
  return afterCls === undefined || !isLetter(afterCls) || afterCls === 'U'
}

/** `11th`, `1stPlace`, `1ST`: an ordinal suffix at `start`, then the end, a non-letter or a capital. */
function isOrdinalSuffix(s: string, start: number, cache: Map<number, CharClass>): boolean {
  const two = s.slice(start, start + 2)
  const lower = ORDINAL_LOWER.has(two)
  if (!lower && !ORDINAL_UPPER.has(two)) return false
  const afterCls = classAt(s, start + 2, cache)
  return afterCls === undefined || !isLetter(afterCls) || (afterCls === 'U' && lower)
}

/** A camel boundary right after a mid-word apostrophe strands it; it belongs to neither word. */
function endBeforeApostrophe(s: string, end: number): number {
  const last = s[end - 1]
  return last === "'" || last === '\u2019' ? end - 1 : end
}

/**
 * Splits one word-like run at case and letter-digit changes, keeping ordinals, plural acronyms
 * and digit keycaps whole. Walks UTF-16 indices, so it allocates only the words.
 */
function splitRun(s: string, cache: Map<number, CharClass>): string[] {
  const out: string[] = []
  let wordStart = -1
  let prev: CharClass | undefined
  let prevStart = -1
  let i = 0

  const flush = (end: number): void => {
    if (wordStart >= 0 && end > wordStart) out.push(s.slice(wordStart, end))
    wordStart = -1
    prev = undefined
  }

  while (i < s.length) {
    const cp = codePointAt(s, i)
    const end = i + (cp > 0xffff ? 2 : 1)
    const cls = classifyCp(cp, cache)

    if (cls === 'K') {
      if (
        cp === COMBINING_ENCLOSING_KEYCAP &&
        prev === 'D' &&
        isAsciiDigit(s.charCodeAt(prevStart))
      ) {
        // The segmenter puts `1️⃣2️⃣` in one Numeric segment; each keycap is its own word.
        flush(prevStart)
        out.push(s.slice(prevStart, end))
      }
      // A mark extends the current word; after a flush it has no word to attach to and is dropped.
      i = end
      continue
    }
    if (cls === 'X') {
      flush(i)
      i = end
      continue
    }
    if (cls === 'A') {
      const nextCls = classAt(s, end, cache)
      // Mid-word apostrophe: wordStart is already set whenever prev is a letter.
      if (!(prev !== undefined && isLetter(prev) && nextCls !== undefined && isLetter(nextCls))) {
        flush(i)
      }
      i = end
      continue
    }

    let boundary = false
    if (prev !== undefined) {
      if ((prev === 'L' || prev === 'O') && cls === 'U') {
        boundary = true
      } else if (prev === 'U' && cls === 'U') {
        boundary = classAt(s, end, cache) === 'L' && !isPluralAcronym(s, end, cache)
      } else if (isLetter(prev) && cls === 'D') {
        boundary = true
      } else if (prev === 'D' && isLetter(cls)) {
        boundary = !isOrdinalSuffix(s, i, cache)
      }
    }

    if (boundary) flush(endBeforeApostrophe(s, i))
    if (wordStart < 0) wordStart = i
    prev = cls
    prevStart = i
    i = end
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
    for (const part of splitRun(run, cache)) out.push(part)
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
 * Splits a string into words. Without `pattern`, it uses `Intl.Segmenter` word boundaries plus
 * identifier case rules: `fooBar` and `HTTPServer` split at case changes, ordinals (`11th`) and
 * plural acronyms (`IDs`) stay whole, digits split from letters, emoji stay whole, and bidi
 * controls separate words. With a `pattern`, every match of it is a word, even when the pattern
 * is not global, and capture groups are ignored; lodash returns only the first match and its
 * groups for a non-global pattern. A `null` pattern means no pattern, where lodash matches
 * `'null'`. `null` and `undefined` read as `''`, and other values go through `String`.
 * @param s The string to split.
 * @param pattern A regular expression that matches each word.
 * @throws {TypeError} When `pattern` is neither a `RegExp` nor `null` or `undefined`.
 * @returns The words, in order.
 * @example
 * ```ts
 * words('fooBar_baz qux') // ['foo', 'Bar', 'baz', 'qux']
 * words('HTTPServer2xx') // ['HTTP', 'Server', '2', 'xx']
 * words('fred, barney, & pebbles', /[^, ]+/g) // ['fred', 'barney', '&', 'pebbles']
 * ```
 */
export function words(s: unknown, pattern?: RegExp | null): string[] {
  const text = toText(s)
  if (pattern != null) {
    if (!(pattern instanceof RegExp)) throw new TypeError('words expects pattern to be a RegExp')
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
    return Array.from(text.matchAll(new RegExp(pattern.source, flags)), (match) => match[0])
  }
  // On ASCII the segmenter breaks only where splitRun splits too, so ASCII text skips it.
  return isAsciiString(text) ? splitRun(text, new Map()) : fromSegments(text)
}
