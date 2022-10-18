import assert from 'assert'
import { isEmpty } from '../src/globals/index.js'
import {
  all,
  any,
  chain,
  contains,
  dropWhile,
  enumerate,
  first,
  icompact,
  ifilter,
  iflatten,
  imap,
  islice,
  max,
  min,
  range,
  reduce,
  reversed,
  sort,
  sorted,
  sum,
  takeWhile,
  times,
  zip
} from '../src/itertools/index.js'

function cb() {}

describe('operators', () => {
  it('all', () => {
    assert(all([1, true, [], 'test', {}]))
    assert(!all([[], {}, '']))
    assert(all([[], {}, ''], isEmpty))
  })

  it('any', () => {
    assert(any([1, true, [], 'test', {}]))
    assert(!any([0, false, '']))
    assert(any([0, false, ''], (x) => !x))
  })

  it('chain', () => {
    let it = chain([1, 3, 5], [2, 4, 6])
    assert.deepEqual([...it], [1, 3, 5, 2, 4, 6])
  })

  it('contains', () => {
    assert(contains([4, 7, 1, 9], 1))
    assert(!contains([4, 7, 1, 9], NaN))
  })

  it('dropWhile', () => {
    let it = dropWhile([false, 0, '', true, '', []], isEmpty)
    assert.deepEqual([...it], [true, '', []])
  })

  it('enumerate', () => {
    let iter = enumerate(['foo', 'bar', 'baz'])
    let values = [...iter]
    assert.deepEqual(values, [
      [0, 'foo'],
      [1, 'bar'],
      [2, 'baz']
    ])
  })

  it('first', () => {
    assert(first(['foo', 'bar']) === 'foo')
    assert(first([0, 1]) === 0)
    assert(first([1, 1]) === 1)
  })

  it('icompact', () => {
    let it = icompact([false, 0, '', true, '', []])
    assert.deepEqual([...it], [true])
  })

  it('ifilter', () => {
    let users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    let it = ifilter(users, (x) => !x.active)
    assert.deepEqual([...it], [users[1]])
  })

  it('iflatten', () => {
    let it = iflatten([
      [0, 1],
      [2, 3]
    ])
    assert.deepEqual([...it], [0, 1, 2, 3])
  })

  it('imap', () => {
    let it = imap([0, 1, 2, 3], (x) => 2 ** x)
    assert.deepEqual([...it], [1, 2, 4, 8])
  })

  it('islice', () => {
    assert.deepEqual([...islice([1, 2, 3], 1)], [2, 3])
    assert.deepEqual([...islice([1, 2, 3, 4], 2)], [3, 4])
    assert.deepEqual([...islice([1, 2, 3, 4], 1, 3)], [2, 3])
    assert.deepEqual([...islice([1, 2, 3, 4, 5], 0, 4)], [1, 2, 3, 4])
    assert.deepEqual([...islice([1, 2, 3, 4, 5], 0, 4, 2)], [1, 3])
  })

  it('min', () => {
    assert(min([5, 4, 3, 1, 2]) === 1)
  })

  it('max', () => {
    assert(max([7, 9, 3, 11]) === 11)
  })

  it('range', () => {
    assert.deepEqual([...range(4)], [0, 1, 2, 3])
    assert.deepEqual([...range(5, 9)], [5, 6, 7, 8])
    assert.deepEqual([...range(5, 0, -2)], [5, 3, 1])
    assert.deepEqual([...range(-3)], [])
  })

  it('reduce', () => {
    assert(reduce([1, 2, 3, 4, 5], (x, y) => x + y, 0) === 15)
  })

  it('reversed', () => {
    let arr = [3, 2, 1]
    let reverse = reversed(arr)
    arr.reverse()
    assert.deepEqual(arr, reverse)
  })

  it('sort', () => {
    let arr = [3, 2, 1]
    assert.deepEqual(sort(arr), [1, 2, 3])
  })

  it('sort reversed', () => {
    let arr = [3, 1, 2]
    assert.deepEqual(sort(arr, true), [3, 2, 1])
  })

  it('sorted', () => {
    let arr = [3, 2, 1]
    assert.deepEqual(sorted(arr), arr.sort())
    // sorted in reverse
    assert.deepEqual(sorted([3, 1, 2], true), [3, 2, 1])
  })

  it('sorted by key', () => {
    let users = [
      { user: 'fred', age: 40 },
      { user: 'barney', age: 36 }
    ]
    // compare by age key
    assert.deepEqual(
      sorted(users, (u) => u.age),
      [
        { user: 'barney', age: 36 },
        { user: 'fred', age: 40 }
      ]
    )
    // using key and reverse
    assert.deepEqual(
      sorted(users, (u) => u.age, true),
      [
        { user: 'fred', age: 40 },
        { user: 'barney', age: 36 }
      ]
    )
  })

  it('sorted with custom compare', () => {
    let users = [
      { user: 'fred', age: 40 },
      { user: 'barney', age: 36 }
    ]
    assert.deepEqual(
      sorted(users, false, (x, y) => (x.user <= y.user ? -1 : 1)),
      [
        { user: 'barney', age: 36 },
        { user: 'fred', age: 40 }
      ]
    )
  })

  it('sum', () => {
    assert(sum([]) === 0)
    assert(sum([1, 2, 3, 4]) === 10)
    assert(sum([1, 2, 3, 4], 5) === 15)
  })

  it('times', () => {
    let arr = [...times(5, (x) => x)]
    assert.deepEqual(arr, [0, 1, 2, 3, 4])
  })

  it('takeWhile', () => {
    let arr = [...takeWhile([1, 2, 3, 4], (x) => x < 4)]
    assert.deepEqual(arr, [1, 2, 3])
    arr = [...takeWhile([1, 2, 3, 4, 5], (x) => x)]
    assert.deepEqual(arr, [1, 2, 3, 4, 5])
  })

  it('zip', () => {
    let users1 = [
      { user: 'barney', age: 36 },
      { user: 'fred', age: 40 }
    ]
    let users2 = [
      { user: 'fred', age: 40 },
      { user: 'barney', age: 36 }
    ]

    let results = [...zip(users1, users2)]

    let [first1, first2] = results[0]
    assert(first1 === users1[0])
    assert(first2 === users2[0])

    let [second1, second2] = results[1]
    assert(second1 === users1[1])
    assert(second2 === users2[1])
  })
})
