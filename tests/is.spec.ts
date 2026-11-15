import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { isPlainObject } from '../src/is/index.ts'

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
