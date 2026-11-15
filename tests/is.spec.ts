import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { isArrayLike, isError, isNil, isPlainObject } from '../src/is/index.ts'

const argumentsOf = function (..._args: unknown[]) {
  // biome-ignore lint/complexity/noArguments: the arguments object is the value under test
  return arguments
}

describe('isPlainObject', () => {
  it('accepts object literals and null-prototype objects', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ a: 1 })).toBe(true)
    expect(isPlainObject(Object.create(null))).toBe(true)
  })

  it('accepts plain objects from another realm', () => {
    expect(isPlainObject(runInNewContext('({ a: 1 })'))).toBe(true)
    expect(isPlainObject(runInNewContext('Object.create(null)'))).toBe(true)
    expect(isPlainObject(runInNewContext('new (class A {})()'))).toBe(false)
  })

  it('refuses class instances, builtins and primitives', () => {
    class Point {}
    for (const value of [
      new Point(),
      [],
      new Date(0),
      new Map(),
      /a/,
      () => {},
      Math,
      JSON,
      Reflect,
      argumentsOf(1),
      null,
      undefined,
      'a',
      1
    ]) {
      expect(isPlainObject(value)).toBe(false)
    }
  })

  it('refuses objects built on another prototype or tagged as something else', () => {
    expect(isPlainObject(Object.create(Object.create(null) as object))).toBe(false)
    expect(isPlainObject(Object.create({ constructor: Object }) as object)).toBe(false)
    expect(isPlainObject({ [Symbol.toStringTag]: 'Thing' })).toBe(false)
  })

  it('refuses instances of a constructor whose prototype has a null prototype', () => {
    function Legacy(this: object): void {}
    Legacy.prototype = Object.create(null) as object
    ;(Legacy.prototype as { constructor: unknown }).constructor = Legacy
    expect(isPlainObject(new (Legacy as unknown as new () => object)())).toBe(false)
  })
})

describe('isArrayLike', () => {
  it('accepts values with a valid length', () => {
    expect(isArrayLike([])).toBe(true)
    expect(isArrayLike('abc')).toBe(true)
    expect(isArrayLike(new Uint8Array(2))).toBe(true)
    expect(isArrayLike(argumentsOf(1, 2))).toBe(true)
    expect(isArrayLike({ length: 0 })).toBe(true)
  })

  it('refuses invalid lengths, functions and primitives', () => {
    for (const length of [-1, 1.5, NaN, Infinity, 2 ** 53, '1']) {
      expect(isArrayLike({ length })).toBe(false)
    }
    expect(isArrayLike(() => {})).toBe(false)
    expect(isArrayLike(null)).toBe(false)
    expect(isArrayLike(1)).toBe(false)
    expect(isArrayLike(new Map())).toBe(false)
  })
})

describe('isError', () => {
  it('accepts errors from any realm', () => {
    expect(isError(new Error('x'))).toBe(true)
    expect(isError(new TypeError('x'))).toBe(true)
    expect(isError(runInNewContext('new RangeError("x")'))).toBe(true)
  })

  it('refuses look-alikes', () => {
    expect(isError({ name: 'Error', message: 'x' })).toBe(false)
    expect(isError(Object.create(Error.prototype) as object)).toBe(false)
    expect(isError('Error')).toBe(false)
    expect(isError({ [Symbol.toStringTag]: 'Error' })).toBe(false)
  })

  it('falls back to the object tag without Error.isError', async () => {
    const native = Object.getOwnPropertyDescriptor(Error, 'isError')
    delete (Error as { isError?: unknown }).isError
    vi.resetModules()
    try {
      const { isError: fallback } = await import('../src/is/isError.ts')
      expect(fallback(new TypeError('x'))).toBe(true)
      expect(fallback(runInNewContext('new RangeError("x")'))).toBe(true)
      expect(fallback({ name: 'Error', message: 'x' })).toBe(false)
      expect(fallback(Object.create(Error.prototype) as object)).toBe(false)
      expect(fallback({ [Symbol.toStringTag]: 'Error' })).toBe(true)
    } finally {
      if (native !== undefined) Object.defineProperty(Error, 'isError', native)
      vi.resetModules()
    }
  })
})

describe('isNil', () => {
  it('is true only for null and undefined', () => {
    expect(isNil(null)).toBe(true)
    expect(isNil(undefined)).toBe(true)
    for (const value of [0, '', false, NaN, {}, []]) expect(isNil(value)).toBe(false)
  })
})
