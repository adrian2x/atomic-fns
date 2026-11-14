import assert from 'node:assert'
import {
  accumulate,
  all,
  any,
  chain,
  contains,
  dropWhile,
  enumerate,
  first,
  flatMap,
  icompact,
  ifilter,
  iflatten,
  imap,
  islice,
  itake,
  partition,
  range,
  reduce,
  reversed,
  sort,
  sorted,
  take,
  takeWhile,
  times,
  zip
} from '../src/itertools/index.js'
import { max } from '../src/math/index.js'

const Falsy = (x) => !x

describe('operators', () => {
  it('accumulate', () => {
    assert.deepEqual([...accumulate([1, 2, 3, 4])], [1, 3, 6, 10])
    assert.deepEqual(
      [...accumulate([3, 4, 6, 2, 1, 9, 0, 7, 5, 8], (x, y) => max([x, y]))],
      [3, 4, 6, 6, 6, 9, 9, 9, 9, 9]
    )
  })

  it('accumulate with initial', () => {
    const add = (x, y) => x + y
    assert.deepEqual([...accumulate([1, 2, 3], add, 10)], [10, 11, 13, 16])
    assert.deepEqual([...accumulate([1, 2, 3], add, 0)], [0, 1, 3, 6])
    assert.deepEqual([...accumulate([], add, 10)], [10])
    assert.deepEqual([...accumulate([1, 2, 3], add, null)], [1, 3, 6])
    assert.deepEqual([...accumulate([], add)], [])
  })

  it('all', () => {
    assert(all([1, true, [], 'test', {}]))
    assert(!all([[], {}, '']))
    assert(all<any>([false, 0, '', null, undefined, NaN], Falsy))
  })

  it('any', () => {
    assert(any([1, true, [], 'test', {}]))
    assert(!any([0, false, '']))
    assert(any([0, false, ''], Falsy))
  })

  it('chain', () => {
    let it = chain([1, 3, 5], [2, 4, 6])
    assert.deepEqual([...it], [1, 3, 5, 2, 4, 6])
  })

  it('contains', () => {
    assert(contains([4, 7, 1, 9], 1))
    assert(!contains([4, 7, 1, 9], NaN))
  })

  it('contains searches the values of a plain object', () => {
    assert(contains({ a: 1, b: 2 }, 1))
    assert(!contains({ a: 1, b: 2 }, 3))
    assert(!contains({ a: 1, b: 2 }, 'a'))
    assert(!contains({}, 1))
  })

  it('contains still iterates a class instance', () => {
    class Bag {
      hidden = 1;
      [Symbol.iterator] = () => [2][Symbol.iterator]()
    }
    assert(contains(new Bag(), 2))
    assert(!contains(new Bag(), 1))
  })

  it('dropWhile', () => {
    let it = dropWhile([false, 0, '', true, '', []], Falsy)
    assert.deepEqual([...it], [true, '', []])
  })

  it('dropWhile stops at the end of the iterable', () => {
    const seen = []
    const dropAll = (x) => {
      seen.push(x)
      assert(seen.length <= 2)
      return x !== 5
    }
    assert.deepEqual([...dropWhile([1, 2], dropAll)], [])
    assert.deepEqual(seen, [1, 2])
    assert.deepEqual([...dropWhile([{ a: 1 }], (x) => x.a)], [])
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

  it('flatMap', () => {
    assert.deepEqual(
      [
        ...flatMap([
          [1, 2],
          [3, 4]
        ])
      ],
      [1, 2, 3, 4]
    )
    assert.deepEqual(
      [
        ...flatMap(
          [
            [1, 2],
            [3, 4]
          ],
          ([x, y]) => [x * 2, y * 2]
        )
      ],
      [2, 4, 6, 8]
    )
  })

  it('flatMap yields a non-iterable result as is', () => {
    assert.deepEqual([...flatMap([1, 2], (x) => x * 2)], [2, 4])
    assert.deepEqual([...flatMap([1, 2], (x) => (x === 1 ? [x, x] : x))], [1, 1, 2])
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

  it('islice stops at stop', () => {
    assert.deepEqual([...islice([1, 2, 3], 0, 0)], [])
    assert.deepEqual(take(1, islice(range(Infinity), 0, 0)), [])
    assert.deepEqual([...islice(range(10), 2, 5, 2)], [2, 4])
    assert.deepEqual([...islice([1, 2, 3, 4, 5], 0, 5, 2)], [1, 3, 5])
    assert.deepEqual([...islice(range(10), 0, 10, 3)], [0, 3, 6, 9])
  })

  it('itake', () => {
    let it = itake(3, [false, 0, '', true, '', []])
    assert.deepEqual([...it], [false, 0, ''])
  })

  it('take', () => {
    let it = take(3, [false, 0, '', true, '', []])
    assert.deepEqual(it, [false, 0, ''])
  })

  it('partition', () => {
    let [A, B] = partition([false, 0, '', true, '', []], Falsy)
    assert.deepEqual(A, [false, 0, '', ''])
    assert.deepEqual(B, [true, []])
  })

  it('range', () => {
    assert.deepEqual([...range(0)], [])
    assert.deepEqual([...range(4)], [0, 1, 2, 3])
    assert.deepEqual([...range(-4)], [0, -1, -2, -3])
    assert.deepEqual([...range(0, -4, -1)], [0, -1, -2, -3])
    assert.deepEqual([...range(1, 5)], [1, 2, 3, 4])
    assert.deepEqual([...range(0, 20, 5)], [0, 5, 10, 15])
  })

  it('reduce', () => {
    assert(reduce([1, 2, 3, 4, 5], (x, y) => x + y, 0) === 15)
  })

  it('reduce reads an iterable with a plain iterator', () => {
    const countdown = {
      [Symbol.iterator]() {
        let n = 3
        return { next: () => (n > 0 ? { value: n--, done: false } : { value: 0, done: true }) }
      }
    }
    assert(reduce(countdown, (x, y) => x + y) === 6)
    assert(reduce(countdown, (x, y) => x + y, 10) === 16)
    assert(max(countdown) === 3)
  })

  it('reduce closes the iterator when the reducer throws', () => {
    let closed = false
    const numbers = (function* () {
      try {
        yield* [1, 2, 3]
      } finally {
        closed = true
      }
    })()
    assert.throws(() =>
      reduce(numbers, () => {
        throw new Error('stop')
      })
    )
    assert(closed)
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

  it('sorted honors the reverse flag', () => {
    const byValue = (x, y) => x - y
    assert.deepEqual(sorted([3, 1, 2], false), [1, 2, 3])
    assert.deepEqual(sorted([3, 1, 2], true, byValue), [3, 2, 1])
    assert.deepEqual(sorted([3, 1, 2], false, byValue), [1, 2, 3])
    assert.deepEqual(sorted([3, 1, 2], false, true), [3, 2, 1])
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

  it('zip yields nothing without iterables', () => {
    assert.deepEqual(take(1, zip()), [])
  })

  it('icompact keeps functions, Dates and RegExps', () => {
    const values = [() => 1, new Date(0), /x/]
    assert.deepEqual([...icompact(values)], values)
  })
})
