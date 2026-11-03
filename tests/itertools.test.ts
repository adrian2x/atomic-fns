import { describe, expectTypeOf, it } from 'vitest'
import assert from 'assert'
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
import { decimal } from '../src/decimal/index.js'
import { ValueError } from '../src/globals/index.js'
import { expectFast } from './helpers/perf.js'

const Falsy = (x: unknown) => !x

function* infiniteCounter() {
  let i = 0
  for (;;) yield i++
}

describe('itertools', () => {
  it('accumulate', () => {
    assert.deepEqual([...accumulate([1, 2, 3, 4])], [1, 3, 6, 10])
    assert.deepEqual(
      [...accumulate([3, 4, 6, 2, 1, 9, 0, 7, 5, 8], (x, y) => max([x as number, y]))],
      [3, 4, 6, 6, 6, 9, 9, 9, 9, 9]
    )
  })

  it('SPEC-R46 accumulate with initial yields seed then folds', () => {
    assert.deepEqual([...accumulate([1, 2, 3], (a, b) => (a as number) + b, 10)], [10, 11, 13, 16])
    assert.deepEqual([...accumulate([], (a, b) => (a as number) + (b as number), 10)], [10])
    assert.deepEqual([...accumulate([])], [])
  })

  it('all', () => {
    assert(all([1, true, [], 'test', {}]))
    assert(!all([[], {}, '']))
    assert(all<unknown>([false, 0, '', null, undefined, NaN], Falsy))
  })

  it('any', () => {
    assert(any([1, true, [], 'test', {}]))
    assert(!any([0, false, '']))
    assert(any([0, false, ''], Falsy))
  })

  it('chain', () => {
    const it = chain([1, 3, 5], [2, 4, 6])
    assert.deepEqual([...it], [1, 3, 5, 2, 4, 6])
  })

  it('contains', () => {
    assert(contains([4, 7, 1, 9], 1))
    assert(!contains([4, 7, 1, 9], NaN))
  })

  it('SPEC-R49 contains uses eq for arrays and object values, substring for strings', () => {
    assert.equal(contains({ a: 1, b: 2 }, 1), true)
    assert.equal(contains('abcd', 'bc'), true)
    assert.equal(contains([decimal(1)], 1), true)
    assert.equal(contains(null, 1), false)
  })

  it('contains and sorted iterate user iterable classes before plain-object fallback', () => {
    class Box {
      constructor(private readonly items: number[]) {}
      [Symbol.iterator]() {
        return this.items[Symbol.iterator]()
      }
    }
    const box = new Box([3, 1, 2])
    assert.equal(contains(box, 1), true)
    assert.deepEqual(sorted(box), [1, 2, 3])
  })

  it('dropWhile', () => {
    const it = dropWhile([false, 0, '', true, '', []], Falsy)
    assert.deepEqual([...it], [true, '', []])
  })

  it('SPEC-R45 dropWhile terminates when source ends before predicate fails', () => {
    expectFast(() => {
      assert.deepEqual([...dropWhile([1, 2], () => true)], [])
    }, 250)
    assert.deepEqual([...dropWhile([{ a: 1 }], (o) => o.a)], [])
  })

  it('enumerate', () => {
    const iter = enumerate(['foo', 'bar', 'baz'])
    const values = [...iter]
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
    const empty: number[] = []
    assert(first(empty) === undefined)
  })

  it('flatMap', () => {
    assert.deepEqual(
      [
        ...flatMap(
          [
            [1, 2],
            [3, 4]
          ],
          (x) => x
        )
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

  it('SPEC-R52 flatMap string result throws TypeError', () => {
    assert.throws(() => [...flatMap([1], () => 'ab')], TypeError)
  })

  it('icompact', () => {
    const it = icompact([false, 0, '', true, '', []])
    assert.deepEqual([...it], [true])
  })

  it('SPEC-R40 icompact keeps functions, Decimal, IntlDate, private-field instances', async () => {
    const { decimal } = await import('../src/decimal/index.js')
    const { IntlDate } = await import('../src/i18n/date/index.js')
    function fn() {
      return 1
    }
    class Priv {
      #secret = 1
      value() {
        return this.#secret
      }
    }
    assert.deepEqual([...icompact([fn])], [fn])
    assert.equal([...icompact([decimal(0)])].length, 1)
    assert.equal([...icompact([new IntlDate()])].length, 1)
    assert.equal([...icompact([new Priv()])].length, 1)
    assert.deepEqual(
      [...icompact([false, 0, -0, 0n, '', null, undefined, NaN, [], {}, new Map(), new Set()])],
      []
    )
  })

  it('ifilter', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    const it = ifilter(users, (x) => !x.active)
    assert.deepEqual([...it], [users[1]])
  })

  it('iflatten', () => {
    const it = iflatten([
      [0, 1],
      [2, 3]
    ])
    assert.deepEqual([...it], [0, 1, 2, 3])
  })

  it('imap', () => {
    const it = imap([0, 1, 2, 3], (x) => 2 ** x)
    assert.deepEqual([...it], [1, 2, 4, 8])
  })

  it('SPEC-R52 imap with parseInt passes only the value', () => {
    assert.deepEqual([...imap(['10', '10'], parseInt)], [10, 10])
  })

  it('islice', () => {
    assert.deepEqual([...islice([1, 2, 3], 1)], [2, 3])
    assert.deepEqual([...islice([1, 2, 3, 4], 2)], [3, 4])
    assert.deepEqual([...islice([1, 2, 3, 4], 1, 3)], [2, 3])
    assert.deepEqual([...islice([1, 2, 3, 4, 5], 0, 4)], [1, 2, 3, 4])
    assert.deepEqual([...islice([1, 2, 3, 4, 5], 0, 4, 2)], [1, 3])
  })

  it('SPEC-R47 islice table and early stop', () => {
    assert.deepEqual([...islice(range(10), 1, 4, 2)], [1, 3])
    assert.deepEqual([...islice(range(10), 0, 5, 3)], [0, 3])
    assert.deepEqual([...islice(range(10), 0, 0)], [])
    assert.deepEqual([...islice(infiniteCounter(), 0, 3)], [0, 1, 2])
  })

  it('SPEC-R47 islice rejects negative bounds and non-positive step', () => {
    assert.throws(() => [...islice([1], -1)], ValueError)
    assert.throws(() => [...islice([1], 0, -1)], ValueError)
    assert.throws(() => [...islice([1], 0, 1, 0)], ValueError)
    assert.throws(() => [...islice([1], 0, 1, -1)], ValueError)
    assert.throws(() => [...islice([1], 2, 1)], ValueError)
  })

  it('islice validates arguments eagerly at call time', () => {
    assert.throws(() => islice([1], -1), ValueError)
    assert.throws(() => islice([1], 0, -1), ValueError)
    assert.throws(() => islice([1], 0, 1, 0), ValueError)
    assert.throws(() => islice([1], 2, 1), ValueError)
  })

  it('islice does not read past stop', () => {
    const it = [0, 1, 2, 3, 4, 5].values()
    assert.deepEqual([...islice(it, 0, 3)], [0, 1, 2])
    assert.equal(it.next().value, 3)
  })

  it('itake', () => {
    const it = itake(3, [false, 0, '', true, '', []])
    assert.deepEqual([...it], [false, 0, ''])
  })

  it('SPEC-R52 itake and take RangeError on negative or NaN', () => {
    assert.throws(() => [...itake(-1, [1])], RangeError)
    assert.throws(() => [...itake(NaN, [1])], RangeError)
    assert.throws(() => take(-1, [1]), RangeError)
  })

  it('take', () => {
    const it = take(3, [false, 0, '', true, '', []])
    assert.deepEqual(it, [false, 0, ''])
  })

  it('partition', () => {
    const [A, B] = partition([false, 0, '', true, '', []], Falsy)
    assert.deepEqual(A, [false, 0, '', ''])
    assert.deepEqual(B, [true, []])
  })

  it('range', () => {
    assert.deepEqual([...range(0)], [])
    assert.deepEqual([...range(4)], [0, 1, 2, 3])
    assert.deepEqual([...range(0, -4, -1)], [0, -1, -2, -3])
    assert.deepEqual([...range(1, 5)], [1, 2, 3, 4])
    assert.deepEqual([...range(0, 20, 5)], [0, 5, 10, 15])
  })

  it('SPEC-R51 range table, step 0 and NaN', () => {
    assert.deepEqual([...range(-3)], [])
    assert.equal([...range(0, 1, 0.1)].length, 10)
    assert.deepEqual([...range(5, 0, -1)], [5, 4, 3, 2, 1])
    assert.throws(() => [...range(0, 5, 0)], RangeError)
    assert.throws(() => [...range(NaN)], /range bounds must be numbers/)
    assert.throws(() => [...range(0, NaN)], /range bounds must be numbers/)
    const lazy = range(0, Infinity)
    assert.deepEqual([...itake(3, lazy)], [0, 1, 2])
  })

  it('range with fractional step never includes stop', () => {
    const up = [...range(1, 1.3, 0.1)]
    assert.equal(up.length, 3)
    assert.ok(up.every((v) => v < 1.3))
    assert.equal([...range(0, 1, 0.1)].length, 10)
    const down = [...range(1.3, 1, -0.1)]
    assert.ok(down.every((v) => v > 1))
  })

  it('reduce', () => {
    assert(reduce([1, 2, 3, 4, 5], (x, y) => x + y, 0) === 15)
  })

  it('SPEC-R52 reduce empty TypeError and index base without initial', () => {
    assert.throws(() => reduce([] as number[], (a, b) => a + b), TypeError)
    assert.equal(
      reduce([1, 2, 3], (acc, _v, i) => acc + i),
      4
    )
  })

  it('reversed', () => {
    const arr = [3, 2, 1]
    const reverse = reversed(arr)
    arr.reverse()
    assert.deepEqual(arr, reverse)
  })

  it('reversed rejects length-driven array-likes before allocating', () => {
    const evil = JSON.parse('{"length":4294967295}') as never
    expectFast(() => {
      assert.throws(() => reversed(evil), TypeError, 'expected an iterable')
    }, 250)
  })

  it('sort', () => {
    const arr = [3, 2, 1]
    assert.deepEqual(sort(arr), [1, 2, 3])
  })

  it('sort reversed', () => {
    const arr = [3, 1, 2]
    assert.deepEqual(sort(arr, true), [3, 2, 1])
  })

  it('sorted', () => {
    const arr = [3, 2, 1]
    assert.deepEqual(sorted(arr), [1, 2, 3])
    assert.deepEqual(sorted([3, 1, 2], true), [3, 2, 1])
  })

  it('sorted by key', () => {
    const users = [
      { user: 'fred', age: 40 },
      { user: 'barney', age: 36 }
    ]
    assert.deepEqual(
      sorted(users, (u) => u.age),
      [
        { user: 'barney', age: 36 },
        { user: 'fred', age: 40 }
      ]
    )
    assert.deepEqual(
      sorted(users, (u) => u.age, true),
      [
        { user: 'fred', age: 40 },
        { user: 'barney', age: 36 }
      ]
    )
  })

  it('sorted with custom compare', () => {
    const users = [
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

  it('sorted compare receives keys, not items', () => {
    const users = [
      { user: 'fred', age: 40 },
      { user: 'barney', age: 36 }
    ]
    const byAge = [
      { user: 'barney', age: 36 },
      { user: 'fred', age: 40 }
    ]
    assert.deepEqual(sorted(users, { key: (u) => u.age, compare: (a, b) => a - b }), byAge)
    assert.deepEqual(
      sorted<(typeof users)[number], number>(
        users,
        (u) => u.age,
        false,
        (a, b) => a - b
      ),
      byAge
    )
  })

  it('SPEC-R48 sorted overloads, stability and numeric comparator', () => {
    assert.deepEqual(sorted([3, 1, 2], false), [1, 2, 3])
    assert.deepEqual(
      sorted([3, 1, 2], true, (a, b) => a - b),
      [3, 2, 1]
    )
    assert.deepEqual(sorted([3, 1, 2], { reverse: false }), [1, 2, 3])
    assert.deepEqual(sorted([3, 1, 2], { reverse: true, compare: (a, b) => a - b }), [3, 2, 1])

    const items = [
      { k: 1, id: 'a' },
      { k: 1, id: 'b' },
      { k: 0, id: 'c' }
    ]
    assert.deepEqual(
      sorted(items, true, (a, b) => a.k - b.k).map((x) => x.id),
      ['a', 'b', 'c']
    )
  })

  it('SPEC-R48 sorted key fn that throws propagates', () => {
    assert.throws(
      () =>
        sorted([1, 2], () => {
          throw new Error('boom')
        }),
      /boom/
    )
  })

  it('times', () => {
    const arr = [...times(5, (x) => x)]
    assert.deepEqual(arr, [0, 1, 2, 3, 4])
  })

  it('takeWhile', () => {
    let arr = [...takeWhile([1, 2, 3, 4], (x) => x < 4)]
    assert.deepEqual(arr, [1, 2, 3])
    arr = [...takeWhile([1, 2, 3, 4, 5], (x) => x)]
    assert.deepEqual(arr, [1, 2, 3, 4, 5])
  })

  it('zip', () => {
    const users1 = [
      { user: 'barney', age: 36 },
      { user: 'fred', age: 40 }
    ]
    const users2 = [
      { user: 'fred', age: 40 },
      { user: 'barney', age: 36 }
    ]

    const results = [...zip(users1, users2)]

    const [first1, first2] = results[0]
    assert(first1 === users1[0])
    assert(first2 === users2[0])

    const [second1, second2] = results[1]
    assert(second1 === users1[1])
    assert(second2 === users2[1])
  })

  it('SPEC-R50 zip with no arguments yields nothing', () => {
    assert.deepEqual([...zip()], [])
  })

  it('SPEC-R50 zip stops at the shortest finite input', () => {
    assert.deepEqual(
      [...zip(infiniteCounter(), [10, 20])],
      [
        [0, 10],
        [1, 20]
      ]
    )
  })

  it('SPEC-R53 every lazy API returns an Iterator', () => {
    const samples = [
      accumulate([1, 2]),
      chain([1], [2]),
      dropWhile([1, 2], () => false),
      enumerate([1]),
      icompact([1]),
      ifilter([1, 2], (x) => x > 0),
      imap([1], (x) => x),
      iflatten([[1]]),
      flatMap([[1]], (x) => x),
      islice([1, 2, 3], 0, 2),
      itake(1, [1, 2]),
      range(3),
      takeWhile([1], () => true),
      times(1, (i) => i),
      zip([1], [2])
    ]
    for (const result of samples) {
      assert.equal(result instanceof Iterator, true)
      assert.equal(typeof result.map, 'function')
    }
  })
  it('SPEC-R48 (a,b)=>a-b comparators type-check under npm run typecheck', () => {
    const byOptions: number[] = sorted([3, 1, 2], { compare: (a, b) => a - b })
    const byPositional: number[] = sorted([3, 1, 2], true, (a, b) => a - b)
    assert.deepEqual(byOptions, [1, 2, 3])
    assert.deepEqual(byPositional, [3, 2, 1])
  })

  it('positional sorted comparator is typed on keys', () => {
    const users = [
      { name: 'fred', age: 40 },
      { name: 'barney', age: 36 }
    ]
    const byName = sorted(
      users,
      (u) => u.name,
      false,
      (a: string, b: string) => a.localeCompare(b)
    )
    assert.deepEqual(
      byName.map((u) => u.name),
      ['barney', 'fred']
    )
    expectTypeOf(
      sorted(
        users,
        (u) => u.name,
        false,
        (a, b) => a.localeCompare(b)
      )
    ).toEqualTypeOf<{ name: string; age: number }[]>()
  })
})
