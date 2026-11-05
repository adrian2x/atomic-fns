/**
 * This module includes utilities for working with strings.
 *
 * Input follows Lodash: `null` and `undefined` become `''`, and other values go through `String`.
 * The predicates {@link isAlnum}, {@link isAlpha} and {@link isNumeric} are `false` for non-strings.
 *
 * @module string
 */

import {
  camelCase as camelCaseWords,
  isAsciiString,
  join as joinWords,
  kebabCase as kebabCaseWords,
  pascalCase as pascalCaseWords,
  snakeCase as snakeCaseWords,
  toText,
  words as splitWords
} from './words.js'

function firstCodePoint(s: string): { first: string; rest: string } {
  const [first = ''] = s
  return { first, rest: s.slice(first.length) }
}

/**
 * Converts only the first code point of the given string to upper case. The rest is preserved.
 * @param s The string
 * @returns The sentence-cased string.
 * @example
```js
sentenceCase('a test')
// 'A test'

sentenceCase('TEST')
// 'TEST'
```
 * @see {@link capitalize}
 */
export function sentenceCase(s: unknown): string {
  const { first, rest } = firstCodePoint(toText(s))
  return `${first.toLocaleUpperCase()}${rest}`
}

/** Unicode titlecase forms, keyed by lowercase, that no uppercase rule can derive. */
const TITLECASE_FIRST: Readonly<Record<string, string>> = Object.freeze({
  '\u0149': '\u02BCN',
  '\u01C6': '\u01C5',
  '\u01C9': '\u01C8',
  '\u01CC': '\u01CB',
  '\u01F3': '\u01F2',
  '\u1F80': '\u1F88',
  '\u1F81': '\u1F89',
  '\u1F82': '\u1F8A',
  '\u1F83': '\u1F8B',
  '\u1F84': '\u1F8C',
  '\u1F85': '\u1F8D',
  '\u1F86': '\u1F8E',
  '\u1F87': '\u1F8F',
  '\u1F90': '\u1F98',
  '\u1F91': '\u1F99',
  '\u1F92': '\u1F9A',
  '\u1F93': '\u1F9B',
  '\u1F94': '\u1F9C',
  '\u1F95': '\u1F9D',
  '\u1F96': '\u1F9E',
  '\u1F97': '\u1F9F',
  '\u1FA0': '\u1FA8',
  '\u1FA1': '\u1FA9',
  '\u1FA2': '\u1FAA',
  '\u1FA3': '\u1FAB',
  '\u1FA4': '\u1FAC',
  '\u1FA5': '\u1FAD',
  '\u1FA6': '\u1FAE',
  '\u1FA7': '\u1FAF',
  '\u1FB2': '\u1FBA\u0345',
  '\u1FB3': '\u1FBC',
  '\u1FB4': '\u0386\u0345',
  '\u1FB7': '\u0391\u0342\u0345',
  '\u1FC2': '\u1FCA\u0345',
  '\u1FC3': '\u1FCC',
  '\u1FC4': '\u0389\u0345',
  '\u1FC7': '\u0397\u0342\u0345',
  '\u1FF2': '\u1FFA\u0345',
  '\u1FF3': '\u1FFC',
  '\u1FF4': '\u038F\u0345',
  '\u1FF7': '\u03A9\u0342\u0345'
})

/** Georgian Mkhedruli has an uppercase (Mtavruli), but a letter's titlecase is itself. */
const IS_MKHEDRULI = /^[\u10D0-\u10FF]$/

function titleCaseFirstChar(ch: string): string {
  if (IS_MKHEDRULI.test(ch)) return ch
  const upper = ch.toLocaleUpperCase()
  // Multi-char uppercase (e.g. ß -> SS): titlecase is first upper + rest lower.
  const derived = upper.length > 1 ? upper[0] + upper.slice(1).toLocaleLowerCase() : upper
  return TITLECASE_FIRST[ch.toLocaleLowerCase()] ?? derived
}

/**
 * Converts the first code point of the given string to Unicode title case and the rest to lower case.
 * Digraphs use titlecase mapping (`ǆ` -> `ǅ`, not `Ǆ`).
 * @param s The string to capitalize
 * @returns The capitalized string.
 * @example
```js
capitalize('TEST')
// 'Test'
```
 * @see {@link titleCase}
 */
export function capitalize(s: unknown): string {
  const text = toText(s)
  const { first } = firstCodePoint(text)
  // Lowercasing the whole string lets a final sigma see the letter before it.
  const rest = text.toLocaleLowerCase().slice(first.toLocaleLowerCase().length)
  return `${titleCaseFirstChar(first)}${rest}`
}

/**
 * Split a string into an array of its words.
 * Without `pattern`, uses `Intl.Segmenter` word granularity plus Unicode letter/digit,
 * ordinal (`11th`), plural-acronym (`IDs`), and RGI emoji rules. Format characters
 * (ZWNJ, soft hyphen) stay inside words. With `pattern`, treats it as a separator
 * (`String.prototype.split`); empty pieces are dropped. A user `RegExp` is the caller's
 * responsibility (capture groups appear in the output per `split`). A `null` pattern is no pattern.
 * @param s The string to split
 * @param pattern Optional separator (`string` or `RegExp`)
 * @returns The words array.
 * @example
```js
words('lord of the rings')
// ['lord', 'of', 'the', 'rings']

words('XMLHttpRequest')
// ['XML', 'Http', 'Request']

words('equipment0class0name', '0')
// ['equipment', 'class', 'name']
```
 */
export function words(s: unknown, pattern?: RegExp | string | null): string[] {
  return splitWords(s, pattern)
}

/**
 * Create a new string which is the concatenation of the words in the given input.
 * @param s The string to join
 * @param sep The separator to use
 * @returns The joined string.
 * @example
```js
join('Lord Of The Rings', '-')
// 'Lord-Of-The-Rings'
```
 */
export function join(s: unknown, sep = ' '): string {
  return joinWords(s, sep)
}

/** Searches for a disallowed character: `^[...]+$` overflows the regexp stack on long input. */
function hasOnly(s: unknown, disallowed: RegExp): boolean {
  return typeof s === 'string' && s !== '' && !disallowed.test(s)
}

/**
 * Checks if a string contains only alphanumeric characters.
 * @param s The string
 * @returns `true` if the string contains only alphanumeric.
 * @example
```js
isAlnum('alpha1234')
// true

isAlnum('oops!')
// false
```
 */
export function isAlnum(s: unknown): boolean {
  return hasOnly(s, /[^\p{L}\p{N}]/u)
}

/**
 * Checks if a string contains only alphabetic characters.
 * @param s The string
 * @returns `true` if the string contains only alphabetic.
 * @example
```js
isAlpha('alpha1234')
// false

isAlpha('letters')
// true
```
 */
export function isAlpha(s: unknown): boolean {
  return hasOnly(s, /\P{L}/u)
}

/**
 * Unicode number check: every character is in `\p{N}`, so `'²'`, `'½'`, fullwidth and
 * Arabic-Indic digits are numeric. CJK numerals such as `'一'` are letters here, unlike Python
 * `str.isnumeric`. This is not a guard for `Number()` / `parseFloat` parsing.
 * @param s The string
 * @returns `true` if the string contains only Unicode numeric characters.
 * @example
```js
isNumeric('alpha1234')
// false

isNumeric('1234')
// true
```
 */
export function isNumeric(s: unknown): boolean {
  return hasOnly(s, /\P{N}/u)
}

/**
 * Returns a new string with only valid ASCII characters.
 * @param s The string
 * @returns The ASCII characters in the given string
 * @example
```js
asciify('äÄçÇéÉêPHP-MySQLöÖÐþúÚ')
// 'PHP-MySQL'
```
 */
export function asciify(s: unknown): string {
  return toText(s).replace(/[\u0080-\uFFFF]+/g, '')
}

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
  '\u017F': 's'
})

/** A mark after 30 others, the UAX #15 Stream-Safe limit that keeps `normalize` linear. */
const EXCESS_MARK = /\p{M}(?<=\p{M}{31})/gu
const MARK_AFTER_LATIN = /\p{Mn}(?<=[\p{Script=Latin}0-9]\p{Mn}+)/gu
const FOLDABLE_LETTER = /[\u00C6-\u017F]/g

/**
 * Applies a subset of the Unicode CLDR Latin-ASCII transform: Latin marks and the common Latin
 * letter folds. Other CLDR rules (`ƒ`, `ǆ`, `©`, fullwidth forms) are not applied, and a run of
 * marks is cut to 30.
 * @param s The string
 * @returns The folded string
 * @example
```js
removeAccents('Antoine de Saint-Exupéry')
// 'Antoine de Saint-Exupery'
```
 */
export function removeAccents(s: unknown): string {
  const text = toText(s)
  if (isAsciiString(text)) return text
  return text
    .replace(EXCESS_MARK, '')
    .normalize('NFD')
    .replace(MARK_AFTER_LATIN, '')
    .normalize('NFC')
    .replace(FOLDABLE_LETTER, (ch) => CLDR_LATIN_ASCII_FOLDS[ch] ?? ch)
}

/**
 * Applies the Unicode titlecase mapping to the first letter of every word in place, keeping the
 * rest of each word and punctuation/spacing as-is (`NASA` stays `NASA`).
 * @param s The string to capitalize
 * @returns The title cased string.
 * @example
```js
titleCase('lord of the rings')
// 'Lord Of The Rings'
```
@see {@link capitalize}
 */
export function titleCase(s: unknown): string {
  const text = toText(s)
  let remaining = text
  let out = ''
  for (const word of words(text)) {
    const idx = remaining.indexOf(word)
    if (idx < 0) {
      out += remaining
      remaining = ''
      break
    }
    const { first, rest } = firstCodePoint(word)
    out += remaining.slice(0, idx) + titleCaseFirstChar(first) + rest
    remaining = remaining.slice(idx + word.length)
  }
  return out + remaining
}

/**
 * Converts the string to camel case. Apostrophes are removed from parts.
 * Later parts use `toUpperCase` on the first code point (not Unicode titlecase),
 * so digraphs follow the uppercase mapping (`pascalCase('ǆemal') === 'Ǆemal'`).
 * Accents stay, unlike Lodash; call {@link removeAccents} first to drop them. The same goes for
 * {@link pascalCase}, {@link snakeCase} and {@link kebabCase}.
 * @param s The string to convert
 * @returns The camel cased string.
 * @example
```js
camelCase('Equipment class name')
// 'equipmentClassName'

camelCase("don't stop")
// 'dontStop'
```
 */
export function camelCase(s: unknown): string {
  return camelCaseWords(s)
}

/**
 * Converts the string to Pascal case. Apostrophes are removed from parts.
 * Uses `toUpperCase` on each part's first code point (not Unicode titlecase).
 * @param s The string to convert
 * @returns The Pascal cased string.
 * @example
```js
pascalCase('equipment class name')
// 'EquipmentClassName'

pascalCase('ǆemal')
// 'Ǆemal'
```
 */
export function pascalCase(s: unknown): string {
  return pascalCaseWords(s)
}

/**
 * Converts the string to snake case. Apostrophes are removed from parts.
 * @param s The string to convert
 * @returns The snake cased string.
 * @example
```js
snakeCase('Equipment Class Name')
// 'equipment_class_name'
```
 */
export function snakeCase(s: unknown): string {
  return snakeCaseWords(s)
}

/**
 * Converts a string to kebab case. Apostrophes are removed from parts.
 * @param s The string
 * @returns The kebab cased string.
 * @example
```js
kebabCase('Equipment Class Name')
// 'equipment-class-name'

kebabCase('equipment_class_name')
// 'equipment-class-name'
```
 */
export function kebabCase(s: unknown): string {
  return kebabCaseWords(s)
}

/** Bounded so a long two-byte run cannot overflow the regexp stack; `-+` merges the chunks. */
const SEPARATORS = /[^\p{L}\p{M}\p{N}]{1,1024}/gu
const ORPHAN_MARKS = /(^|-)\p{M}+/gu

/**
 * Returns a url-safe slug for the given string. Applies {@link removeAccents} (Latin-only),
 * then joins runs of Unicode letters, marks and digits with `-`. Non-Latin letters and their
 * marks are preserved.
 * @param s The string
 * @returns A slug version of the string
 * @example
```js
slugify('Antoine de Saint-Exupéry')
// 'Antoine-de-Saint-Exupery'
```
 */
export function slugify(s: unknown): string {
  return removeAccents(s)
    .replace(SEPARATORS, '-')
    .replace(ORPHAN_MARKS, '$1')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
