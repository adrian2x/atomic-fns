/** Longest locale list, joined, that `Intl` is asked to canonicalize. */
const MAX_LOCALE_LENGTH = 255

/**
 * Canonical tags for `locales`; an empty list means the runtime's locale.
 * @throws {TypeError} for an entry that is neither a string nor an `Intl.Locale`.
 * @throws {RangeError} for a list longer than 255 characters, which the engine canonicalizes in
 * quadratic time, or a malformed tag.
 */
export function canonicalLocales(locales: Intl.LocalesArgument): string[] {
  if (locales === undefined) return []
  const entries: readonly unknown[] = Array.isArray(locales) ? locales : [locales]
  const tags = entries.map((entry) => {
    if (typeof entry === 'string') return entry
    if (entry instanceof Intl.Locale) return entry.toString()
    throw new TypeError('locale must be a string or an Intl.Locale')
  })
  if (tags.join().length > MAX_LOCALE_LENGTH) {
    throw new RangeError(`locale is longer than ${String(MAX_LOCALE_LENGTH)} characters`)
  }
  return Intl.getCanonicalLocales(tags)
}
