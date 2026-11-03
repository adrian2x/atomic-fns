/**
 * This module includes utilities for working with strings.
 *
 * @module string
 */

import {
  camelCase as camelCaseWords,
  join as joinWords,
  kebabCase as kebabCaseWords,
  pascalCase as pascalCaseWords,
  snakeCase as snakeCaseWords,
  words as splitWords
} from './words.js'

function firstCodePoint(s: string): { first: string; rest: string } {
  if (!s) return { first: '', rest: '' }
  const cp = s.codePointAt(0)
  if (cp === undefined) return { first: '', rest: '' }
  const first = String.fromCodePoint(cp)
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
export function sentenceCase(s: string): string {
  const { first, rest } = firstCodePoint(s)
  return `${first.toLocaleUpperCase()}${rest}`
}

/** Unicode titlecase forms that differ from uppercase (Latin digraphs). */
const TITLECASE_FIRST: Record<string, string> = {
  ǆ: 'ǅ',
  Ǆ: 'ǅ',
  ǉ: 'ǈ',
  Ǉ: 'ǈ',
  ǌ: 'ǋ',
  Ǌ: 'ǋ'
}

function titleCaseFirstChar(ch: string): string {
  if (Object.hasOwn(TITLECASE_FIRST, ch)) return TITLECASE_FIRST[ch]
  const upper = ch.toLocaleUpperCase()
  // Multi-char uppercase (e.g. ß -> SS): titlecase is first upper + rest lower.
  if (upper.length > 1) return upper[0] + upper.slice(1).toLocaleLowerCase()
  return upper
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
export function capitalize(s: string): string {
  const { first, rest } = firstCodePoint(s)
  return `${titleCaseFirstChar(first)}${rest.toLocaleLowerCase()}`
}

/**
 * Split a string into an array of its words.
 * Without `pattern`, uses `Intl.Segmenter` word granularity plus Unicode letter/digit,
 * ordinal (`11th`), plural-acronym (`IDs`), and RGI emoji rules. Format characters
 * (ZWNJ, soft hyphen) stay inside words. With `pattern`, treats it as a separator
 * (`String.prototype.split`); empty pieces are dropped. A user `RegExp` is the caller's
 * responsibility (capture groups appear in the output per `split`).
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
export function words(s: string, pattern?: RegExp | string): string[] {
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
export function join(s: string, sep = ' '): string {
  return joinWords(s, sep)
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
export function isAlnum(s: string): boolean {
  return /^[\p{L}\p{N}]+$/gu.test(s)
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
export function isAlpha(s: string): boolean {
  return /^[\p{L}]+$/gu.test(s)
}

/**
 * Checks if a string contains only numeric characters.
 * @param s The string
 * @returns `true` if the string contains only numeric.
 * @example
```js
isNumeric('alpha1234')
// false

isNumeric('1234')
// true
```
 */
export function isNumeric(s: string): boolean {
  return /^[\p{N}]+$/gu.test(s)
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
export function asciify(s: string): string {
  let out = ''
  for (const ch of s) {
    const cp = ch.codePointAt(0)
    if (cp !== undefined && cp < 128) out += ch
  }
  return out
}

/** Letter folds from the Unicode CLDR Latin-ASCII transform. */
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

const IS_NONSPACING_MARK = /\p{Mn}/u
const IS_LATIN = /\p{Script=Latin}/u
const IS_ASCII_DIGIT = /^[0-9]$/

/**
 * Applies the Unicode CLDR Latin-ASCII transform (mark strip + letter folds).
 * @param s The string
 * @returns The folded string
 * @example
```js
removeAccents('Antoine de Saint-Exupéry')
// 'Antoine de Saint-Exupery'
```
 */
export function removeAccents(s: string): string {
  const nfd = s.normalize('NFD')
  let stripped = ''
  let stripNextMarks = false
  for (const ch of nfd) {
    if (IS_NONSPACING_MARK.test(ch)) {
      if (stripNextMarks) continue
      stripped += ch
      continue
    }
    stripNextMarks = IS_LATIN.test(ch) || IS_ASCII_DIGIT.test(ch)
    stripped += ch
  }
  const nfc = stripped.normalize('NFC')
  let out = ''
  for (const ch of nfc) {
    out += CLDR_LATIN_ASCII_FOLDS[ch] ?? ch
  }
  return out
}

/**
 * Title-cases the first letter of every word in place, keeping the rest of each word and
 * punctuation/spacing as-is (`NASA` stays `NASA`).
 * @param s The string to capitalize
 * @returns The title cased string.
 * @example
```js
titleCase('lord of the rings')
// 'Lord Of The Rings'
```
@see {@link capitalize}
 */
export function titleCase(s: string): string {
  if (!s) return s
  let remaining = s
  let out = ''
  for (const word of words(s)) {
    const idx = remaining.indexOf(word)
    if (idx < 0) {
      out += remaining
      remaining = ''
      break
    }
    out += remaining.slice(0, idx) + sentenceCase(word)
    remaining = remaining.slice(idx + word.length)
  }
  return out + remaining
}

/**
 * Converts the string to camel case. Apostrophes are removed from parts.
 * Later parts use `toUpperCase` on the first code point (not Unicode titlecase),
 * so digraphs follow the uppercase mapping (`pascalCase('ǆemal') === 'Ǆemal'`).
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
export function camelCase(s: string): string {
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
export function pascalCase(s: string): string {
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
export function snakeCase(s: string): string {
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
export function kebabCase(s: string): string {
  return kebabCaseWords(s)
}

/**
 * Returns a url-safe slug for the given string. Applies {@link removeAccents} (Latin-only),
 * then joins runs of Unicode letters and digits with `-`. Non-Latin letters are preserved.
 * @param s The string
 * @returns A slug version of the string
 * @example
```js
slugify('Antoine de Saint-Exupéry')
// 'Antoine-de-Saint-Exupery'
```
 */
export function slugify(s: string): string {
  if (!s) return ''
  return removeAccents(s)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}
