import { toText } from '../internal/text.ts'
import { words } from './words.ts'

/** The words of `s` without apostrophes, as lodash's compound converters read them. */
function toParts(s: unknown): string[] {
  return words(s).map((w) => w.replace(/['’]/g, ''))
}

/** The lowercased words of `s` joined with `separator`. */
function joinLower(s: unknown, separator: string): string {
  return toParts(s)
    .map((w) => w.toLowerCase())
    .join(separator)
}

/** Uppercases the part's first code point and lowercases the rest, so `ǆ` and `İ` stay one letter. */
function upperFirstLowerRest(part: string): string {
  const [first = ''] = part
  return first.toUpperCase() + part.toLowerCase().slice(first.toLowerCase().length)
}

/**
 * Converts a string to camel case: the words of {@link words}, without apostrophes, the first
 * lowercased and each later one with its first code point uppercased.
 * @param s The string to convert.
 * @returns The camel-cased string.
 * @example
 * ```ts
 * camelCase('Foo Bar') // 'fooBar'
 * camelCase('--foo-bar--') // 'fooBar'
 * ```
 */
export function camelCase(s: unknown): string {
  return toParts(s)
    .map((w, i) => (i === 0 ? w.toLowerCase() : upperFirstLowerRest(w)))
    .join('')
}

/**
 * Converts a string to Pascal case: as {@link camelCase}, with the first word capitalized too.
 * Each first code point is uppercased, as lodash's `upperFirst` does, not titlecased: `ǆemal`
 * becomes `Ǆemal`.
 * @param s The string to convert.
 * @returns The Pascal-cased string.
 * @example
 * ```ts
 * pascalCase('foo bar') // 'FooBar'
 * ```
 */
export function pascalCase(s: unknown): string {
  return toParts(s).map(upperFirstLowerRest).join('')
}

/**
 * Converts a string to snake case: the lowercased words joined with `_`.
 * @param s The string to convert.
 * @returns The snake-cased string.
 * @example
 * ```ts
 * snakeCase('fooBar') // 'foo_bar'
 * ```
 */
export function snakeCase(s: unknown): string {
  return joinLower(s, '_')
}

/**
 * Converts a string to kebab case: the lowercased words joined with `-`.
 * @param s The string to convert.
 * @returns The kebab-cased string.
 * @example
 * ```ts
 * kebabCase('fooBar') // 'foo-bar'
 * ```
 */
export function kebabCase(s: unknown): string {
  return joinLower(s, '-')
}

/**
 * Converts a string to start case: the words joined with spaces, each with its first code point
 * uppercased and the rest kept, as lodash does. Uppercased, not titlecased: `ǆemal` becomes
 * `Ǆemal`, where {@link capitalize} gives `ǅemal`.
 * @param s The string to convert.
 * @returns The start-cased string.
 * @example
 * ```ts
 * startCase('--foo-bar--') // 'Foo Bar'
 * startCase('fooBar') // 'Foo Bar'
 * startCase('__FOO_BAR__') // 'FOO BAR'
 * ```
 */
export function startCase(s: unknown): string {
  return toParts(s)
    .map((part) => {
      const [first = ''] = part
      return first.toUpperCase() + part.slice(first.length)
    })
    .join(' ')
}

/** Unicode titlecase forms, keyed by lowercase, that no uppercase or range rule can derive. */
const TITLECASE_FIRST: Readonly<Record<string, string>> = Object.freeze({
  '\u0149': '\u02BCN',
  '\u01C6': '\u01C5',
  '\u01C9': '\u01C8',
  '\u01CC': '\u01CB',
  '\u01F3': '\u01F2',
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

/** Greek letters with ypogegrammeni (U+1F80-U+1FAF): each titlecase form is the lowercase plus 8. */
const YPOGEGRAMMENI_FIRST = 0x1f80
const YPOGEGRAMMENI_LAST = 0x1faf
const YPOGEGRAMMENI_TITLECASE_OFFSET = 8

function titleCaseFirstChar(ch: string): string {
  if (IS_MKHEDRULI.test(ch)) return ch
  const lower = ch.toLowerCase()
  const listed = TITLECASE_FIRST[lower]
  if (listed !== undefined) return listed
  const cp = lower.codePointAt(0)
  if (cp !== undefined && cp >= YPOGEGRAMMENI_FIRST && cp <= YPOGEGRAMMENI_LAST) {
    return String.fromCodePoint(cp + YPOGEGRAMMENI_TITLECASE_OFFSET)
  }
  const upper = ch.toUpperCase()
  // Multi-char uppercase (e.g. ß -> SS): titlecase is first upper + rest lower.
  return upper.length > 1 ? upper[0] + upper.slice(1).toLowerCase() : upper
}

/**
 * Converts the first code point to Unicode title case and the rest to lower case. Digraphs take
 * their titlecase form (`ǆ` becomes `ǅ`), and a final sigma lowercases in context. The mapping is
 * the locale-independent Unicode default, so the result is the same on every host.
 * @param s The string to capitalize.
 * @returns The capitalized string.
 * @example
 * ```ts
 * capitalize('FRED') // 'Fred'
 * capitalize('ǆemal') // 'ǅemal'
 * ```
 */
export function capitalize(s: unknown): string {
  const text = toText(s)
  const [first = ''] = text
  // Lowercasing the whole string lets a final sigma see the letter before it.
  const rest = text.toLowerCase().slice(first.toLowerCase().length)
  return `${titleCaseFirstChar(first)}${rest}`
}
