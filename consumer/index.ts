import { identity } from 'atomic-fns'
import { compact } from 'atomic-fns/collections'
import { Decimal } from 'atomic-fns/decimal'
import { memoize } from 'atomic-fns/functools'
import { len } from 'atomic-fns/globals'
import { Currency } from 'atomic-fns/i18n'
import { range } from 'atomic-fns/itertools'
import { round } from 'atomic-fns/math'
import { compare } from 'atomic-fns/operators'
import { randomInt } from 'atomic-fns/random'
import { capitalize } from 'atomic-fns/string'

export const smoke = [
  identity(1),
  compact([0, 1]),
  new Decimal(1),
  memoize((x: number) => x),
  len([1]),
  new Currency(1, 'USD'),
  [...range(2)],
  round(1.5),
  compare(1, 2),
  randomInt(0, 1),
  capitalize('a')
]
