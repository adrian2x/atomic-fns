import assert from 'assert'
import { reversed, sorted, zip } from '../src/itertools.js'

function cb() {}

describe('operators', () => {
  it('reversed', () => {
    let arr = [4, 7, 1, 9]
    let reverse = reversed(arr)
    arr.reverse()
    assert.deepEqual(arr, reverse)
  })

  it('sorted', () => {
    let arr = [4, 7, 1, 9]
    let sort = sorted(arr)
    arr.sort()
    assert.deepEqual(sort, arr)
  })

  it('zip', () => {
    let users1 = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    let users2 = [
      { user: 'fred', age: 40, active: false },
      { user: 'barney', age: 36, active: true }
    ]
    let zipped = zip(users1, users2)
    let results = [] as any
    for (const t of zipped) {
      results.push(t)
    }
    assert(results[0][0] === users1[0])
    assert(results[0][1] === users2[0])
    assert(results[1][0] === users1[1])
    assert(results[1][1] === users2[1])
  })
})
