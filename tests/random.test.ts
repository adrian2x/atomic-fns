import { describe, it } from 'vitest'
import assert from 'assert'
import { times } from '../src/itertools/index.js'
import { choice, random, randomInt, sample, shuffle } from '../src/random/index.js'

const randomArr = () => [...times(100, (i) => randomInt(i, 100))]

describe('random', () => {
  it('choice', () => {
    const arr = randomArr()
    for (let i = 0; i < 100; i++) {
      assert(arr.includes(choice(arr)))
    }
  })

  it('random', () => {
    for (let i = 1; i <= 100; i++) {
      const r = random(0, i)
      assert(0 <= r && r < i)
    }
  })

  it('randomInt', () => {
    for (let i = 1; i <= 100; i++) {
      const r = randomInt(0, i)
      assert(0 <= r && r <= i)
    }
  })

  it('shuffle', () => {
    const arr = randomArr()
    const copy = arr.slice()
    for (let i = 0; i < 100; i++) {
      assert(shuffle(copy) === copy)
      assert(copy.some((x, i) => x !== arr[i]))
    }
  })

  it('sample', () => {
    const arr = randomArr()
    for (let i = 0; i < 100; i++) {
      const s = sample(arr, 30)
      assert(s.length === 30)
      assert(s.some((x, i) => x !== arr[i]))
    }
  })
})
