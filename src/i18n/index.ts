/**
 * This module includes functions and classes to handle internationalization of dates and currencies.
 *
 * @module i18n
 */
import { Currency } from './currency.js'
export * from './date/index.js'
export { Duration, TDuration, DurationUnit } from './duration.js'

/**
 * Money represents a local currency amount that can be formatted using the `Intl` apis.
 */
export function Money(amount, currency: string, locale: string) {
  return new Currency(amount, currency, locale)
}
