import { isAsciiString, toText } from '../internal/text.ts'

/** Letter folds from a subset of the Unicode CLDR Latin-ASCII transform. */
const CLDR_LATIN_ASCII_FOLDS: Readonly<Record<string, string>> = Object.freeze({
  '\u00C6': 'AE',
  '\u00D0': 'D',
  '\u00D8': 'O',
  '\u00DE': 'TH',
  '\u00DF': 'ss',
  '\u00E6': 'ae',
  '\u00F0': 'd',
  '\u00F8': 'o',
  '\u00FE': 'th',
  '\u0110': 'D',
  '\u0111': 'd',
  '\u0126': 'H',
  '\u0127': 'h',
  '\u0131': 'i',
  '\u0132': 'IJ',
  '\u0133': 'ij',
  '\u0138': 'q',
  '\u013F': 'L',
  '\u0140': 'l',
  '\u0141': 'L',
  '\u0142': 'l',
  '\u0149': "'n",
  '\u014A': 'N',
  '\u014B': 'n',
  '\u0152': 'OE',
  '\u0153': 'oe',
  '\u0166': 'T',
  '\u0167': 't',
  '\u017F': 's',
  '\u1E9E': 'SS'
})

/**
 * A run of more than 30 marks, past the UAX #15 Stream-Safe limit that keeps `normalize` linear.
 * Matched from the start of the run only, so each mark is read once.
 */
const EXCESS_MARKS = /(?<!\p{M})(\p{M}{30})\p{M}+/gu
/** One forward pass, so a long run of marks after another script is never rescanned. */
const MARK_RUN_AFTER_LATIN = /(?<=[\p{Script=Latin}0-9])\p{Mn}+/gu
/** Variation selectors are Mn but pick a presentation, such as VS16 in the keycap `1️⃣`. */
const NOT_VARIATION_SELECTOR = /\P{Variation_Selector}/gu
const FOLDABLE_LETTER = /[\u00C6-\u017F\u1E9E]/g

/**
 * Removes accents from Latin letters with a subset of the Unicode CLDR Latin-ASCII transform:
 * combining marks after Latin letters and digits, and the common letter folds (`ß` to `ss`,
 * `Æ` to `AE`, `ø` to `o`). Marks on other scripts and variation selectors stay (`й`, `が`,
 * `1️⃣`), the result is NFC, and a run of marks is cut to 30 so normalizing stays linear.
 * @param s The string to fold.
 * @returns The folded string.
 * @example
 * ```ts
 * deburr('déjà vu') // 'deja vu'
 * deburr('Œuvre ß ø') // 'OEuvre ss o'
 * ```
 */
export function deburr(s: unknown): string {
  const text = toText(s)
  if (isAsciiString(text)) return text
  return text
    .replace(EXCESS_MARKS, '$1')
    .normalize('NFD')
    .replace(MARK_RUN_AFTER_LATIN, (marks) => marks.replace(NOT_VARIATION_SELECTOR, ''))
    .normalize('NFC')
    .replace(FOLDABLE_LETTER, (ch) => CLDR_LATIN_ASCII_FOLDS[ch] ?? ch)
}

/** Bounded so a long two-byte run cannot overflow the regexp stack; `-+` merges the chunks. */
const SEPARATORS = /[^\p{L}\p{M}\p{N}]{1,1024}/gu
/** Invisible, so dropped as UTS #46 drops them: no word splits on one and no slug hides one. */
const DEFAULT_IGNORABLE = /\p{Default_Ignorable_Code_Point}/gu
/** Mark runs are cut to 30 by {@link deburr}, so the lookbehind stays bounded. */
const MID_WORD_APOSTROPHE = /(?<=[\p{L}\p{N}]\p{M}*)['\u2019](?=[\p{L}\p{N}])/gu
const ORPHAN_MARKS = /(^|-)\p{M}+/gu

/** Options for {@link slugify}. */
export interface SlugifyOptions {
  /** Lowercase the slug (default `true`); `false` keeps the case of the input. */
  lower?: boolean
}

/**
 * Returns a URL slug: {@link deburr}, lowercased unless `lower` is `false`, default-ignorable
 * code points (soft hyphen, ZWNJ, variation selectors, Hangul fillers) and apostrophes inside
 * words dropped, then runs of Unicode letters, marks and digits joined with `-`. Letters of other
 * scripts stay.
 * @param s The string to slugify.
 * @param options `lower`.
 * @returns The slug.
 * @example
 * ```ts
 * slugify('Antoine de Saint-Exupéry') // 'antoine-de-saint-exupery'
 * slugify("Don't Stop", { lower: false }) // 'Dont-Stop'
 * slugify('Café Привет') // 'cafe-привет'
 * ```
 */
export function slugify(s: unknown, options?: SlugifyOptions): string {
  const folded = deburr(s)
  return (options?.lower === false ? folded : folded.toLowerCase())
    .replace(DEFAULT_IGNORABLE, '')
    .replace(MID_WORD_APOSTROPHE, '')
    .replace(SEPARATORS, '-')
    .replace(ORPHAN_MARKS, '$1')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
