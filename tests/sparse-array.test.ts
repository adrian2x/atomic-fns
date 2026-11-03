import { describe, expect, it } from 'vitest'
import { clone, flatten } from '../src/collections/index.js'
import { set } from '../src/globals/index.js'
import { deepEqual } from '../src/operators/index.js'

describe('POL-24 sparse array walks', () => {
  it('set refuses index beyond length; append at length works', () => {
    const d = { tags: ['a'] as string[] }
    expect(() => set('tags.4294967294', d, 'x')).toThrow(RangeError)
    expect(() => set('tags.4294967294', d, 'x')).toThrow('array index beyond length')
    expect(d.tags.length).toBe(1)
    set('tags.1', d, 'b', true, true)
    expect(d.tags.length).toBe(2)
    expect(d.tags[1]).toBe('b')
  })

  it('huge sparse array of length 2**32-1 with 3 elements clones/compares/flattens in < 10 ms', () => {
    const a: unknown[] = []
    a[0] = 'a'
    a[1] = 'b'
    a[2 ** 32 - 2] = 'z'
    expect(a.length).toBe(2 ** 32 - 1)

    const t0 = performance.now()
    const c: unknown[] = clone(a, true)
    expect(performance.now() - t0).toBeLessThan(10)
    expect(c.length).toBe(a.length)
    expect(c[0]).toBe('a')
    expect(c[1]).toBe('b')
    expect(c[2 ** 32 - 2]).toBe('z')
    expect(0 in c).toBe(true)
    expect(3 in c).toBe(false)

    const t1 = performance.now()
    expect(deepEqual(a, c)).toBe(true)
    expect(performance.now() - t1).toBeLessThan(10)

    const t2 = performance.now()
    const flat: unknown[] = flatten(a, true)
    expect(performance.now() - t2).toBeLessThan(10)
    expect(flat).toEqual(['a', 'b', 'z'])
  })
})
