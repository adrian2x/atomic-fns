/**
 * This module includes utilities for working with strings.
 *
 * @module string
 */

const WORDS_REGEX = // eslint-disable-next-line no-control-regex
  /[A-Z\xc0-\xd6\xd8-\xde]?[a-z\xdf-\xf6\xf8-\xff]+(?:['’](?:d|ll|m|re|s|t|ve))?(?=[\xac\xb1\xd7\xf7\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\xbf\u2000-\u206f \t\x0b\f\xa0\ufeff\n\r\u2028\u2029\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000]|[A-Z\xc0-\xd6\xd8-\xde]|$)|(?:[A-Z\xc0-\xd6\xd8-\xde]|[^\ud800-\udfff\xac\xb1\xd7\xf7\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\xbf\u2000-\u206f \t\x0b\f\xa0\ufeff\n\r\u2028\u2029\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\d+\u2700-\u27bfa-z\xdf-\xf6\xf8-\xffA-Z\xc0-\xd6\xd8-\xde])+(?:['’](?:D|LL|M|RE|S|T|VE))?(?=[\xac\xb1\xd7\xf7\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\xbf\u2000-\u206f \t\x0b\f\xa0\ufeff\n\r\u2028\u2029\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000]|[A-Z\xc0-\xd6\xd8-\xde](?:[a-z\xdf-\xf6\xf8-\xff]|[^\ud800-\udfff\xac\xb1\xd7\xf7\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\xbf\u2000-\u206f \t\x0b\f\xa0\ufeff\n\r\u2028\u2029\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\d+\u2700-\u27bfa-z\xdf-\xf6\xf8-\xffA-Z\xc0-\xd6\xd8-\xde])|$)|[A-Z\xc0-\xd6\xd8-\xde]?(?:[a-z\xdf-\xf6\xf8-\xff]|[^\ud800-\udfff\xac\xb1\xd7\xf7\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\xbf\u2000-\u206f \t\x0b\f\xa0\ufeff\n\r\u2028\u2029\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\d+\u2700-\u27bfa-z\xdf-\xf6\xf8-\xffA-Z\xc0-\xd6\xd8-\xde])+(?:['’](?:d|ll|m|re|s|t|ve))?|[A-Z\xc0-\xd6\xd8-\xde]+(?:['’](?:D|LL|M|RE|S|T|VE))?|\d*(?:1ST|2ND|3RD|(?![123])\dTH)(?=\b|[a-z_])|\d*(?:1st|2nd|3rd|(?![123])\dth)(?=\b|[A-Z_])|\d+|(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff])[\ufe0e\ufe0f]?(?:[\u0300-\u036f\ufe20-\ufe2f\u20d0-\u20ff]|\ud83c[\udffb-\udfff])?(?:\u200d(?:[^\ud800-\udfff]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff])[\ufe0e\ufe0f]?(?:[\u0300-\u036f\ufe20-\ufe2f\u20d0-\u20ff]|\ud83c[\udffb-\udfff])?)*/g

/**
 * Converts only the first character of the given string to upper case. Note that the rest of the characters are preserved.
 * @param {string} s The string
 * @returns {string} Returns the sentence string.
 * @example
```js
sentenceCase('a test')
// 'A test'

sentenceCase('TEST')
// 'TEST'
```
 * @see {@link capitalize}
 */
export function sentenceCase(s: string) {
  return `${(s[0] || '').toLocaleUpperCase()}${s.substring(1) || ''}`
}

/**
 * Converts the first character of the given string to upper case and the rest to lower case.
 * @param {string} s The string to capitalize
 * @returns {string} Returns the capitalized string.
 * @example
```js
capitalize('TEST')
// 'Test'
```
 * @see {@link titleCase}
 */
export function capitalize(s: string) {
  return `${(s[0] || '').toLocaleUpperCase()}${(s.substring(1) || '').toLocaleLowerCase()}`
}

/**
 * Split a string into an array of its words.
 * @param {string} s The string to split
 * @param {RegExp | string} [pattern] The pattern to match words
 * @returns {string[]} Returns the words array.
 * @example
```js
words('lord of the rings')
// ['lord', 'of', 'the', 'rings']
```
 */
export function words(s: string, pattern?: RegExp | string) {
  if (pattern != null) return s.split(pattern)
  return s.match(WORDS_REGEX) || ([] as string[])
}

/**
 * Create a new string which is the concatenation of the words in the given input.
 * @param {string} s The string to join
 * @param {string} [sep=' '] The separator to use
 * @returns {string} Returns the joined string.
 * @example
```js
join('Lord Of The Rings', '-')
// 'Lord-Of-The-Rings'
```
 */
export function join(s: string, sep = ' ') {
  return words(s).join(sep)
}

/**
 * Checks if a string contains only alphanumeric characters.
 * @param {string} s The string
 * @returns {boolean} Returns `true` if the string contains only alphanumeric.
 * @example
```js
isAlnum('alpha1234')
// true

isAlnum('oops!')
// false
```
 */
export function isAlnum(s: string) {
  return /^[\p{L}\p{N}]+$/gu.test(s)
}

/**
 * Checks if a string contains only alphabetic characters.
 * @param {string} s The string
 * @returns {boolean} Returns `true` if the string contains only alphabetic.
 * @example
```js
isAlpha('alpha1234')
// false

isAlpha('letters')
// true
```
 */
export function isAlpha(s: string) {
  return /^[\p{L}]+$/gu.test(s)
}

/**
 * Checks if a string contains only numeric characters.
 * @param {string} s The string
 * @returns {boolean} Returns `true` if the string contains only numeric.
 * @example
```js
isNumeric('alpha1234')
// false

isNumeric('1234')
// true
```
 */
export function isNumeric(s: string) {
  return /^[\p{N}]+$/gu.test(s)
}

/**
 * Returns a new string with only valid ASCII characters
 * @param {string} s The string
 * @returns {string} The ASCII characters in the given string
 * @example
```js
asciify('äÄçÇéÉêPHP-MySQLöÖÐþúÚ')
// 'PHP-MySQL'
```
 */
export function asciify(s: string) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[^\x00-\x7F]/g, '')
}

/**
 * Replaces any accent characters in the string with non accents.
 * @param {string} s The string
 * @returns {string} The new string without accents
 * @example
```js
removeAccents('Antoine de Saint-Exupéry')
// 'Antoine de Saint-Exupery'
```
 */
export function removeAccents(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Capitalizes the first letter of every word in the string.
 * @param {string} s The string to capitalize
 * @returns {string} Returns the title cased string.
 * @example
```js
titleCase('lord of the rings')
// 'Lord Of The Rings'
```
@see {@link capitalize}
 */
export function titleCase(s: string) {
  return words(s)
    .map((word) => capitalize(word))
    .join(' ')
}

/**
 * Converts the string to camel case.
 * @param {string} s The string to convert
 * @returns {string} Returns the camel cased string.
 * @example
```js
camelCase('Equipment class name')
// 'equipmentClassName'
```
 */
export function camelCase(s: string) {
  return words(s).reduce(
    (acc, next) =>
      `${acc}${!acc ? next.toLowerCase() : next[0].toUpperCase() + next.slice(1).toLowerCase()}`,
    ''
  )
}

/**
 * Converts the string to Pascal case.
 * @param {string} s The string to convert
 * @returns {string} Returns the Pascal cased string.
 * @example
```js
pascalCase('equipment class name')
// 'EquipmentClassName'
```
 */
export function pascalCase(s: string) {
  return sentenceCase(camelCase(s))
}

/**
 * Converts the string to snake case.
 * @param {string} s The string to convert
 * @returns {string} Returns the snake cased string.
 * @example
```js
snakeCase('Equipment Class Name')
// 'equipment_class_name'
```
 */
export function snakeCase(s: string) {
  return join(s, '_').toLowerCase()
}

/**
 * Converts a string to kebab case.
 * @param {string} s The string
 * @returns {string} Returns the kebab cased string.
 * @example
```js
kebabCase('Equipment Class Name')
// 'equipment-class-name'

kebabCase('equipment_class_name')
// 'equipment-class-name'
```
 */
export function kebabCase(s: string) {
  return join(s, '-').toLowerCase()
}

/**
 * Returns a url-safe slug for the given string. Note that by default it will preserve any capitalization in the given string.
 * @param {string} s The string
 * @returns {string} A url-safe slug version of the string
 * @example
```js
slugify('Antoine de Saint-Exupéry')
// 'Antoine-de-Saint-Exupery'
```
 */
export function slugify(s: string) {
  const slug = join(removeAccents(s), '-')
  const urlSafe = slug.replace(/[^a-zA-Z0-9-_]/g, '')
  return urlSafe
}
