/**
 * Exact decimal arithmetic shaped after the TC39 Decimal draft, with Currency.
 *
 * @example
 * ```ts
 * import { Decimal } from 'atomic-fns/decimal'
 *
 * new Decimal('0.1').add('0.2').toString() // '0.3'
 * ```
 * @module
 */
export { Currency } from './currency.ts'
export { Decimal } from './decimal.ts'
export type { DecimalInput, DivideOptions, RoundingMode } from './decimal.ts'
