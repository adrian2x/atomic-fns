import assert from 'node:assert'
import { any, times } from '../src/itertools/index.js'
import { choice, random, randomInt, sample, shuffle } from '../src/random/index.js'

const randomArr = () => [...times(100, (i) => randomInt(i, 100))]

const LAST_DRAW = 1 - 2 ** -53

const drawAt = (draw, fn) => {
  const spy = vi.spyOn(Math, 'random').mockReturnValue(draw)
  const value = fn()
  spy.mockRestore()
  return value
}

const countEvenDraws = (draws, fn) => {
  const counts = {}
  for (let i = 0; i < draws; i++) {
    const value = drawAt((i + 0.5) / draws, fn)
    counts[value] = (counts[value] ?? 0) + 1
  }
  return counts
}

describe('random', () => {
  it('choice', () => {
    let arr = randomArr()
    for (let i = 0; i < 100; i++) {
      assert(arr.includes(choice(arr)))
    }
  })

  it('random', () => {
    for (let i = 1; i <= 100; i++) {
      let r = random(0, i)
      assert(0 <= r && r < i)
    }
  })

  it('random stays below max when the draw rounds up to it', () => {
    assert(drawAt(LAST_DRAW, () => random(1e15, 1e15 + 1)) < 1e15 + 1)
    assert(drawAt(0.5, () => random(5, 5)) === 5)
    assert(drawAt(LAST_DRAW, () => random(5, 1)) > 1)
  })

  it('randomInt', () => {
    for (let i = 1; i <= 100; i++) {
      let r = randomInt(0, i)
      assert(0 <= r && r <= i)
    }
  })

  it('randomInt gives every value the same chance', () => {
    assert.deepEqual(
      countEvenDraws(300, () => randomInt(0, 2)),
      { 0: 100, 1: 100, 2: 100 }
    )
    assert.deepEqual(
      countEvenDraws(300, () => choice(['a', 'b', 'c'])),
      { a: 100, b: 100, c: 100 }
    )
  })

  it('randomInt keeps to the range', () => {
    const ends = (min, max) => [0, LAST_DRAW].map((draw) => drawAt(draw, () => randomInt(min, max)))
    assert.deepEqual(ends(0, 2), [0, 2])
    assert.deepEqual(ends(3, 3), [3, 3])
    assert.deepEqual(ends(5, 1), [1, 5])
    assert.deepEqual(ends(0.2, 2.7), [1, 2])
    assert.deepEqual(ends(1e15, 1e15 + 1), [1e15, 1e15 + 1])
  })

  it('shuffle', () => {
    let arr = randomArr()
    let copy = arr.slice()
    for (let i = 0; i < 100; i++) {
      assert(shuffle(copy) === copy)
      assert(copy.some((x, i) => x !== arr[i]))
    }
  })

  it('shuffle does not grow the array when size is past the end', () => {
    for (const size of [3, 5]) {
      const arr = [1, 2, 3]
      assert(shuffle(arr, size) === arr)
      assert.deepEqual(arr.slice().sort(), [1, 2, 3])
    }
  })

  it('shuffle returns the values of an object', () => {
    const values = shuffle({ a: 1, b: 2, c: 3 })
    assert(Array.isArray(values))
    assert.deepEqual(values.sort(), [1, 2, 3])
    assert.deepEqual(shuffle({}), [])
  })

  it('sample', () => {
    let arr = randomArr()
    for (let i = 0; i < 100; i++) {
      let s = sample(arr, 30)
      assert(s.length === 30)
      assert(s.some((x, i) => x !== arr[i]))
    }
  })

  it('sample of size 0 is empty', () => {
    assert.deepEqual(sample([1, 2, 3], 0), [])
  })
})
