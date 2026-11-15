import { describe, expect, it } from 'vitest'
import { isMatch, matches } from '../src/object/index.ts'

describe('isMatch', () => {
  it('matches nested plain objects with at least the source keys', () => {
    expect(isMatch({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true)
    expect(isMatch({ a: { b: 1, c: 2 } }, { a: { b: 1 } })).toBe(true)
    expect(isMatch({ a: { b: 2 } }, { a: { b: 1 } })).toBe(false)
    expect(isMatch({ a: 1 }, { a: { b: 1 } })).toBe(false)
    expect(isMatch({ a: null }, { a: { b: 1 } })).toBe(false)
    expect(isMatch({}, { a: { b: 1 } })).toBe(false)
  })

  it('matches arrays as subsets, each element serving once', () => {
    expect(isMatch({ tags: ['a', 'b', 'c'] }, { tags: ['c', 'a'] })).toBe(true)
    expect(isMatch({ a: [1, { b: 2, c: 3 }] }, { a: [{ b: 2 }] })).toBe(true)
    expect(isMatch([1, 2], [1, 1])).toBe(false)
    expect(isMatch([1, 1], [1, 1])).toBe(true)
    expect(isMatch({ a: { 0: 1 } }, { a: [1] })).toBe(false)
    expect(isMatch({ a: [] }, { a: {} })).toBe(false)
  })

  it('matches arrays in any order when element shapes overlap', () => {
    const wide = { x: 1, y: 2 }
    const narrow = { x: 1 }
    expect(isMatch({ a: [wide, narrow] }, { a: [narrow, wide] })).toBe(true)
    expect(isMatch({ a: [narrow, wide] }, { a: [wide, narrow] })).toBe(true)
    expect(isMatch({ a: [wide, narrow] }, { a: [wide, wide] })).toBe(false)
    expect(isMatch(['a', 'b'], ['b', 'a'])).toBe(true)
  })

  it('places many interchangeable elements without rescanning the taken ones', () => {
    const rows = Array.from({ length: 10_000 }, () => ({}))
    expect(
      isMatch(
        rows,
        rows.map(() => ({}))
      )
    ).toBe(true)
  })

  it('treats a hole as no element on either side', () => {
    // biome-ignore lint/suspicious/noSparseArray: the hole is what is under test
    expect(isMatch({ a: [, 1] }, { a: [undefined, 1] })).toBe(false)
    expect(isMatch({ a: [undefined, 1] }, { a: [undefined, 1] })).toBe(true)
    // biome-ignore lint/suspicious/noSparseArray: the hole is what is under test
    expect(isMatch({ a: [1] }, { a: [, 1] })).toBe(true)
    expect(isMatch({ a: new Array(2 ** 32 - 1) }, { a: [1] })).toBe(false)
    expect(isMatch({ a: [1] }, { a: new Array(2 ** 32 - 1) })).toBe(true)
  })

  it('needs an undefined source value to be a present key', () => {
    expect(isMatch({}, { a: undefined })).toBe(false)
    expect(isMatch({ a: 1 }, { a: undefined })).toBe(false)
    expect(isMatch({ a: undefined }, { a: undefined })).toBe(true)
  })

  it('needs a nested object where the source has one, even an empty one', () => {
    expect(isMatch({}, { a: {} })).toBe(false)
    expect(isMatch({ a: null }, { a: {} })).toBe(false)
    expect(isMatch({ a: [null] }, { a: [{}] })).toBe(false)
    expect(isMatch({ a: { b: 1 } }, { a: {} })).toBe(true)
  })

  it('matches enumerable symbol keys of the source', () => {
    const role = Symbol('role')
    expect(isMatch({ [role]: 'admin' }, { [role]: 'admin' })).toBe(true)
    expect(isMatch({}, { [role]: 'admin' })).toBe(false)
    expect(isMatch({ [role]: 'user' }, { [role]: 'admin' })).toBe(false)
  })

  it('compares other source values with isEqual', () => {
    expect(isMatch({ when: new Date(0) }, { when: new Date(0) })).toBe(true)
    expect(isMatch({ when: new Date(0) }, { when: new Date(1) })).toBe(false)
    expect(isMatch({ m: new Map([[1, 2]]) }, { m: new Map([[1, 2]]) })).toBe(true)
    expect(isMatch({ n: NaN }, { n: NaN })).toBe(true)
    expect(isMatch(5, 5)).toBe(true)
  })

  it('reads inherited keys of the target', () => {
    expect(isMatch(Object.create({ a: 1 }), { a: 1 })).toBe(true)
  })

  it('boxes a primitive at the top only', () => {
    expect(isMatch('abc', { length: 3 })).toBe(true)
    expect(isMatch({ s: 'abc' }, { s: { length: 3 } })).toBe(false)
    expect(isMatch(null, {})).toBe(true)
    expect(isMatch(null, { a: 1 })).toBe(false)
  })

  it('assumes a cycle matches and still checks the rest of it', () => {
    const shape: Record<string, unknown> = {}
    shape.self = shape
    shape.a = 1
    const value: Record<string, unknown> = {}
    value.self = value
    value.a = 1
    expect(isMatch(value, shape)).toBe(true)
    value.a = 2
    expect(isMatch(value, shape)).toBe(false)
  })

  it('matches each shared object once', () => {
    let wide: object = {}
    let other: object = {}
    for (let i = 0; i < 40; i++) {
      wide = { a: wide, b: wide }
      other = { a: other, b: other }
    }
    expect(isMatch(other, wide)).toBe(true)
  })

  it('matches each shared object once when the graph also has a cycle', () => {
    const loop = (): Record<string, unknown> => {
      const node: Record<string, unknown> = {}
      node.self = node
      return node
    }
    let shape: object = loop()
    let value: object = loop()
    for (let i = 0; i < 40; i++) {
      shape = { a: shape, b: shape }
      value = { a: value, b: value }
    }
    expect(isMatch(value, shape)).toBe(true)
    const ring: Record<string, unknown> = {}
    let sharedShape: object = { back: ring }
    const valueRing: Record<string, unknown> = {}
    let sharedValue: object = { back: valueRing }
    for (let i = 0; i < 40; i++) {
      sharedShape = { a: sharedShape, b: sharedShape }
      sharedValue = { a: sharedValue, b: sharedValue }
    }
    ring.next = sharedShape
    valueRing.next = sharedValue
    expect(isMatch(valueRing, ring)).toBe(true)
  })

  it('does not keep a match that rested on a cycle which then failed', () => {
    const shape: Record<string, unknown> = { next: undefined, x: 1 }
    shape.next = { back: shape }
    const shared: Record<string, unknown> = {}
    const first = { next: shared, x: 2 }
    shared.back = first
    const second = { next: shared, x: 1 }
    expect(isMatch({ list: [first, second] }, { list: [shape] })).toBe(false)
  })

  it('does not keep a match that rested on a cycle further up which then failed', () => {
    type Node = Record<string, unknown>
    const tail: Node = {}
    const middle: Node = { t: tail }
    const upper: Node = { y: middle }
    tail.back = upper
    const root: Node = { x: upper, z: { t: tail }, k: 1 }
    upper.up = root
    const tailValue: Node = {}
    const upperValue: Node = { y: { t: tailValue } }
    tailValue.back = upperValue
    const sharedZ = { t: tailValue }
    const first: Node = { x: upperValue, z: sharedZ, k: 2 }
    upperValue.up = first
    const otherUpper: Node = {}
    otherUpper.y = { t: { back: otherUpper } }
    const second: Node = { x: otherUpper, z: sharedZ, k: 1 }
    otherUpper.up = second
    expect(isMatch({ list: [first, second] }, { list: [root] })).toBe(false)
  })

  it('stops past the nesting limit', () => {
    let shape: object = {}
    let value: object = {}
    for (let i = 1; i < 1000; i++) {
      shape = { a: shape }
      value = { a: value }
    }
    expect(isMatch(value, shape)).toBe(true)
    expect(() => isMatch({ a: value }, { a: shape })).toThrowError(
      new RangeError('nesting deeper than 1000 levels')
    )
  })

  it('stops past the step limit instead of running on', { timeout: 30_000 }, () => {
    const rows = Array.from({ length: 6000 }, () => ({}))
    const wanted = Array.from({ length: 6000 }, () => [])
    expect(() => isMatch(rows, wanted)).toThrow('matching took more than 33554432 steps')
  })
})

describe('matches', () => {
  const users = [
    { name: 'a', address: { city: 'x' } },
    { name: 'b', address: { city: 'y' } }
  ]

  it('keeps the values that match when passed to filter', () => {
    expect(users.filter(matches({ address: { city: 'y' } }))).toEqual([users[1]])
  })
})
