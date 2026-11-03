/**
 * This module includes utilities for working with strings.
 *
 * @module string
 */

const WORDS_REGEX = new RegExp(
  [
    '[A-Z\\xc0-\\xd6\\xd8-\\xde]?[a-z\\xdf-\\xf6\\xf8-\\xff]+',
    "(?:['\\u2019](?:d|ll|m|re|s|t|ve))?",
    '(?=[\\xac\\xb1\\xd7\\xf7\\u0000-\\u002f\\u003a-\\u0040\\u005b-\\u0060\\u007b-\\u00bf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000]|[A-Z\\xc0-\\xd6\\xd8-\\xde]|$)',
    '|(?:[A-Z\\xc0-\\xd6\\xd8-\\xde]|[^\\ud800-\\udfff\\xac\\xb1\\xd7\\xf7\\u0000-\\u002f\\u003a-\\u0040\\u005b-\\u0060\\u007b-\\u00bf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000\\d+\\u2700-\\u27bfa-z\\xdf-\\xf6\\xf8-\\xffA-Z\\xc0-\\xd6\\xd8-\\xde])+',
    "(?:['\\u2019](?:D|LL|M|RE|S|T|VE))?",
    '(?=[\\xac\\xb1\\xd7\\xf7\\u0000-\\u002f\\u003a-\\u0040\\u005b-\\u0060\\u007b-\\u00bf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000]|[A-Z\\xc0-\\xd6\\xd8-\\xde](?:[a-z\\xdf-\\xf6\\xf8-\\xff]|[^\\ud800-\\udfff\\xac\\xb1\\xd7\\xf7\\u0000-\\u002f\\u003a-\\u0040\\u005b-\\u0060\\u007b-\\u00bf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000\\d+\\u2700-\\u27bfa-z\\xdf-\\xf6\\xf8-\\xffA-Z\\xc0-\\xd6\\xd8-\\xde])|$)',
    '|[A-Z\\xc0-\\xd6\\xd8-\\xde]?(?:[a-z\\xdf-\\xf6\\xf8-\\xff]|[^\\ud800-\\udfff\\xac\\xb1\\xd7\\xf7\\u0000-\\u002f\\u003a-\\u0040\\u005b-\\u0060\\u007b-\\u00bf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000\\d+\\u2700-\\u27bfa-z\\xdf-\\xf6\\xf8-\\xffA-Z\\xc0-\\xd6\\xd8-\\xde])+',
    "(?:['\\u2019](?:d|ll|m|re|s|t|ve))?",
    "|[A-Z\\xc0-\\xd6\\xd8-\\xde]+(?:['\\u2019](?:D|LL|M|RE|S|T|VE))?",
    '|\\d*(?:1ST|2ND|3RD|(?![123])\\dTH)(?=\\b|[a-z_])',
    '|\\d*(?:1st|2nd|3rd|(?![123])\\dth)(?=\\b|[A-Z_])',
    '|\\d+',
    '|(?:[\\u2700-\\u27bf]|(?:\\ud83c[\\udde6-\\uddff]){2}|[\\ud800-\\udbff][\\udc00-\\udfff])[\\ufe0e\\ufe0f]?(?:[\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff]|\\ud83c[\\udffb-\\udfff])?(?:\\u200d(?:[^\\ud800-\\udfff]|(?:\\ud83c[\\udde6-\\uddff]){2}|[\\ud800-\\udbff][\\udc00-\\udfff])[\\ufe0e\\ufe0f]?(?:[\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff]|\\ud83c[\\udffb-\\udfff])?)*'
  ].join(''),
  'g'
)

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
 * @param s The string to split
 * @param pattern The pattern to match words
 * @returns The words array.
 * @example
```js
words('lord of the rings')
// ['lord', 'of', 'the', 'rings']
```
 */
export function words(s: string, pattern?: RegExp | string): string[] {
  if (pattern != null) return s.split(pattern)
  return s.match(WORDS_REGEX) ?? []
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
  return words(s).join(sep)
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

/** Non-decomposable Latin letters folded like Lodash `deburr`. */
const LATIN_FOLDS: Record<string, string> = {
  Œ: 'OE',
  œ: 'oe',
  ß: 'ss',
  ø: 'o',
  Ø: 'O',
  Ł: 'L',
  ł: 'l',
  đ: 'd',
  Đ: 'D',
  Æ: 'AE',
  æ: 'ae',
  þ: 'th',
  Þ: 'TH'
}

const IS_MARK = /\p{M}/u
const IS_LATIN = /\p{Script=Latin}/u

/**
 * Folds Latin accents and ligatures; strips combining marks only from Latin-script letters.
 * Non-Latin text is unchanged. Result is NFC.
 * @param s The string
 * @returns The new string without Latin accents
 * @example
```js
removeAccents('Antoine de Saint-Exupéry')
// 'Antoine de Saint-Exupery'
```
 */
export function removeAccents(s: string): string {
  let mapped = ''
  for (const ch of s) {
    mapped += LATIN_FOLDS[ch] ?? ch
  }
  const nfd = mapped.normalize('NFD')
  let out = ''
  let lastWasLatin = false
  for (const ch of nfd) {
    if (IS_MARK.test(ch)) {
      if (lastWasLatin) continue
      out += ch
      continue
    }
    lastWasLatin = IS_LATIN.test(ch)
    out += ch
  }
  return out.normalize('NFC')
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
  return s.replace(WORDS_REGEX, (word) => sentenceCase(word))
}

/**
 * Converts the string to camel case.
 * @param s The string to convert
 * @returns The camel cased string.
 * @example
```js
camelCase('Equipment class name')
// 'equipmentClassName'
```
 */
export function camelCase(s: string): string {
  return words(s).reduce(
    (acc, next) =>
      `${acc}${!acc ? next.toLowerCase() : next[0].toUpperCase() + next.slice(1).toLowerCase()}`,
    ''
  )
}

/**
 * Converts the string to Pascal case.
 * @param s The string to convert
 * @returns The Pascal cased string.
 * @example
```js
pascalCase('equipment class name')
// 'EquipmentClassName'
```
 */
export function pascalCase(s: string): string {
  return sentenceCase(camelCase(s))
}

/**
 * Converts the string to snake case.
 * @param s The string to convert
 * @returns The snake cased string.
 * @example
```js
snakeCase('Equipment Class Name')
// 'equipment_class_name'
```
 */
export function snakeCase(s: string): string {
  return join(s, '_').toLowerCase()
}

/**
 * Converts a string to kebab case.
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
  return join(s, '-').toLowerCase()
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
