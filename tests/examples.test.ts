/**
 * SPEC-R107: every public @example holds when executed.
 * One `it` per @example block under src/.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join as pathJoin } from 'node:path'
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

function countExampleBlocks(dir: string): number {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = pathJoin(dir, entry.name)
    if (entry.isDirectory()) {
      total += countExampleBlocks(path)
    } else if (entry.name.endsWith('.ts')) {
      const text = readFileSync(path, 'utf8')
      const matches = text.match(/@example/g)
      if (matches) total += matches.length
    }
  }
  return total
}

describe('SPEC-R107 JSDoc @example', () => {
  it('finds public @example blocks', () => {
    const srcRoot = pathJoin(import.meta.dirname, '../src')
    const blockCount = countExampleBlocks(srcRoot)
    const exampleTests = [
      ...readFileSync(pathJoin(import.meta.dirname, 'examples.test.ts'), 'utf8').matchAll(
        /it\('src\//g
      )
    ].length
    expect(blockCount).toBe(exampleTests)
    expect(blockCount).toBeGreaterThan(0)
  })

  it('src/collections/index.ts #1', () => {
    expect(compact([0, 1, false, 2, '', 3])).toEqual([1, 2, 3])
  })

  it('src/collections/index.ts #2', () => {
    expect(count([6.1, 4.2, 6.3], Math.floor)).toEqual({ '4': 1, '6': 2 })
    expect(count(['one', 'two', 'three'], (x) => x.length)).toEqual({ '3': 2, '5': 1 })
  })

  it('src/collections/index.ts #3', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    expect(filter(users, (o) => !o.active).map((u) => u.user)).toEqual(['fred'])
    expect(filter(users, { age: 36, active: true }).map((u) => u.user)).toEqual(['barney'])
    expect(filter(users, 'active').map((u) => u.user)).toEqual(['barney'])
  })

  it('src/collections/index.ts #4', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false },
      { user: 'pebbles', age: 1, active: true }
    ]
    expect(find(users, (o) => o.age < 40)?.user).toEqual('barney')
    expect(find(users, { age: 1, active: true })?.user).toEqual('pebbles')
    expect(find(users, 'active')?.user).toEqual('barney')
  })

  it('src/collections/index.ts #5', () => {
    const objects = [
      { a: 1, b: 2, c: 3 },
      { a: 4, b: 5, c: 6 }
    ]
    expect(filter(objects, matches({ a: 4, c: 6 }))).toEqual([{ a: 4, b: 5, c: 6 }])
  })

  it('src/collections/index.ts #6', () => {
    const out: number[] = []
    forEach([1, 2], (value) => {
      out.push(value)
    })
    expect(out).toEqual([1, 2])
    const keysOut: string[] = []
    forEach({ a: 1, b: 2 }, (_value, key) => {
      keysOut.push(String(key))
    })
    expect(keysOut).toEqual(['a', 'b'])
  })

  it('src/collections/index.ts #7', () => {
    expect(findLast([1, 2, 3, 4], (n) => n % 2 === 1)).toEqual(3)
  })

  it('src/collections/index.ts #8', () => {
    const out: number[] = []
    forEachRight([1, 2], (value) => {
      out.push(value)
    })
    expect(out).toEqual([2, 1])
  })

  it('src/collections/index.ts #9', () => {
    expect(flatten([1, [2, [3, [4]], 5]])).toEqual([1, 2, [3, [4]], 5])
    expect(
      flatten({
        dates: {
          expiry_date: '30 sep 2018',
          available: '30 sep 2017',
          min_contract_period: [{ id: 1, name: '1 month' }]
        },
        price: { currency: 'RM', value: 1500 }
      })
    ).toEqual({
      'dates.expiry_date': '30 sep 2018',
      'dates.available': '30 sep 2017',
      'dates.min_contract_period[0].id': 1,
      'dates.min_contract_period[0].name': '1 month',
      'price.currency': 'RM',
      'price.value': 1500
    })
  })

  it('src/collections/index.ts #10', () => {
    function square(n: number) {
      return n * n
    }
    expect(map([4, 8], square)).toEqual([16, 64])
    expect(map({ a: 4, b: 8 }, square)).toEqual([16, 64])
    const users = [{ user: 'barney' }, { user: 'fred' }]
    expect(map(users, 'user')).toEqual(['barney', 'fred'])
  })

  it('src/collections/index.ts #11', () => {
    const users = [
      { user: 'barney', active: false },
      { user: 'fred', active: false },
      { user: 'pebbles', active: true }
    ]
    expect(findIndex(users, (o) => o.user == 'barney')).toEqual(0)
    expect(findIndex(users, { user: 'fred', active: false })).toEqual(1)
    expect(findIndex(users, 'active')).toEqual(2)
  })

  it('src/collections/index.ts #12', () => {
    expect(indexOf([1, 2, 1, 2], 2)).toEqual(1)
    expect(indexOf([1, 2, 1, 2], 2, 2)).toEqual(3)
  })

  it('src/collections/index.ts #13', () => {
    const users = [
      { user: 'barney', active: true },
      { user: 'fred', active: false },
      { user: 'pebbles', active: false }
    ]
    expect(findLastIndex(users, (o) => o.user == 'pebbles')).toEqual(2)
    expect(findLastIndex(users, { user: 'barney', active: true })).toEqual(0)
    expect(findLastIndex(users, 'active')).toEqual(0)
  })

  it('src/collections/index.ts #14', () => {
    expect(lastIndexOf([1, 2, 1, 2], 2)).toEqual(3)
    expect(lastIndexOf([1, 2, 1, 2], 2, 2)).toEqual(1)
  })

  it('src/collections/index.ts #15', () => {
    expect(uniq([2, 1, 2])).toEqual([2, 1])
    expect(uniq([2.1, 1.2, 2.3], Math.floor)).toEqual([2.1, 1.2])
  })

  it('src/collections/index.ts #16', () => {
    expect(sortedUniq([2, 1, 2])).toEqual([1, 2])
  })

  it('src/collections/index.ts #17', () => {
    expect(defaults({ a: 1 }, { b: 2 }, { a: 3 })).toEqual({ a: 1, b: 2 })
    const withProto = defaults({}, { toString: 'ts', a: 1 }) as { toString: string; a: number }
    expect(withProto.toString).toBe('ts')
    expect(withProto.a).toBe(1)
    expect(defaults({ a: null }, { a: 1 })).toEqual({ a: null })
  })

  it('src/collections/index.ts #18', () => {
    expect(groupBy([6.1, 4.2, 6.3], Math.floor)).toEqual({ '4': [4.2], '6': [6.1, 6.3] })
    expect(groupBy(['one', 'two', 'three'], 'length')).toEqual({
      '3': ['one', 'two'],
      '5': ['three']
    })
  })

  it('src/collections/index.ts #19', () => {
    expect([...groupByMap([6.1, 4.2, 6.3], Math.floor)]).toEqual([
      [6, [6.1, 6.3]],
      [4, [4.2]]
    ])
    expect([...groupByMap(['one', 'two', 'three'], 'length')]).toEqual([
      [3, ['one', 'two']],
      [5, ['three']]
    ])
  })

  it('src/decimal/index.ts #1', () => {
    expect(decimal('5').negated().toString()).toEqual('-5')
  })

  it('src/decimal/index.ts #2', () => {
    expect(decimal('0.1').add('0.2').toString()).toEqual('0.3')
  })

  it('src/functools/index.ts #1', () => {
    const single = once((x: number) => x)
    expect(single(1)).toEqual(1)
    expect(single(2)).toEqual(1)
    expect(single(3)).toEqual(1)
  })

  it('src/globals/index.ts #1', () => {
    expect(uniqueId('user_').startsWith('user_')).toEqual(true)
    expect(typeof uniqueId()).toEqual('string')
  })

  it('src/globals/index.ts #2', () => {
    expect(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid())
    ).toEqual(true)
  })

  it('src/i18n/date/index.ts #1', () => {
    expect(new IntlDate(new Date(2022, 9, 31)).format('MM/DD/YYYY')).toEqual('10/31/2022')
  })

  it('src/i18n/date/index.ts #2', () => {
    expect(new IntlDate(new Date('2022-10-31T22:44:30.652Z')).toSeconds()).toEqual(1667256270)
  })

  it('src/i18n/date/index.ts #3', () => {
    expect(new IntlDate(new Date('2022-10-31T22:44:30.652Z')).toISOString()).toEqual(
      '2022-10-31T22:44:30.652Z'
    )
  })

  it('src/i18n/date/index.ts #4', () => {
    expect(new IntlDate(new Date('2022-10-31T22:44:30.652Z')).toISODate()).toEqual('2022-10-31')
  })

  it('src/i18n/date/index.ts #5', () => {
    expect(new IntlDate(new Date('2022-10-31T22:44:30.652Z')).toISOTime()).toEqual('22:44:30.652Z')
  })

  it('src/i18n/duration.ts #1', () => {
    expect(new Duration({ years: 2, days: 3 }).get('years')).toEqual(2)
  })

  it('src/i18n/duration.ts #2', () => {
    expect(new Duration({ years: 2, days: 3 }).get('months')).toEqual(0)
  })

  it('src/i18n/duration.ts #3', () => {
    expect(new Duration({ years: 2, days: 3 }).get('days')).toEqual(3)
  })

  it('src/i18n/duration.ts #4', () => {
    expect(new Duration({ hours: 1, seconds: 30 }).negated().toObject()).toEqual({
      hours: -1,
      seconds: -30
    })
  })

  it('src/i18n/duration.ts #5', () => {
    expect(new Duration({ hours: 1, seconds: -30 }).abs().toObject()).toEqual({
      hours: 1,
      seconds: 30
    })
  })

  it('src/i18n/duration.ts #6', () => {
    expect(new Duration({ years: 3, seconds: 45 }).toString()).toEqual('P3YT45S')
  })

  it('src/i18n/duration.ts #7', () => {
    expect(new Duration({ months: 4, seconds: 45 }).toString()).toEqual('P4MT45S')
  })

  it('src/i18n/duration.ts #8', () => {
    expect(new Duration({ months: 5 }).toString()).toEqual('P5M')
  })

  it('src/i18n/duration.ts #9', () => {
    expect(new Duration({ minutes: 5 }).toString()).toEqual('PT5M')
  })

  it('src/i18n/duration.ts #10', () => {
    expect(new Duration({ milliseconds: 6 }).toString()).toEqual('PT0.006S')
  })

  it('src/i18n/duration.ts #11', () => {
    expect(Duration.fromISO('P3Y6M1W4DT12H30M5S').toObject()).toEqual({
      years: 3,
      months: 6,
      weeks: 1,
      days: 4,
      hours: 12,
      minutes: 30,
      seconds: 5
    })
    expect(Duration.fromISO('PT23H').toObject()).toEqual({ hours: 23 })
    expect(Duration.fromISO('P5Y3M').toObject()).toEqual({ years: 5, months: 3 })
  })

  it('src/i18n/format.ts #1', () => {
    expect(formatDate('MM/DD/YYYY', new Date(2022, 9, 31))).toEqual('10/31/2022')
  })

  it('src/i18n/format.ts #2', () => {
    expect(strftime('%A, %d/%m/%y', new Date(2020, 1, 1))).toEqual('Saturday, 01/02/20')
  })

  it('src/itertools/index.ts #1', () => {
    expect(all([0])).toEqual(false)
    expect(all([1, 2, 3])).toEqual(true)
    expect(all([2, 4, 6], (n) => n > 1)).toEqual(true)
  })

  it('src/itertools/index.ts #2', () => {
    expect(any([0])).toEqual(false)
    expect(any([0, 1, null, undefined])).toEqual(true)
    expect(any([1, 4, 5], (n) => n % 2 === 0)).toEqual(true)
  })

  it('src/itertools/index.ts #3', () => {
    expect(contains([1, 2, 3], 1)).toEqual(true)
    expect(contains({ a: 1, b: 2 }, 1)).toEqual(true)
    expect(contains('abcd', 'bc')).toEqual(true)
  })

  it('src/itertools/index.ts #4', () => {
    expect([...enumerate(['hello', 'world'])]).toEqual([
      [0, 'hello'],
      [1, 'world']
    ])
    expect([...enumerate(['hello', 'world'], 1)]).toEqual([
      [1, 'hello'],
      [2, 'world']
    ])
  })

  it('src/itertools/index.ts #5', () => {
    expect([...icompact([0, 1, false, 2, '', 3])]).toEqual([1, 2, 3])
  })

  it('src/itertools/index.ts #6', () => {
    expect([
      ...iflatten([
        [0, 1],
        [2, 3]
      ])
    ]).toEqual([0, 1, 2, 3])
  })

  it('src/itertools/index.ts #7', () => {
    expect([...range(5)]).toEqual([0, 1, 2, 3, 4])
    expect([...range(2, 5)]).toEqual([2, 3, 4])
    expect([...range(0, 5, 2)]).toEqual([0, 2, 4])
    expect([...range(5, 0, -1)]).toEqual([5, 4, 3, 2, 1])
    expect([...range(-3)]).toEqual([])
  })

  it('src/itertools/index.ts #8', () => {
    expect(reduce([1, 2, 3, 4, 5], (x, y) => x + y, 0)).toEqual(15)
  })

  it('src/itertools/index.ts #9', () => {
    expect([...zip([1, 2, 3], ['sugar', 'spice', 'nice'])]).toEqual([
      [1, 'sugar'],
      [2, 'spice'],
      [3, 'nice']
    ])
  })

  it('src/math/index.ts #1', () => {
    const objects = [{ n: 4 }, { n: 2 }, { n: 8 }, { n: 6 }]
    expect(mean(objects, (o) => o.n)).toEqual(5)
  })

  it('src/math/index.ts #2', () => {
    expect(sum([1, 2, 3, 4])).toEqual(10)
    expect(sum([{ n: 1 }, { n: 2 }], (o) => o.n)).toEqual(3)
  })

  it('src/string/index.ts #1', () => {
    expect(sentenceCase('a test')).toEqual('A test')
    expect(sentenceCase('TEST')).toEqual('TEST')
  })

  it('src/string/index.ts #2', () => {
    expect(capitalize('TEST')).toEqual('Test')
  })

  it('src/string/index.ts #3', () => {
    expect(words('lord of the rings')).toEqual(['lord', 'of', 'the', 'rings'])
  })

  it('src/string/index.ts #4', () => {
    expect(join('Lord Of The Rings', '-')).toEqual('Lord-Of-The-Rings')
  })

  it('src/string/index.ts #5', () => {
    expect(isAlnum('alpha1234')).toEqual(true)
    expect(isAlnum('oops!')).toEqual(false)
  })

  it('src/string/index.ts #6', () => {
    expect(isAlpha('alpha1234')).toEqual(false)
    expect(isAlpha('letters')).toEqual(true)
  })

  it('src/string/index.ts #7', () => {
    expect(isNumeric('alpha1234')).toEqual(false)
    expect(isNumeric('1234')).toEqual(true)
  })

  it('src/string/index.ts #8', () => {
    expect(asciify('äÄçÇéÉêPHP-MySQLöÖÐþúÚ')).toEqual('PHP-MySQL')
  })

  it('src/string/index.ts #9', () => {
    expect(removeAccents('Antoine de Saint-Exupéry')).toEqual('Antoine de Saint-Exupery')
  })

  it('src/string/index.ts #10', () => {
    expect(titleCase('lord of the rings')).toEqual('Lord Of The Rings')
  })

  it('src/string/index.ts #11', () => {
    expect(camelCase('Equipment class name')).toEqual('equipmentClassName')
  })

  it('src/string/index.ts #12', () => {
    expect(pascalCase('equipment class name')).toEqual('EquipmentClassName')
  })

  it('src/string/index.ts #13', () => {
    expect(snakeCase('Equipment Class Name')).toEqual('equipment_class_name')
  })

  it('src/string/index.ts #14', () => {
    expect(kebabCase('Equipment Class Name')).toEqual('equipment-class-name')
    expect(kebabCase('equipment_class_name')).toEqual('equipment-class-name')
  })

  it('src/string/index.ts #15', () => {
    expect(slugify('Antoine de Saint-Exupéry')).toEqual('Antoine-de-Saint-Exupery')
  })
})
