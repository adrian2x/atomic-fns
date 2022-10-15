import assert from 'assert'
import { list } from '../src/globals.js'
import { reversed, sort, sorted, times, zip } from '../src/itertools.js'

function cb() {}

describe('operators', () => {
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

  it('times', () => {
    let arr = list(times(5, (x) => x))
    assert.deepEqual(arr, [0, 1, 2, 3, 4])
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
