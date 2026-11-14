import { Decimal } from '../../src/decimal/index.ts'

export const d = (value: string | number | bigint) => new Decimal(value)
