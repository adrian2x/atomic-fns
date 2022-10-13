import assert from 'assert'
import {
  filter,
  find,
  forEach,
  findRight,
  flatten,
  map,
  contains,
  flattenObj,
  clone,
  pick,
  omit,
  uniq,
  sortedUniq
} from '../src/collections.js'

function cb() {}

describe('operators', () => {
  it('contains', () => {
    assert(contains([4, 7, 1, 9], 1))
    assert(!contains([4, 7, 1, 9], NaN))
  })

  it('clone', () => {
    let arr = [4, 7, 1, 9]
    assert.deepEqual(clone(arr), arr)
    let target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(clone(target), target)
  })

  it('filter', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert.deepEqual(filter({ age: 36 }, users), [users[0]])
    assert.deepEqual(
      filter((o) => o.active, users),
      [users[0]]
    )
    assert.deepEqual(filter('active', users), [users[0]])
  })

  it('find', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    assert(find({ age: 36 }, users) === users[0])
    assert(find((o) => o.active, users) === users[0])
    assert(find('active', users) === users[0])
  })

  it('findRight', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false },
      { user: 'barney', age: 36, active: true }
    ]
    assert(findRight({ age: 36 }, users) === users[2])
    assert(findRight((o) => o.active, users) === users[2])
    assert(findRight('active', users) === users[2])
  })

  it('forEach', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    let result = [] as any[]
    forEach((value, key) => {
      result.push([key, value])
    }, users)
    assert.deepEqual(
      result,
      users.map((x, i) => [i, x])
    )
  })

  it('forEach object key', () => {
    let target = { user: 'fred', age: 40, active: false }
    let objs = [] as any[]
    forEach((value, key) => {
      objs.push([key, value])
    }, target)
    assert.deepEqual(objs, Object.entries(target))
  })

  it('flattenArray', () => {
    let data = flatten([1, 2, [3, 4], 5])
    assert.deepEqual(data, [1, 2, 3, 4, 5])
    data = flatten([1, 2, [3, [4]], [5]], true)
    assert.deepEqual(data, [1, 2, 3, 4, 5])
  })

  it('flattenObj', () => {
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
    assert.deepEqual(flattenObj(data), {
      'dates.expiry_date': '30 sep 2018',
      'dates.available': '30 sep 2017',
      'dates.min_contract_period[0].id': 1,
      'dates.min_contract_period[0].name': '1 month',
      'price.currency': 'RM',
      'price.value': 1500
    })
  })

  it('map', () => {
    let target = { user: 'fred', age: 40, active: false }
    let getEntries = (value, key) => [key, value]
    assert.deepEqual(map(getEntries, target), Object.entries(target))
  })

  it('pick', () => {
    let target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(pick(target, ['user']), { user: 'fred' })
    assert.deepEqual(
      pick(target, (x) => x >= 40),
      { age: 40 }
    )
  })

  it('omit', () => {
    let target = { user: 'fred', age: 40, active: false }
    assert.deepEqual(omit(target, ['age', 'active']), { user: 'fred' })
    assert.deepEqual(
      omit(target, (x) => !x),
      { user: 'fred', age: 40 }
    )
  })

  it('sortedUniq', () => {
    let arr = [4, 7, 1, 9, 1, 7, 4]
    let sort = sortedUniq(arr)
    assert.deepEqual(sort, [1, 4, 7, 9])
  })

  it('uniq', () => {
    let arr = [4, 7, 1, 1, 9, 4, 7]
    let sort = uniq(arr)
    assert.deepEqual(sort, [1, 4, 7, 9])
    sort = uniq(arr, (x) => x * 2)
    assert.deepEqual(sort, [2, 8, 14, 18])
  })
})
