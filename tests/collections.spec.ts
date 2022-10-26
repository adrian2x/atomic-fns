import assert from 'assert'
import {
  clone,
  compact,
  count,
  difference,
  filter,
  find,
  findRight,
  flatten,
  forEach,
  groupBy,
  intersection,
  merge,
  omit,
  pick,
  remove,
  sortedUniq,
  union,
  uniq
} from '../core/collections/index.js'

describe('collections', () => {
  it('compact', () => {
    let filtered = compact([0, 1, false, 2, '', 3])
    assert.deepEqual(filtered, [1, 2, 3])
    assert.deepEqual(compact({ a: 1, b: undefined, c: false, d: [] }), { a: 1 })
  })

  it('count', () => {
    let counters = count([0, 1, false, 2, '', 3], (x) => !!x)
    assert(counters['true'] === 3)
    assert(counters['false'] === 3)
  })

  it('clone array', () => {
    let arr = [4, 7, 1, 9]
    assert.deepEqual(clone(arr), arr)
    let target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(clone(target), target)
  })

  it('clone object', () => {
    let target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(clone(target), target)
  })

  it('difference', () => {
    let a = [1, 2, 5]
    let b = [3, 4, 5]
    assert.deepEqual(sortedUniq(difference(a, b)), [1, 2, 3, 4])
  })

  it('intersection', () => {
    let a = [1, 2, 5]
    let b = [3, 4, 5]
    assert.deepEqual([...intersection(a, b)], [5])
  })

  it('union', () => {
    let a = [1, 2, 5]
    let b = [3, 4, 5]
    assert.deepEqual(sortedUniq(union(a, b)), [1, 2, 3, 4, 5])
  })

  it('filter', () => {
    assert(filter(null) == undefined)
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert.deepEqual(
      filter(users, (o) => o.active),
      [users[0]]
    )
  })

  it('filter matches', () => {
    assert(filter(null) == undefined)
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert.deepEqual(filter(users, { age: 36 }), [users[0]])
  })

  it('filter property', () => {
    assert(filter(null) == undefined)
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert.deepEqual(filter(users, 'active'), [users[0]])
  })

  it('find', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert(find(users, (o) => o.active) === users[0])
  })

  it('find matches', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert(find(users, { age: 36 }) === users[0])
  })

  it('find property', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert(find(users, 'active') === users[0])
  })

  it('findRight', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false },
      { user: 'barney', age: 36, active: true }
    ]
    assert(findRight(users, { age: 36 }) === users[2])
  })

  it('findRight matches', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false },
      { user: 'barney', age: 36, active: true }
    ]
    assert(findRight(users, { age: 36 }) === users[2])
  })

  it('findRight property', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false },
      { user: 'barney', age: 36, active: true }
    ]
    assert(findRight(users, 'active') === users[2])
  })

  it('forEach', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    let result = [] as any
    forEach(users, (value, key) => result.push([key, value]))
    assert.deepEqual(
      result,
      users.map((x, i) => [i, x])
    )
  })

  it('forEach object key', () => {
    let target = { user: 'fred', age: 40, active: false }
    let objs = []
    // @ts-expect-error
    forEach(target, (value, key) => objs.push([key, value]))
    assert.deepEqual(objs, Object.entries(target))
  })

  it('flatten Array', () => {
    let data = flatten([1, 2, [3, 4], 5])
    assert.deepEqual(data, [1, 2, 3, 4, 5])
  })

  it('flatten Array deep', () => {
    let data = flatten([1, 2, [3, [4]], [5]], true)
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

  it('merge', () => {
    let object = {
      a: [{ b: 2 }, { d: 4 }]
    }
    let other = {
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
    let target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(pick(target, ['user']), { user: 'fred' })
    assert.deepEqual(
      pick(target, (x) => x >= 40),
      { age: 40 }
    )
  })

  it('pickBy', () => {
    let target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(
      pick(target, (x) => x >= 40),
      { age: 40 }
    )
  })

  it('omit', () => {
    let target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(omit(target, ['age', 'active']), { user: 'fred' })
  })

  it('omitBy', () => {
    let target = { user: 'fred', age: 40, active: false }
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
    let arr = [4, 7, 1, 9, 1, 7, 4]
    let sort = sortedUniq(arr)
    assert.deepEqual(sort, [1, 4, 7, 9])
  })

  it('uniq', () => {
    let arr = [4, 7, 1, 1, 9, 4, 7]
    let distinct = uniq(arr)
    assert.deepEqual(distinct, [4, 7, 1, 9])
  })

  it('uniqBy', () => {
    let arr = [4, 7, 1, 1, 9, 4, 7]
    let distinct = uniq(arr, (x) => x * 2)
    assert.deepEqual(distinct, [8, 14, 2, 18])
  })
})
