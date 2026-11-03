import { describe, it } from 'vitest'
import assert from 'assert'
import {
  binarySearch,
  bisect,
  bisectLeft,
  clone,
  compact,
  count,
  difference,
  filter,
  find,
  findLast,
  flatten,
  forEach,
  groupBy,
  insort,
  insortLeft,
  intersection,
  map,
  merge,
  omit,
  pick,
  remove,
  sortedUniq,
  union,
  uniq
} from '../src/collections/index.js'

describe('collections', () => {
  it('compact', () => {
    const filtered = compact([0, 1, false, 2, '', 3])
    assert.deepEqual(filtered, [1, 2, 3])
    assert.deepEqual(compact({ a: 1, b: undefined, c: false, d: [] }), { a: 1 })
  })

  it('count', () => {
    const counters = count([0, 1, false, 2, '', 3], (x) => !!x)
    assert(counters['true'] === 3)
    assert(counters['false'] === 3)
    assert.deepEqual(
      count(['one', 'two', 'three'], (x) => x.length),
      { '3': 2, '5': 1 }
    )
  })

  it('clone array', () => {
    const arr = [4, 7, 1, 9]
    assert.deepEqual(clone(arr), arr)
    const target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(clone(target), target)
  })

  it('clone object', () => {
    const target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(clone(target), target)
  })

  it('difference', () => {
    const a = [1, 2, 5]
    const b = [3, 4, 5]
    assert.deepEqual(sortedUniq(difference(a, b)), [1, 2, 3, 4])
  })

  it('intersection', () => {
    const a = [1, 2, 5]
    const b = [3, 4, 5]
    assert.deepEqual([...intersection(a, b)], [5])
  })

  it('union', () => {
    const a = [1, 2, 5]
    const b = [3, 4, 5]
    assert.deepEqual(sortedUniq(union(a, b)), [1, 2, 3, 4, 5])
  })

  it('filter', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert.deepEqual(
      filter(users, (o) => o.active),
      [users[0]]
    )
  })

  it('filter matches', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert.deepEqual(filter(users, { age: 36 }), [users[0]])
  })

  it('filter property', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert.deepEqual(filter(users, 'active'), [users[0]])
  })

  it('find', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert(find(users, (o) => o.active) === users[0])
  })

  it('find matches', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert(find(users, { age: 40 }) === users[1])
  })

  it('find Object', () => {
    const users = {
      '0': { user: 'barney', age: 36, active: true },
      '1': { user: 'fred', age: 40, active: false }
    }
    assert(find(users, { active: false }) === users['1'])
  })

  it('findLast', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false },
      { user: 'barney', age: 36, active: true }
    ]
    assert(findLast(users, { age: 36 }) === users[2])
  })

  it('findLast matches', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false },
      { user: 'barney', age: 36, active: true }
    ]
    assert(findLast(users, { age: 36 }) === users[2])
  })

  it('forEach', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    const result = [] as any
    forEach(users, (value, key) => result.push([key, value]))
    assert.deepEqual(
      result,
      users.map((x, i) => [i, x])
    )
  })

  it('forEach object key', () => {
    const target = { user: 'fred', age: 40, active: false }
    const objs = [] as any[]
    forEach(target, (value, key) => objs.push([key, value]))
    assert.deepEqual(objs, Object.entries(target))
  })

  it('flatten Array', () => {
    const data = flatten([1, 2, [3, 4], 5])
    assert.deepEqual(data, [1, 2, 3, 4, 5])
  })

  it('flatten Array deep', () => {
    const data = flatten([1, 2, [3, [4]], [5]], true)
    assert.deepEqual(data, [1, 2, 3, 4, 5])
  })

  it('flatten Object', () => {
    const data = {
      dates: {
        expiry_date: '30 sep 2018',
        available: '30 sep 2017',
        min_contract_period: [
          {
            id: 1,
            name: '1 month'
          }
        ]
      },
      price: {
        currency: 'RM',
        value: 1500
      }
    }
    assert.deepEqual(flatten(data), {
      'dates.expiry_date': '30 sep 2018',
      'dates.available': '30 sep 2017',
      'dates.min_contract_period[0].id': 1,
      'dates.min_contract_period[0].name': '1 month',
      'price.currency': 'RM',
      'price.value': 1500
    })
  })

  it('groupBy', () => {
    assert.deepEqual(groupBy([6.1, 4.2, 6.3], Math.floor), { '4': [4.2], '6': [6.1, 6.3] })
  })

  it('map', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    const square = (x) => x * x
    assert.deepEqual(map([4, 8], square), [16, 64])
    assert.deepEqual(map({ a: 4, b: 8 }, square), [16, 64])
    assert.deepEqual(map(users, 'user'), ['barney', 'fred'])
  })

  it('merge', () => {
    const object = {
      a: [{ b: 2 }, { d: 4 }]
    }
    const other = {
      a: [{ c: 3 }, { e: 5 }],
      foo: null,
      bar: true,
      noop: undefined
    }
    assert.deepEqual(merge(object, other), {
      a: [
        { b: 2, c: 3 },
        { d: 4, e: 5 }
      ],
      foo: null,
      bar: true
    })
  })

  it('pick', () => {
    const target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(pick(target, ['user']), { user: 'fred' })
    assert.deepEqual(
      pick(target, (x) => x >= 40),
      { age: 40 }
    )
  })

  it('pickBy', () => {
    const target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(
      pick(target, (x) => x >= 40),
      { age: 40 }
    )
  })

  it('omit', () => {
    const target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(omit(target, ['age', 'active']), { user: 'fred' })
  })

  it('omitBy', () => {
    const target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(
      omit(target, (x) => !x),
      { user: 'fred', age: 40 }
    )
  })

  it('remove', () => {
    assert.deepEqual(remove([1, 2, 3, 4], 1), [2, 3, 4])
    assert.deepEqual(remove([1, 2, 3, 4], [3, 4]), [1, 2])
  })

  it('removeBy', () => {
    assert.deepEqual(
      remove([1, 2, 3, 4], (x) => x % 2 === 0),
      [1, 3]
    )
  })

  it('sortedUniq', () => {
    const arr = [4, 7, 1, 9, 1, 7, 4]
    const sort = sortedUniq(arr)
    assert.deepEqual(sort, [1, 4, 7, 9])
  })

  it('uniq', () => {
    const arr = [4, 7, 1, 1, 9, 4, 7]
    const distinct = uniq(arr)
    assert.deepEqual(distinct, [4, 7, 1, 9])
  })

  it('uniqBy', () => {
    const arr = [4, 7, 1, 1, 9, 4, 7]
    const distinct = uniq(arr, (x) => x * 2)
    assert.deepEqual(distinct, [8, 14, 2, 18])
  })

  it('binarySearch', () => {
    const arr = [1, 1, 4, 4, 7, 7, 9]
    assert(binarySearch(arr, 1) === 1)
    assert(binarySearch(arr, 4) === 3)
    assert(binarySearch(arr, 7) === 5)
    assert(binarySearch(arr, 9) === 6)
  })

  it('bisect', () => {
    assert(bisect([1], 2) === 1)
    const arr = [1, 1, 4, 4, 7, 7, 9]
    assert(bisect(arr, 1) === 2)
    assert(bisect(arr, 4) === 4)
    assert(bisect(arr, 7) === 6)
    assert(bisect(arr, 9) === 7)
  })

  it('insort', () => {
    assert.deepEqual(insort([1], 2), [1, 2])
    assert.deepEqual(insort([1, 1, 4, 4, 7, 7, 9], 5), [1, 1, 4, 4, 5, 7, 7, 9])
    assert.deepEqual(insort([1, 1, 4, 4, 7, 7, 9], 10), [1, 1, 4, 4, 7, 7, 9, 10])
  })

  it('bisectLeft', () => {
    assert(bisectLeft([1], 2) === 1)
    const arr = [1, 1, 4, 4, 7, 7, 9]
    assert(bisectLeft(arr, 1) === 0)
    assert(bisectLeft(arr, 4) === 2)
    assert(bisectLeft(arr, 7) === 4)
    assert(bisectLeft(arr, 9) === 6)
  })

  it('insortLeft', () => {
    assert.deepEqual(insortLeft([1], 2), [1, 2])
    assert.deepEqual(insortLeft([1, 1, 4, 4, 7, 7, 9], 5), [1, 1, 4, 4, 5, 7, 7, 9])
    assert.deepEqual(insortLeft([1, 1, 4, 4, 7, 7, 9], 10), [1, 1, 4, 4, 7, 7, 9, 10])
  })
})
