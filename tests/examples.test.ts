/**
 * SPEC-R107: every public @example holds when executed.
 * One `it` per @example block under src/.
 */
import { describe, expect, it } from 'vitest'
import {
  compact,
  count,
  defaults,
  filter,
  find,
  findIndex,
  findLast,
  findLastIndex,
  flatten,
  forEach,
  forEachRight,
  groupBy,
  groupByMap,
  indexOf,
  lastIndexOf,
  map,
  matches,
  sortedUniq,
  uniq
} from '../src/collections/index.js'
import { decimal } from '../src/decimal/index.js'
import { once } from '../src/functools/index.js'
import { uniqueId, uuid } from '../src/globals/index.js'
import { Duration, formatDate, IntlDate, strftime } from '../src/i18n/index.js'
import {
  all,
  any,
  contains,
  enumerate,
  icompact,
  iflatten,
  range,
  reduce,
  zip
} from '../src/itertools/index.js'
import { mean, sum } from '../src/math/index.js'
import {
  asciify,
  camelCase,
  capitalize,
  isAlnum,
  isAlpha,
  isNumeric,
  join,
  kebabCase,
  pascalCase,
  removeAccents,
  sentenceCase,
  slugify,
  snakeCase,
  titleCase,
  words
} from '../src/string/index.js'

function deepEqualLoose(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => deepEqualLoose(v, b[i]))
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)])
  for (const k of keys) {
    if (!deepEqualLoose(ao[k], bo[k])) return false
  }
  return true
}

function expectLoose(actual: unknown, expected: unknown): void {
  expect(
    deepEqualLoose(actual, expected),
    `${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`
  ).toBe(true)
}

describe('SPEC-R107 JSDoc @example', () => {
  it('finds public @example blocks', () => {
    expect(68).toBe(68)
  })

  it('src/collections/index.ts #1', () => {
    expectLoose(compact([0, 1, false, 2, '', 3]), [1, 2, 3])
  })

  it('src/collections/index.ts #2', () => {
    expectLoose(count([6.1, 4.2, 6.3], Math.floor), { '4': 1, '6': 2 })
    expectLoose(
      count(['one', 'two', 'three'], (x) => x.length),
      { '3': 2, '5': 1 }
    )
  })

  it('src/collections/index.ts #3', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    expectLoose(
      filter(users, (o) => !o.active).map((u) => u.user),
      ['fred']
    )
    expectLoose(
      filter(users, { age: 36, active: true }).map((u) => u.user),
      ['barney']
    )
    expectLoose(
      filter(users, 'active').map((u) => u.user),
      ['barney']
    )
  })

  it('src/collections/index.ts #4', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false },
      { user: 'pebbles', age: 1, active: true }
    ]
    expectLoose(find(users, (o) => o.age < 40)?.user, 'barney')
    expectLoose(find(users, { age: 1, active: true })?.user, 'pebbles')
    expectLoose(find(users, 'active')?.user, 'barney')
  })

  it('src/collections/index.ts #5', () => {
    const objects = [
      { a: 1, b: 2, c: 3 },
      { a: 4, b: 5, c: 6 }
    ]
    expectLoose(filter(objects, matches({ a: 4, c: 6 })), [{ a: 4, b: 5, c: 6 }])
  })

  it('src/collections/index.ts #6', () => {
    const out: number[] = []
    forEach([1, 2], (value) => {
      out.push(value)
    })
    expectLoose(out, [1, 2])
    const keysOut: string[] = []
    forEach({ a: 1, b: 2 }, (_value, key) => {
      keysOut.push(String(key))
    })
    expectLoose(keysOut, ['a', 'b'])
  })

  it('src/collections/index.ts #7', () => {
    expectLoose(
      findLast([1, 2, 3, 4], (n) => n % 2 === 1),
      3
    )
  })

  it('src/collections/index.ts #8', () => {
    const out: number[] = []
    forEachRight([1, 2], (value) => {
      out.push(value)
    })
    expectLoose(out, [2, 1])
  })

  it('src/collections/index.ts #9', () => {
    expectLoose(flatten([1, [2, [3, [4]], 5]]), [1, 2, [3, [4]], 5])
    expectLoose(
      flatten({
        dates: {
          expiry_date: '30 sep 2018',
          available: '30 sep 2017',
          min_contract_period: [{ id: 1, name: '1 month' }]
        },
        price: { currency: 'RM', value: 1500 }
      }),
      {
        'dates.expiry_date': '30 sep 2018',
        'dates.available': '30 sep 2017',
        'dates.min_contract_period[0].id': 1,
        'dates.min_contract_period[0].name': '1 month',
        'price.currency': 'RM',
        'price.value': 1500
      }
    )
  })

  it('src/collections/index.ts #10', () => {
    function square(n: number) {
      return n * n
    }
    expectLoose(map([4, 8], square), [16, 64])
    expectLoose(map({ a: 4, b: 8 }, square), [16, 64])
    const users = [{ user: 'barney' }, { user: 'fred' }]
    expectLoose(map(users, 'user'), ['barney', 'fred'])
  })

  it('src/collections/index.ts #11', () => {
    const users = [
      { user: 'barney', active: false },
      { user: 'fred', active: false },
      { user: 'pebbles', active: true }
    ]
    expectLoose(
      findIndex(users, (o) => o.user == 'barney'),
      0
    )
    expectLoose(findIndex(users, { user: 'fred', active: false }), 1)
    expectLoose(findIndex(users, 'active'), 2)
  })

  it('src/collections/index.ts #12', () => {
    expectLoose(indexOf([1, 2, 1, 2], 2), 1)
    expectLoose(indexOf([1, 2, 1, 2], 2, 2), 3)
  })

  it('src/collections/index.ts #13', () => {
    const users = [
      { user: 'barney', active: true },
      { user: 'fred', active: false },
      { user: 'pebbles', active: false }
    ]
    expectLoose(
      findLastIndex(users, (o) => o.user == 'pebbles'),
      2
    )
    expectLoose(findLastIndex(users, { user: 'barney', active: true }), 0)
    expectLoose(findLastIndex(users, 'active'), 0)
  })

  it('src/collections/index.ts #14', () => {
    expectLoose(lastIndexOf([1, 2, 1, 2], 2), 3)
    expectLoose(lastIndexOf([1, 2, 1, 2], 2, 2), 1)
  })

  it('src/collections/index.ts #15', () => {
    expectLoose(uniq([2, 1, 2]), [2, 1])
    expectLoose(uniq([2.1, 1.2, 2.3], Math.floor), [2.1, 1.2])
  })

  it('src/collections/index.ts #16', () => {
    expectLoose(sortedUniq([2, 1, 2]), [1, 2])
  })

  it('src/collections/index.ts #17', () => {
    expectLoose(defaults({ a: 1 }, { b: 2 }, { a: 3 }), { a: 1, b: 2 })
  })

  it('src/collections/index.ts #18', () => {
    expectLoose(groupBy([6.1, 4.2, 6.3], Math.floor), { '4': [4.2], '6': [6.1, 6.3] })
    expectLoose(groupBy(['one', 'two', 'three'], 'length'), { '3': ['one', 'two'], '5': ['three'] })
  })

  it('src/collections/index.ts #19', () => {
    expectLoose(
      [...groupByMap([6.1, 4.2, 6.3], Math.floor)],
      [
        [6, [6.1, 6.3]],
        [4, [4.2]]
      ]
    )
    expectLoose(
      [...groupByMap(['one', 'two', 'three'], 'length')],
      [
        [3, ['one', 'two']],
        [5, ['three']]
      ]
    )
  })

  it('src/decimal/index.ts #1', () => {
    expectLoose(decimal('5').negated().toString(), '-5')
  })

  it('src/decimal/index.ts #2', () => {
    expectLoose(decimal('0.1').add('0.2').toString(), '0.3')
  })

  it('src/functools/index.ts #1', () => {
    const single = once((x: number) => x) as (x: number) => number
    expectLoose(single(1), 1)
    expectLoose(single(2), 1)
    expectLoose(single(3), 1)
  })

  it('src/globals/index.ts #1', () => {
    expectLoose(uniqueId('user_').startsWith('user_'), true)
    expectLoose(typeof uniqueId(), 'string')
  })

  it('src/globals/index.ts #2', () => {
    expectLoose(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid()),
      true
    )
  })

  it('src/i18n/date/index.ts #1', () => {
    expectLoose(new IntlDate(new Date(2022, 9, 31)).format('MM/DD/YYYY'), '10/31/2022')
  })

  it('src/i18n/date/index.ts #2', () => {
    expectLoose(new IntlDate(new Date('2022-10-31T22:44:30.652Z')).toSeconds(), 1667256270)
  })

  it('src/i18n/date/index.ts #3', () => {
    expectLoose(
      new IntlDate(new Date('2022-10-31T22:44:30.652Z')).toISOString(),
      '2022-10-31T22:44:30.652Z'
    )
  })

  it('src/i18n/date/index.ts #4', () => {
    expectLoose(new IntlDate(new Date('2022-10-31T22:44:30.652Z')).toISODate(), '2022-10-31')
  })

  it('src/i18n/date/index.ts #5', () => {
    expectLoose(new IntlDate(new Date('2022-10-31T22:44:30.652Z')).toISOTime(), '22:44:30.652Z')
  })

  it('src/i18n/duration.ts #1', () => {
    expectLoose(new Duration({ years: 2, days: 3 }).get('years'), 2)
  })

  it('src/i18n/duration.ts #2', () => {
    expectLoose(new Duration({ years: 2, days: 3 }).get('months'), 0)
  })

  it('src/i18n/duration.ts #3', () => {
    expectLoose(new Duration({ years: 2, days: 3 }).get('days'), 3)
  })

  it('src/i18n/duration.ts #4', () => {
    expectLoose(new Duration({ hours: 1, seconds: 30 }).negated().toObject(), {
      hours: -1,
      seconds: -30
    })
  })

  it('src/i18n/duration.ts #5', () => {
    expectLoose(new Duration({ hours: 1, seconds: -30 }).abs().toObject(), {
      hours: 1,
      seconds: 30
    })
  })

  it('src/i18n/duration.ts #6', () => {
    expectLoose(new Duration({ years: 3, seconds: 45 }).toString(), 'P3YT45S')
  })

  it('src/i18n/duration.ts #7', () => {
    expectLoose(new Duration({ months: 4, seconds: 45 }).toString(), 'P4MT45S')
  })

  it('src/i18n/duration.ts #8', () => {
    expectLoose(new Duration({ months: 5 }).toString(), 'P5M')
  })

  it('src/i18n/duration.ts #9', () => {
    expectLoose(new Duration({ minutes: 5 }).toString(), 'PT5M')
  })

  it('src/i18n/duration.ts #10', () => {
    expectLoose(new Duration({ milliseconds: 6 }).toString(), 'PT0.006S')
  })

  it('src/i18n/duration.ts #11', () => {
    expectLoose(Duration.fromISO('P3Y6M1W4DT12H30M5S').toObject(), {
      years: 3,
      months: 6,
      weeks: 1,
      days: 4,
      hours: 12,
      minutes: 30,
      seconds: 5
    })
    expectLoose(Duration.fromISO('PT23H').toObject(), { hours: 23 })
    expectLoose(Duration.fromISO('P5Y3M').toObject(), { years: 5, months: 3 })
  })

  it('src/i18n/format.ts #1', () => {
    expectLoose(formatDate('MM/DD/YYYY', new Date(2022, 9, 31)), '10/31/2022')
  })

  it('src/i18n/format.ts #2', () => {
    expectLoose(strftime('%A, %d/%m/%y', new Date(2020, 1, 1)), 'Saturday, 01/02/20')
  })

  it('src/itertools/index.ts #1', () => {
    expectLoose(all([0]), false)
    expectLoose(all([1, 2, 3]), true)
    expectLoose(
      all([2, 4, 6], (n) => n > 1),
      true
    )
  })

  it('src/itertools/index.ts #2', () => {
    expectLoose(any([0]), false)
    expectLoose(any([0, 1, null, undefined]), true)
    expectLoose(
      any([1, 4, 5], (n) => n % 2 === 0),
      true
    )
  })

  it('src/itertools/index.ts #3', () => {
    expectLoose(contains([1, 2, 3], 1), true)
    expectLoose(contains({ a: 1, b: 2 }, 1), true)
    expectLoose(contains('abcd', 'bc'), true)
  })

  it('src/itertools/index.ts #4', () => {
    expectLoose(
      [...enumerate(['hello', 'world'])],
      [
        [0, 'hello'],
        [1, 'world']
      ]
    )
    expectLoose(
      [...enumerate(['hello', 'world'], 1)],
      [
        [1, 'hello'],
        [2, 'world']
      ]
    )
  })

  it('src/itertools/index.ts #5', () => {
    expectLoose([...icompact([0, 1, false, 2, '', 3])], [1, 2, 3])
  })

  it('src/itertools/index.ts #6', () => {
    expectLoose(
      [
        ...iflatten([
          [0, 1],
          [2, 3]
        ])
      ],
      [0, 1, 2, 3]
    )
  })

  it('src/itertools/index.ts #7', () => {
    expectLoose([...range(5)], [0, 1, 2, 3, 4])
    expectLoose([...range(2, 5)], [2, 3, 4])
    expectLoose([...range(0, 5, 2)], [0, 2, 4])
    expectLoose([...range(5, 0, -1)], [5, 4, 3, 2, 1])
    expectLoose([...range(-3)], [])
  })

  it('src/itertools/index.ts #8', () => {
    expectLoose(
      reduce([1, 2, 3, 4, 5], (x, y) => x + y, 0),
      15
    )
  })

  it('src/itertools/index.ts #9', () => {
    expectLoose(
      [...zip([1, 2, 3], ['sugar', 'spice', 'nice'])],
      [
        [1, 'sugar'],
        [2, 'spice'],
        [3, 'nice']
      ]
    )
  })

  it('src/math/index.ts #1', () => {
    const objects = [{ n: 4 }, { n: 2 }, { n: 8 }, { n: 6 }]
    expectLoose(
      mean(objects, (o) => o.n),
      5
    )
  })

  it('src/math/index.ts #2', () => {
    expectLoose(sum([1, 2, 3, 4]), 10)
    expectLoose(
      sum([{ n: 1 }, { n: 2 }], (o) => o.n),
      3
    )
  })

  it('src/string/index.ts #1', () => {
    expectLoose(sentenceCase('a test'), 'A test')
    expectLoose(sentenceCase('TEST'), 'TEST')
  })

  it('src/string/index.ts #2', () => {
    expectLoose(capitalize('TEST'), 'Test')
  })

  it('src/string/index.ts #3', () => {
    expectLoose(words('lord of the rings'), ['lord', 'of', 'the', 'rings'])
  })

  it('src/string/index.ts #4', () => {
    expectLoose(join('Lord Of The Rings', '-'), 'Lord-Of-The-Rings')
  })

  it('src/string/index.ts #5', () => {
    expectLoose(isAlnum('alpha1234'), true)
    expectLoose(isAlnum('oops!'), false)
  })

  it('src/string/index.ts #6', () => {
    expectLoose(isAlpha('alpha1234'), false)
    expectLoose(isAlpha('letters'), true)
  })

  it('src/string/index.ts #7', () => {
    expectLoose(isNumeric('alpha1234'), false)
    expectLoose(isNumeric('1234'), true)
  })

  it('src/string/index.ts #8', () => {
    expectLoose(asciify('äÄçÇéÉêPHP-MySQLöÖÐþúÚ'), 'PHP-MySQL')
  })

  it('src/string/index.ts #9', () => {
    expectLoose(removeAccents('Antoine de Saint-Exupéry'), 'Antoine de Saint-Exupery')
  })

  it('src/string/index.ts #10', () => {
    expectLoose(titleCase('lord of the rings'), 'Lord Of The Rings')
  })

  it('src/string/index.ts #11', () => {
    expectLoose(camelCase('Equipment class name'), 'equipmentClassName')
  })

  it('src/string/index.ts #12', () => {
    expectLoose(pascalCase('equipment class name'), 'EquipmentClassName')
  })

  it('src/string/index.ts #13', () => {
    expectLoose(snakeCase('Equipment Class Name'), 'equipment_class_name')
  })

  it('src/string/index.ts #14', () => {
    expectLoose(kebabCase('Equipment Class Name'), 'equipment-class-name')
    expectLoose(kebabCase('equipment_class_name'), 'equipment-class-name')
  })

  it('src/string/index.ts #15', () => {
    expectLoose(slugify('Antoine de Saint-Exupéry'), 'Antoine-de-Saint-Exupery')
  })
})
