import { describe, it, vi } from 'vitest'
import assert from 'node:assert/strict'
import {
  bin,
  call,
  chr,
  CustomError,
  False,
  get,
  hash,
  hashCode,
  hex,
  isArrayLike,
  isAsyncFunction,
  isBigint,
  isBool,
  isEmpty,
  isFunction,
  isGenerator,
  isNull,
  isNumber,
  isObject,
  isPromise,
  isString,
  isSymbol,
  keys,
  list,
  next,
  NotImplementedError,
  oct,
  ord,
  set,
  str,
  True,
  type,
  uniqueId,
  uuid,
  noop,
  ValueError,
  KeyError,
  has,
  int,
  len
} from '../src/globals/index.js'
import { enumerate } from '../src/itertools/index.js'

describe('globals', () => {
  it('SPEC-R27 CustomError and subclasses keep cause and literal name', () => {
    const err = new CustomError('custom')
    assert.equal(err.message, 'custom')
    assert.equal(new ValueError('x', { cause: 1 }).cause, 1)
    assert.equal(new KeyError().name, 'KeyError')
  })

  it('True', () => {
    assert(True())
  })

  it('False', () => {
    assert(!False())
  })

  it('SPEC-R20 type uses tags without calling user methods', () => {
    assert(type(null) === 'null')
    assert(type(undefined) === 'undefined')
    assert(type(true) === 'boolean')
    assert(type(Boolean()) === 'boolean')
    assert(type(True()) === 'boolean')
    assert(type(False()) === 'boolean')
    assert(type('') === 'string')
    assert(type(NaN) === 'NaN')
    assert(type(42) === 'number')
    assert(type(Number('42')) === 'number')
    assert(type(parseFloat('42.0')) === 'number')
    assert(type(42n) === 'bigint')
    assert(type(BigInt('42')) === 'bigint')
    assert(type([]) === 'array')
    assert(type({}) === 'object')
    assert(type(type) === 'function')
    assert(type(Error()) === 'error')
    assert(type(new CustomError()) === 'error')
    assert(type(Symbol()) === 'symbol')
    assert(type(new Map()) === 'Map')
    assert(type(new WeakMap()) === 'WeakMap')
    assert(type(new Set()) === 'Set')
    assert(type(new WeakSet()) === 'WeakSet')
    assert(type(new Promise(noop)) === 'Promise')
    assert(type(new Int8Array()) === 'Int8Array')
    assert(type(new Uint8Array()) === 'Uint8Array')
    assert(type(new Uint8ClampedArray()) === 'Uint8ClampedArray')
    assert(type(new Int16Array()) === 'Int16Array')
    assert(type(new Uint16Array()) === 'Uint16Array')
    assert(type(new Int32Array()) === 'Int32Array')
    assert(type(new Uint32Array()) === 'Uint32Array')
    assert(type(new Float32Array()) === 'Float32Array')
    assert(type(new Float64Array()) === 'Float64Array')
    assert(type(new ArrayBuffer(8)) === 'ArrayBuffer')
    assert(type(new DataView(new ArrayBuffer(8))) === 'DataView')
    assert(type(Object.create(null)) === 'object')
    assert(type(new Date()) === 'Date')
    assert(type(/x/) === 'RegExp')
    assert(
      type({
        call() {
          return undefined
        }
      }) === 'object'
    )
    assert(
      type({
        toString() {
          return '[object Array]'
        }
      }) === 'object'
    )
  })

  it('SPEC-R20 isObject is type === object', () => {
    assert(isObject({}))
    assert(isObject(Object.create(null)))
    assert(!isObject(''))
    assert(!isObject([]))
  })

  it('isBool', () => {
    assert(isBool(true))
    assert(isBool(Boolean()))
    assert(!isBool(''))
    assert(!isBool({}))
    assert(!isBool(undefined))
  })

  it('isString', () => {
    assert(isString(''))
    assert(!isString([]))
  })

  it('SPEC-R25 isArrayLike: strings return false', () => {
    assert(isArrayLike([]))
    assert(isArrayLike({ length: 0 }))
    assert(!isArrayLike(''))
    assert(!isArrayLike('abc'))
  })

  it('SPEC-R21 isFunction typeof function', () => {
    assert(isFunction(noop))
    assert(
      isFunction(async () => {
        await Promise.resolve()
      })
    )
    assert(
      isFunction(function* () {
        yield undefined
      })
    )
    assert(!isFunction([]))
  })

  it('SPEC-R21 isAsyncFunction', () => {
    assert(
      isAsyncFunction(async function () {
        await Promise.resolve()
      })
    )
    assert(
      isAsyncFunction(async () => {
        await Promise.resolve()
      })
    )
    assert(!isAsyncFunction(noop))
    assert(!isAsyncFunction(Object.create(null)))
  })

  it('SPEC-R21 isAsyncFunction does not throw on a null-prototype function', () => {
    const f = function () {
      return undefined
    }
    Object.setPrototypeOf(f, null)
    assert.equal(isAsyncFunction(f), false)
    const g = async function () {
      await Promise.resolve()
    }
    Object.setPrototypeOf(g, null)
    assert.equal(isAsyncFunction(g), false)
  })

  it('SPEC-R21 isGenerator is generator object only', () => {
    function* gen() {
      yield 1
    }
    assert(isGenerator(gen()))
    assert(!isGenerator(gen))
    assert(!isGenerator(Object.create(null)))
  })

  it('isNumber', () => {
    assert(!isNumber(NaN))
    assert(isNumber(42))
    assert(isNumber(Number('42')))
    assert(isNumber(parseFloat('42.0')))
  })

  it('isBigInt', () => {
    assert(isBigint(42n))
    assert(isBigint(BigInt('42')))
  })

  it('isPromise', () => {
    assert(isPromise(new Promise(noop)))
  })

  it('isSymbol', () => {
    assert(isSymbol(Symbol()))
  })

  it('isNull', () => {
    assert(isNull(null))
    assert(isNull(undefined))
    assert(!isNull(''))
    assert(!isNull([]))
    assert(!isNull({}))
  })

  it('str', () => {
    assert(str(undefined) === '')
    assert(str(null) === '')
    assert(str(true) === 'true')
    assert(str(false) === 'false')
    assert(str(NaN) === 'NaN')
    assert(str(42) === '42')
    assert(str([]) === '')
    assert(str([1, 2, 3]) === '1,2,3')
    assert(str({}) === '[object Object]')
  })

  it('SPEC-R26 uniqueId returns distinct strings with counter', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1e5; i++) {
      const id = uniqueId()
      assert.equal(typeof id, 'string')
      seen.add(id)
    }
    assert.equal(seen.size, 1e5)
    const userId = uniqueId('user_')
    assert(typeof userId === 'string' && userId.startsWith('user_'))
  })

  it('SPEC-R26 uuid via randomUUID matches v4 regex', () => {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    assert.match(uuid(), re)
  })

  it('SPEC-R26 uuid fallback via getRandomValues matches v4 regex', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', {
      getRandomValues: (a: Uint8Array) => real.getRandomValues(a)
    })
    try {
      const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      assert.match(uuid(), re)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('SPEC-R26 uuid without crypto throws NotImplementedError', () => {
    vi.stubGlobal('crypto', undefined)
    try {
      assert.throws(
        () => uuid(),
        (e: unknown) => {
          assert(e instanceof NotImplementedError)
          assert.equal(e.message, 'crypto.getRandomValues unavailable')
          return true
        }
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('SPEC-R22 call reads key once and binds this', async () => {
    const obj = {
      foo() {
        return 42
      },
      async m() {
        await Promise.resolve()
        return 1
      },
      'a.b'() {
        return 2
      }
    }
    assert(call(obj, 'foo') === 42)
    assert.equal(await call(obj, 'm'), 1)
    assert.equal(call(obj, 'a.b'), 2)
    assert.equal(call(null, 'x'), undefined)
  })

  it('SPEC-R23 set is configurable so a second call replaces', () => {
    const o: { x?: number } = {}
    set('x', o, 1)
    assert.equal(o.x, 1)
    set('x', o, 2, true, true)
    assert.equal(o.x, 2)
    const desc = Object.getOwnPropertyDescriptor(o, 'x')
    assert(desc)
    assert.equal(desc.configurable, true)
    assert.equal(desc.writable, true)
    assert.equal(desc.enumerable, true)
  })

  it('chr', () => {
    assert(chr(97) === 'a')
    assert(chr(8364) === '€')
  })

  it('SPEC-R24 ord uses codePointAt', () => {
    assert(ord('a') === 97)
    assert(ord('€') === 8364)
    assert(ord(chr(0x1f600)) === 0x1f600)
  })

  it('SPEC-R24 has uses Reflect.has', () => {
    assert(has('abc', 'length'))
    assert(!has(0, 'x'))
    assert(has({ a: 1 }, 'a'))
    assert(!has(null, 'a'))
  })

  it('SPEC-R24 int truncates numbers and parseInt strings', () => {
    assert(int(5e-7) === 0)
    assert(int(1e21) === 1e21)
    assert(int('12abc') === 12)
    assert(int('ff', 16) === 255)
  })

  it('keys', () => {
    const obj = { a: 1, b: 2 }
    assert.deepEqual(keys(obj), Object.keys(obj))
  })

  it('SPEC-R25 next returns dflt when done, ignores return value', () => {
    const iter = enumerate([1, 2, 3])
    assert.deepEqual(next(iter), [0, 1])
    assert.deepEqual(next(iter), [1, 2])
    assert.deepEqual(next(iter), [2, 3])
    assert.equal(next([][Symbol.iterator](), 0), 0)
    assert.equal(
      next(
        (function* () {
          yield
          return 5
        })()
      ),
      undefined
    )
  })

  it('SPEC-R28 hash WeakMap identity, null is 0, no own symbols', () => {
    assert.equal(hash(null), 0)
    assert.equal(hash(undefined), 0)
    const obj = { a: 1, b: 2 }
    const h = hash(obj)
    assert.equal(typeof h, 'number')
    assert.equal(h, hash(obj))
    assert.notEqual(hash({ ...obj }), h)
    assert.equal(Object.getOwnPropertySymbols(obj).length, 0)
    assert.equal(hash('abc'), hashCode('abc'))
    assert.equal(hash(Symbol.for('k')), hashCode('Symbol(k)'))
  })

  it('hashCode', () => {
    const obj = '{ a: 1, b: 2 }'
    assert(hash(obj) === hashCode(obj))
  })

  it('F-099 FNV-1a reference vectors (32-bit over UTF-16 code units)', () => {
    // Standard 32-bit FNV-1a (offset basis 0x811c9dc5, prime 0x01000193) over UTF-16 units.
    assert.equal(hashCode(''), 0x811c9dc5)
    assert.equal(hashCode('a'), 0xe40c292c)
    assert.equal(hashCode('foobar'), 0xbf9cf968)
  })

  it('bin', () => {
    assert(bin(42) === (42).toString(2))
  })

  it('hex', () => {
    assert(hex(42) === (42).toString(16))
  })

  it('oct', () => {
    assert(oct(42) === (42).toString(8))
  })

  it('list', () => {
    const arr = [1, 2, 3]
    assert.deepEqual(list(arr), arr)
    assert.deepEqual(list(), [])
  })

  it('list rejects length-driven array-likes before allocating', () => {
    const evil = JSON.parse('{"length":4294967295}') as never
    const start = performance.now()
    assert.throws(() => list(evil), TypeError, 'expected an iterable')
    assert.ok(performance.now() - start < 5)
  })

  it('get', () => {
    const arr = [1, 2, 3]
    assert(get('2', arr) === 3)
    assert(!get('3', arr, false))
    const obj = { foo: { bar: true } }
    assert(get('foo.bar', obj))
    assert(get(['foo', 'bar'], obj))
  })

  it('C4-3 get ignores Object.prototype and Function.prototype members', () => {
    assert.equal(get('toString', {}, false), false)
    assert.equal(get('constructor', {}, null), null)
    assert.equal(get('constructor.constructor', {}, null), null)
    assert.equal(get('__proto__', {}, null), null)
    assert.equal(get('hasOwnProperty', {}, null), null)
    assert.equal(get('valueOf', {}, null), null)
    class Box {
      get secret(): number {
        return this.#n
      }
      #n = 42
    }
    assert.equal(get('secret', new Box()), 42)
    assert.equal(get('toString', { toString: 'own' }), 'own')
    assert.equal(get('length', [1, 2, 3]), 3)
    assert.equal(get('length', 'hi'), 2)
    assert.equal(has({}, 'toString'), false)
    assert.equal(has({ toString: 1 }, 'toString'), true)
  })

  it('len', () => {
    assert.equal(len(null), undefined)
    assert.equal(len([1, 2]), 2)
    assert.equal(len({ a: 1 }), 1)
  })

  it('isEmpty', () => {
    assert(isEmpty(null))
    assert(isEmpty(undefined))
    assert(isEmpty([]))
    assert(isEmpty(''))
    assert(isEmpty({}))
    assert(isEmpty(0))
    assert(isEmpty(false))
    assert(!isEmpty(1))
    assert(isEmpty(() => undefined))
    assert(
      isEmpty(function (a: number) {
        return a
      })
    )
    assert(!isEmpty(Object.assign(() => undefined, { a: 1 })))
    assert(!isEmpty(new Date()))
    assert(!isEmpty(2))
    assert(isEmpty(new Map()))
    assert(!isEmpty(new Set([1])))
    // POL-19: length/size-shaped plain objects are not empty
    assert(!isEmpty({ size: 0, x: 1 }))
    assert(!isEmpty({ length: 0, admin: true }))
  })

  it('SPEC-R29 removed names are absent; keys remains', async () => {
    const mod = await import('../src/index.js')
    const names = Object.keys(mod)
    for (const gone of [
      'bind',
      'callAsync',
      'isArray',
      'values',
      'floor',
      'ceil',
      'isInteger',
      'log2',
      'id',
      'HASH_KEY',
      'IterableIterator'
    ]) {
      assert(!names.includes(gone), gone)
    }
    assert(names.includes('keys'))
  })
})
