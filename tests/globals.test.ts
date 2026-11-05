import { describe, expectTypeOf, it, vi } from 'vitest'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {
  bin,
  call,
  chr,
  CustomError,
  del,
  False,
  get,
  has,
  hash,
  hashCode,
  hex,
  IndexError,
  isArrayLike,
  isAsyncFunction,
  isBigint,
  isBool,
  isDate,
  isEmpty,
  isError,
  isFunction,
  isGenerator,
  isMap,
  isNull,
  isNumber,
  isObject,
  isPromise,
  isRegExp,
  isSet,
  isString,
  isSymbol,
  isWeakMap,
  isWeakSet,
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
  int,
  len
} from '../src/globals/index.js'
import { Deque } from '../src/collections/deque.js'
import { omit, pick } from '../src/collections/index.js'
import { durationField } from '../src/i18n/index.js'
import { truncateForError } from '../src/internal/truncate.js'
import { enumerate } from '../src/itertools/index.js'
import { protocol } from '../src/operators/index.js'
import { expectFast } from './helpers/perf.js'

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
    assert.equal(has({ a: { b: 1 } }, 'a.b'), true)
    assert.equal(has({ a: { b: 1 } }, 'a.c'), false)
    assert.equal(has({ a: 1 }, 'a.b'), false)
    assert.equal(has({ 'a.b': 1 }, 'a.b'), false)
    assert.equal(has({ 'a.b': 1 }, ['a.b']), true)
    class Locked {
      get secret(): never {
        throw new Error('locked')
      }
    }
    assert.equal(has(new Locked(), 'secret'), true)
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
    expectFast(() => {
      assert.throws(() => list(evil), { name: 'TypeError', message: 'expected an iterable' })
    }, 1000)
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

  it('POL-24 set refuses sparse array growth beyond length', () => {
    const d = { tags: ['a'] as unknown[] }
    assert.throws(() => set('tags.4294967294', d, 'x', true, true), {
      name: 'RangeError',
      message: 'array index beyond length'
    })
    assert.equal(d.tags.length, 1)
    set('tags.1', d, 'b', true, true)
    assert.equal(d.tags.length, 2)
    assert.equal(d.tags[1], 'b')
  })

  it('R13-D1: path segments must be strings, numbers or symbols', () => {
    const d = { tags: ['a'] as unknown[] }
    const err = { name: 'TypeError', message: 'path segments must be strings, numbers or symbols' }
    for (const path of [
      ['tags', ['4294967294']],
      ['tags', [4294967294]],
      ['tags', [['4294967294']]],
      [['tags'], '4294967294'],
      ['tags', true],
      ['tags', null]
    ]) {
      assert.throws(() => set(path, d, 'x', true, true), err)
      assert.throws(() => get(path, d, 'D'), err)
      assert.throws(() => del(path, d), err)
      assert.throws(() => has(d, path), err)
    }
    assert.equal(d.tags.length, 1)
    assert.throws(() => set([['__proto__']], {}, { p: 1 }, true, true), err)
    assert.throws(() => set([['constructor'], 'prototype', 'x'], {}, 1, true, true), err)
  })

  it('R12-D: path segment checks apply to every path form', () => {
    const d = { tags: ['a'] as unknown[] }
    assert.throws(() => set(['tags', 4294967294], d, 'x', true, true), {
      name: 'RangeError',
      message: 'array index beyond length'
    })
    assert.throws(() => set(['tags', 1e9], d, 'x', true, true), {
      name: 'RangeError',
      message: 'array index beyond length'
    })
    assert.equal(d.tags.length, 1)
    set(['tags', 0], d, 'z', true, true)
    assert.equal(d.tags[0], 'z')
    set(['tags', 1], d, 'b', true, true)
    assert.equal(d.tags.length, 2)
    set(['tags', 2], d, 'c', true, true)
    assert.equal(d.tags.length, 3)
    assert.equal(d.tags[2], 'c')

    assert.throws(() => set(['__proto__', 'x'], {}, 1, true, true), {
      name: 'TypeError',
      message: 'refusing to write through "__proto__"'
    })
    assert.equal(get(['__proto__', 'x'], {}, 'D'), 'D')
    assert.equal(get(['a', 'constructor'], { a: {} }, 'D'), 'D')
    assert.equal(get('a.constructor', { a: {} }, 'D'), 'D')

    const obj: Record<string, unknown> = {}
    set([1.5], obj, 'dot', true, true)
    assert.equal(obj['1.5'], 'dot')
    const arr: unknown[] = []
    set([-1], arr, 'neg', true, true)
    assert.equal(Reflect.get(arr, '-1'), 'neg')
    assert.equal(arr.length, 0)
  })

  it('POL-20 residual: inherited natives are missing; set refuses inherited walks', () => {
    const doc = {
      ta: new Uint8Array(4),
      buf: Buffer.from('x'),
      sab: new SharedArrayBuffer(8),
      wr: new WeakRef({}),
      it: [].values(),
      gen: (function* () {
        yield 1
      })(),
      arr: [1]
    }
    const f16 = typeof Float16Array === 'function' ? new Float16Array(2) : null
    assert.equal(get('ta.fill', doc, 'D'), 'D')
    assert.equal(get('ta.subarray', doc, 'D'), 'D')
    assert.equal(get('sab.slice', doc, 'D'), 'D')
    assert.equal(get('wr.deref', doc, 'D'), 'D')
    assert.equal(get('it.next', doc, 'D'), 'D')
    assert.equal(get('gen.next', doc, 'D'), 'D')
    assert.equal(has(doc.ta, 'fill'), false)
    if (f16) {
      assert.equal(get('f16.fill', { f16 }, 'D'), 'D')
    }
    assert.throws(() => set('ta.fill.call', doc, 'pwned', true, true), {
      name: 'TypeError',
      message: 'refusing to write through inherited "fill"'
    })
    assert.equal(get('buf.toString', doc, 'D'), 'D')
    assert.equal(has(doc.buf, 'toString'), false)
    assert.throws(() => set('buf.toString.call', doc, 'pwned', true, true), {
      name: 'TypeError',
      message: 'refusing to write through inherited "toString"'
    })
    const ta = new Uint8Array(2)
    ta.fill(9)
    del('ta.fill.name', doc)
    ta.fill(7)
    assert.equal(ta[0], 7)
    class Widget {
      greet() {
        return 'hi'
      }
    }
    const greet = get('greet', new Widget())
    assert.equal(typeof greet, 'function')
    assert.equal((greet as { name: string }).name, 'greet')
    const own = { fn: () => 1 }
    set('fn.x', own, 2, true, true)
    assert.equal((own.fn as { x?: number }).x, 2)
  })

  it('R12-C: bound function on a user prototype is readable; intrinsics stay missing', () => {
    function baseGreet(this: { name: string }) {
      return this.name
    }
    class Person {
      name = 'ada'
    }
    Object.defineProperty(Person.prototype, 'greet', {
      value: baseGreet.bind({ name: 'bound' }),
      writable: true,
      configurable: true
    })
    const greet = get('greet', new Person())
    assert.equal(typeof greet, 'function')
    assert.equal(get('toString', Buffer.from('x'), 'D'), 'D')
    assert.equal(get('fill', new Uint8Array(2), 'D'), 'D')
    assert.equal(get('next', [][Symbol.iterator](), 'D'), 'D')
    assert.equal(get('size', new Map([[1, 1]])), 1)
  })

  it('R12-C: 100k get calls on a class method do not call Function.prototype.toString', () => {
    class C {
      m() {
        return 1
      }
    }
    const spy = vi.spyOn(Function.prototype, 'toString')
    const o = new C()
    for (let i = 0; i < 100_000; i++) {
      assert.equal(typeof get('m', o), 'function')
    }
    assert.equal(spy.mock.calls.length, 0)
    spy.mockRestore()
  })

  it('POL-20 path walks refuse prototype-reaching segments', () => {
    const body = { list: [1, 2], name: 'eve' }
    assert.equal(get('list.constructor.prototype', body, 'D'), 'D')
    assert.equal(get('name.constructor.prototype', body, 'D'), 'D')
    assert.equal(get('list.constructor.prototype.constructor.prototype', body, 'D'), 'D')
    class C {
      x = 1
    }
    assert.equal(get('constructor.prototype', new C(), 'D'), 'D')
    assert.equal(
      get(
        'list.constructor',
        {
          list: async () => await Promise.resolve(1)
        },
        'D'
      ),
      'D'
    )
    assert.equal(
      get(
        'list.constructor',
        {
          list: function* () {
            yield 1
          }
        },
        'D'
      ),
      'D'
    )
    assert.equal(
      get(
        'list.constructor',
        {
          list: async function* () {
            yield await Promise.resolve(1)
          }
        },
        'D'
      ),
      'D'
    )
    assert.equal(get('toString', [], 'D'), 'D')
    assert.equal(get('size', new Map([[1, 1]])), 1)
    assert.equal(get('constructor', { constructor: 'own' }), 'own')
    assert.equal(
      get('constructor', Object.assign(Object.create(null), { constructor: 'own' })),
      'own'
    )

    const obj = { tags: [] as unknown[] }
    const includesBefore = Array.prototype.includes
    assert.throws(() => set('tags.constructor.prototype.includes', obj, () => false), {
      name: 'TypeError',
      message: 'refusing to write through "constructor"'
    })
    assert.equal(Array.prototype.includes, includesBefore)
    assert.equal([1].includes(1), true)
  })

  it('set refuses to write through an inherited object into the shared prototype', () => {
    const shared = {}
    const child = Object.create({ a: shared }) as object

    assert.throws(() => set('a.x', child, 1), {
      name: 'TypeError',
      message: 'refusing to write through inherited "a"'
    })

    assert.deepEqual(Reflect.ownKeys(shared), [])
  })

  it('set refuses a dangerous last segment on a class instance, not on a plain own key', () => {
    class Widget {
      label = 'w'
    }

    for (const segment of ['__proto__', 'constructor', 'prototype']) {
      const widget = new Widget()
      const plain = Object.fromEntries([[segment, 'own']])

      assert.throws(() => set(segment, widget, 'x'), {
        name: 'TypeError',
        message: `refusing to write through "${segment}"`
      })
      set(segment, plain, 'x')

      assert.equal(Object.hasOwn(widget, segment), false)
      assert.equal(plain[segment], 'x')
    }
  })

  it('del keeps a dangerous own key on a class instance, removes it from a plain object', () => {
    class Widget {
      label = 'w'
    }

    for (const segment of ['__proto__', 'constructor', 'prototype']) {
      const descriptor = { value: 'own', configurable: true }
      const widget = Object.defineProperty(new Widget(), segment, descriptor)
      const plain = Object.fromEntries([[segment, 'own']])

      del(segment, widget)
      del(segment, plain)

      assert.equal(Object.hasOwn(widget, segment), true)
      assert.equal(Object.hasOwn(plain, segment), false)
    }
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

describe('len and del edges', () => {
  it('len size paths and del get edges', () => {
    assert.equal(len(Symbol()), undefined)
    const o = { a: 1 }
    del('a', o)
    assert.deepEqual(o, {})
    assert.equal(del('a', null), null)
    assert.equal(get('missing', null, 7), 7)
    assert.equal(get('a.b', { a: null }, 9), 9)
  })
})

const foreign = (source: string): unknown => vm.runInNewContext(source)

function revokedProxy(): object {
  const { proxy, revoke } = Proxy.revocable({}, {})
  revoke()
  return proxy
}

describe('set follows _.set with its own argument order', () => {
  it('creates missing and primitive intermediates as plain containers', () => {
    assert.deepEqual(set('a.b', {}, 1), { a: { b: 1 } })
    assert.deepEqual(set('a.b', { a: null }, 1), { a: { b: 1 } })
    assert.deepEqual(set('a.b', { a: undefined }, 1), { a: { b: 1 } })
    assert.deepEqual(set('a.b', { a: 1 }, 1), { a: { b: 1 } })
    assert.deepEqual(set('a.b', { a: 'text' }, 1), { a: { b: 1 } })
    assert.deepEqual(set('a.b.c', {}, 1), { a: { b: { c: 1 } } })
    assert.deepEqual(set(['a', 'b'], {}, 1), { a: { b: 1 } })
  })

  it('creates an array when the next segment is an index', () => {
    assert.deepEqual(set('a.0', {}, 1), { a: [1] })
    assert.deepEqual(set('a.0.b', {}, 1), { a: [{ b: 1 }] })
    assert.deepEqual(set(['a', 0], {}, 1), { a: [1] })
    assert.deepEqual(set('a.1.b', { a: [{}] }, 1), { a: [{}, { b: 1 }] })
  })

  it('refuses a bad segment before writing anything', () => {
    const target = {}
    assert.throws(() => set('a.__proto__.x', target, 1), {
      name: 'TypeError',
      message: 'refusing to write through "__proto__"'
    })
    assert.throws(() => set('a.constructor', target, 1), {
      name: 'TypeError',
      message: 'refusing to write through "constructor"'
    })
    assert.throws(() => set('a.5.b', target, 1), {
      name: 'RangeError',
      message: 'array index beyond length'
    })
    assert.deepEqual(target, {})
    assert.equal(Object.getPrototypeOf(target), Object.prototype)
  })

  it('a length write cannot grow an array', () => {
    const err = { name: 'RangeError', message: 'array index beyond length' }
    const doc = { tags: ['a', 'b'] }
    assert.throws(() => set('tags.length', doc, 4294967295), err)
    assert.throws(() => set('tags.length', doc, '3'), err)
    assert.throws(() => set('tags.length', doc, [9]), err)
    assert.throws(() => set('tags.length', doc, { valueOf: () => 1 }), err)
    assert.throws(() => set('tags.length', doc, 3, true), err)
    assert.equal(doc.tags.length, 2)

    assert.equal(set('tags.length', doc, 2).tags.length, 2)
    assert.equal(set('tags.length', doc, 1).tags.length, 1)
    assert.deepEqual(set('a.length', {}, 5), { a: { length: 5 } })
  })

  it('refuses to write into a builtin prototype reached through a path', () => {
    const prototypes = [
      Object.prototype,
      Function.prototype,
      Array.prototype,
      foreign('Object.prototype') as object
    ]
    try {
      for (const p of prototypes) {
        assert.throws(() => set('p.polluted', { p }, 1), {
          name: 'TypeError',
          message: 'refusing to write through "p"'
        })
        assert.equal(Object.hasOwn(p, 'polluted'), false)
      }
    } finally {
      for (const p of prototypes) Reflect.deleteProperty(p, 'polluted')
    }

    class Own {
      label = 'own'
    }
    set('p.x', { p: Own.prototype }, 1)
    assert.equal(Object.hasOwn(Own.prototype, 'x'), true)
  })

  it('del leaves a builtin prototype reached through a path alone', () => {
    for (const p of [Object.prototype, Function.prototype, foreign('Object.prototype') as object]) {
      Object.defineProperty(p, 'delProbe', { value: 1, configurable: true })
      try {
        del('p.delProbe', { p })
        assert.equal(Object.hasOwn(p, 'delProbe'), true)
      } finally {
        Reflect.deleteProperty(p, 'delProbe')
      }
    }

    class Own {
      label = 'own'
    }
    Object.defineProperty(Own.prototype, 'x', { value: 1, configurable: true })
    del('p.x', { p: Own.prototype })
    assert.equal(Object.hasOwn(Own.prototype, 'x'), false)
  })

  it('assigns the last segment, so keys stay enumerable and writable and setters run', () => {
    assert.equal(JSON.stringify(set('a', { a: 1, b: 2 }, 9)), '{"a":9,"b":2}')
    assert.deepEqual(Object.getOwnPropertyDescriptor(set('n', {}, 1), 'n'), {
      value: 1,
      writable: true,
      enumerable: true,
      configurable: true
    })
    assert.deepEqual(set('0', [3, 2, 1], 9).sort(), [1, 2, 9])

    let seen = 0
    set(
      'x',
      {
        set x(v: number) {
          seen = v
        }
      },
      5
    )
    assert.equal(seen, 5)

    class Doubler {
      #v = 0
      get x() {
        return this.#v
      }
      set x(v: number) {
        this.#v = v * 2
      }
    }
    const doubler = set('x', new Doubler(), 5)
    assert.equal(doubler.x, 10)
    assert.equal(Object.hasOwn(doubler, 'x'), false)
  })

  it('writes where plain assignment works', () => {
    assert.deepEqual(set('a', Object.seal({ a: 1 }), 2), { a: 2 })
    assert.deepEqual(set('length', [1, 2, 3], 1), [1])
    assert.deepEqual([...set('0', new Uint8Array(2), 1)], [1, 0])
  })

  it('explicit flags define the property, each defaulting to true', () => {
    const descriptor = (o: object) => Object.getOwnPropertyDescriptor(o, 'x')
    assert.deepEqual(descriptor(set('x', {}, 1, false, false)), {
      value: 1,
      writable: false,
      enumerable: false,
      configurable: true
    })
    assert.equal(descriptor(set('x', {}, 1, false))?.enumerable, true)
    assert.equal(descriptor(set('x', {}, 1, undefined, false))?.writable, true)
    assert.equal(
      Object.getOwnPropertyDescriptor(set('a.x', {}, 1, false, false), 'a')?.enumerable,
      true
    )
  })

  it('returns a null root, after the path is validated', () => {
    assert.equal(set('a', null, 1), null)
    assert.equal(set('a.b', undefined as object | undefined, 1), undefined)
    assert.throws(() => set([true], null, 1), {
      name: 'TypeError',
      message: 'path segments must be strings, numbers or symbols'
    })
  })
})

describe('one path grammar for get, set, has, del, pick, omit', () => {
  it('numeric brackets walk indexes; every other bracket stays literal', () => {
    const doc = { a: [{ b: 1 }], m: [[1, 2]] }
    assert.equal(get('a[0].b', doc), 1)
    assert.equal(get('m[0][1]', doc), 2)
    assert.equal(get('[0].b', doc.a), 1)
    assert.equal(has(doc, 'a[0].b'), true)
    assert.deepEqual(del('a[0].b', { a: [{ b: 1 }] }), { a: [{}] })
    assert.deepEqual(set('a[0].b', { a: [{}] }, 1), { a: [{ b: 1 }] })
    assert.deepEqual(pick(doc, ['a[0].b']), { a: [{ b: 1 }] })
    assert.deepEqual(omit({ a: [{ b: 1, c: 2 }] }, ['a[0].b']), { a: [{ c: 2 }] })

    assert.equal(get('a["b"]', { a: { b: 1 } }, 'D'), 'D')
    assert.equal(get('a[b]', { 'a[b]': 1 }), 1)
    assert.equal(get('a[0]b', { 'a[0]b': 1 }), 1)
    assert.equal(get(['a[0]'], { 'a[0]': 1 }), 1)
  })

  it('caps string paths at 2^20 characters', () => {
    const atCap = 'a'.repeat(2 ** 20)
    const tooLong = atCap + 'a'
    assert.equal(get(atCap, {}, 'D'), 'D')
    const err = { name: 'RangeError', message: 'path longer than 1048576 characters' }
    assert.throws(() => get(tooLong, {}), err)
    assert.throws(() => has({}, tooLong), err)
    assert.throws(() => set(tooLong, {}, 1), err)
    assert.throws(() => del(tooLong, {}), err)
    assert.throws(() => pick({}, [tooLong]), err)
    assert.throws(() => omit({}, [tooLong]), err)
  })

  it('validates a path before the null check', () => {
    const err = { name: 'TypeError', message: 'path segments must be strings, numbers or symbols' }
    assert.throws(() => get([true], null, 'D'), err)
    assert.throws(() => has(null, [true]), err)
    assert.throws(() => del([true], null), err)
  })

  it('rejects holes and huge sparse path arrays', () => {
    const err = { name: 'TypeError', message: 'path segments must be strings, numbers or symbols' }
    assert.throws(() => get(new Array(1), { undefined: 5 }), err)
    assert.throws(() => has({ undefined: 5 }, new Array(1)), err)
    assert.throws(() => set(new Array(1), {}, 1), err)
    assert.throws(() => del(new Array(1), { undefined: 1 }), err)
    assert.throws(() => get(new Array(2 ** 32 - 1), {}), {
      name: 'RangeError',
      message: 'sparse array too large'
    })
  })

  it('an empty path names nothing', () => {
    const doc = { a: 1 }
    assert.equal(get([], doc, 'D'), 'D')
    assert.equal(has(doc, []), false)
    assert.equal(set([], doc, 1), doc)
    assert.equal(del([], doc), doc)
    assert.deepEqual(doc, { a: 1 })
  })

  it('get lets getter errors through, as has and del do', () => {
    const boom = new Error('boom')
    const doc = {
      get a(): unknown {
        throw boom
      }
    }
    assert.throws(() => get('a', doc, 'D'), boom)
    assert.throws(() => get('a.b', doc, 'D'), boom)
    assert.throws(() => has(doc, 'a.b'), boom)
    assert.throws(() => del('a.b', doc), boom)
  })

  it('get and has read own data named prototype or constructor on class instances', () => {
    class Car {
      prototype = 'v1'
    }
    const car = Object.defineProperty(new Car(), 'constructor', { value: 'own' })
    assert.equal(get('prototype', car, 'D'), 'v1')
    assert.equal(has(car, 'prototype'), true)
    assert.equal(get('constructor', car, 'D'), 'own')
    assert.equal(has(car, 'constructor'), true)

    assert.equal(get('constructor', new Date(0), 'D'), 'D')
    assert.equal(get('prototype', Car, 'D'), 'D')
    assert.equal(get('a.prototype', { a: Object }, 'D'), 'D')
    assert.equal(has(Car, 'prototype'), false)
  })

  it('writes still refuse own data named prototype on a class instance', () => {
    class Car {
      prototype = { x: 1 }
    }
    const car = new Car()
    assert.throws(() => set('prototype.x', car, 2), {
      name: 'TypeError',
      message: 'refusing to write through "prototype"'
    })
    del('prototype.x', car)
    assert.equal(car.prototype.x, 1)
  })

  it('treats another realm and platform classes as intrinsic', () => {
    const doc = foreign('({ list: [], fn() {}, made: new (class Foo { m() {} })() })')
    assert.equal(has(doc, 'toString'), false)
    assert.equal(get('hasOwnProperty', doc, 'D'), 'D')
    assert.equal(get('list.push', doc, 'D'), 'D')
    assert.equal(get('fn.call', doc, 'D'), 'D')
    assert.equal(typeof get('made.m', doc), 'function')

    assert.equal(has(new URL('http://a.example/'), 'toString'), false)
    assert.equal(has(new URLSearchParams('a=1'), 'get'), false)
    assert.equal(has(new Blob([]), 'text'), false)
    assert.equal(get('href', new URL('http://a.example/')), 'http://a.example/')
    const { Temporal } = globalThis as { Temporal?: { Now: { instant(): object } } }
    if (Temporal) assert.equal(has(Temporal.Now.instant(), 'add'), false)
  })

  it('has the types its behavior supports', () => {
    expectTypeOf(get('a', { a: 's' }, 0)).toBeUnknown()
    expectTypeOf(get('a', { a: 's' })).toBeUnknown()
    expectTypeOf(get<string>('a', { a: 's' }, 'dflt')).toBeString()
    const afterIsNumber = (x: number | string) => {
      if (!isNumber(x)) expectTypeOf(x).toEqualTypeOf<number | string>()
    }
    afterIsNumber(NaN)
  })
})

describe('predicates read internal slots, not realms or tags', () => {
  it('accept builtins from another realm', () => {
    assert.equal(isDate(foreign('new Date(0)')), true)
    assert.equal(isRegExp(foreign('/x/')), true)
    assert.equal(isError(foreign('new TypeError("x")')), true)
    assert.equal(isMap(foreign('new Map')), true)
    assert.equal(isSet(foreign('new Set')), true)
    assert.equal(isWeakMap(foreign('new WeakMap')), true)
    assert.equal(isWeakSet(foreign('new WeakSet')), true)
    assert.equal(isPromise(foreign('Promise.resolve()')), true)
    assert.equal(type(foreign('new Error("x")')), 'error')
  })

  it('refuse objects that only inherit from or are tagged like a builtin', () => {
    const tagged = (tag: string) => ({ [Symbol.toStringTag]: tag })
    assert.equal(isDate(Object.create(Date.prototype)), false)
    assert.equal(isDate(tagged('Date')), false)
    assert.equal(isRegExp(Object.create(RegExp.prototype)), false)
    assert.equal(isRegExp(RegExp.prototype), false)
    assert.equal(isMap(Object.create(Map.prototype)), false)
    assert.equal(isSet(Object.create(Set.prototype)), false)
    assert.equal(isWeakMap(Object.create(WeakMap.prototype)), false)
    assert.equal(isWeakSet(Object.create(WeakSet.prototype)), false)
    assert.equal(isError(Object.create(Error.prototype)), false)
    assert.equal(isError(tagged('Error')), false)
    assert.equal(isPromise(tagged('Promise')), false)
    assert.equal(isGenerator(tagged('Generator')), false)
  })

  it('keep recognizing a real builtin that carries its own tag', () => {
    const tag = { [Symbol.toStringTag]: 'Custom' }
    assert.equal(isDate(Object.assign(new Date(0), tag)), true)
    assert.equal(isRegExp(Object.assign(/x/, tag)), true)
    assert.equal(isMap(Object.defineProperty(new Map(), Symbol.toStringTag, { value: 'X' })), true)
  })

  it('isError falls back to the tag where Error.isError is missing', () => {
    const native = Object.getOwnPropertyDescriptor(Error, 'isError')
    assert(native)
    Reflect.deleteProperty(Error, 'isError')
    try {
      assert.equal(isError(foreign('new Error("x")')), true)
      assert.equal(isError({}), false)
    } finally {
      Object.defineProperty(Error, 'isError', native)
    }
  })

  it('isArrayLike requires a valid length', () => {
    assert.equal(isArrayLike({ length: 0 }), true)
    assert.equal(isArrayLike({ length: 3 }), true)
    assert.equal(isArrayLike({ length: -1 }), false)
    assert.equal(isArrayLike({ length: 1.5 }), false)
    assert.equal(isArrayLike({ length: NaN }), false)
    assert.equal(isArrayLike({ length: Infinity }), false)
    assert.equal(isArrayLike({ length: 2 ** 53 }), false)
  })

  it('isObject covers class instances that carry a tag, not builtins', () => {
    class Tagged {
      readonly [Symbol.toStringTag] = 'Tagged'
    }
    assert.equal(isObject(new Tagged()), true)
    assert.equal(isObject(new Deque()), true)
    assert.equal(isObject({ [Symbol.toStringTag]: 'Date' }), true)
    assert.equal(isObject(new Map()), false)
    assert.equal(isObject(foreign('new Map')), false)
    assert.equal(isObject(new Date()), false)
    assert.equal(isObject(new Error('x')), false)
    class TaggedError extends Error {
      readonly [Symbol.toStringTag] = 'TaggedError'
    }
    assert.equal(isObject(new TaggedError('x')), false)
    assert.equal(isObject(Object.assign([], { [Symbol.toStringTag]: 'T' })), false)
  })

  it('type and the predicates built on it never throw', () => {
    const throwingTag = {
      get [Symbol.toStringTag](): string {
        throw new Error('boom')
      }
    }
    for (const value of [throwingTag, revokedProxy()]) {
      assert.equal(type(value), 'object')
      assert.equal(isObject(value), true)
      assert.equal(isString(value), false)
      assert.equal(isNumber(value), false)
      assert.equal(isPromise(value), false)
      assert.equal(isGenerator(value), false)
      assert.equal(isDate(value), false)
      assert.equal(isMap(value), false)
    }
  })
})

describe('len and isEmpty share one set of rules', () => {
  class OwnSize {
    size = 0
    name = 'a.txt'
  }
  class Sized {
    readonly #items = [1, 2]
    get size() {
      return this.#items.length
    }
  }
  class SizeMethod {
    size() {
      return 3
    }
  }

  it('leaves an own size getter unread', () => {
    const doc = {
      get size(): number {
        throw new Error('read')
      }
    }
    assert.equal(isEmpty(doc), false)
    assert.equal(len(doc), 1)
  })

  it('len counts own keys of objects that merely own a length or size', () => {
    assert.equal(len({ length: 0, a: 1 }), 2)
    assert.equal(len({ length: -1 }), 1)
    assert.equal(len(JSON.parse('{"length":1e308,"a":1}')), 2)
    assert.equal(len({ size: 3 }), 1)
    assert.equal(len({ size: () => 4 }), 1)
    assert.equal(len(new OwnSize()), 2)
    assert.equal(isEmpty(new OwnSize()), false)
    assert.equal(isEmpty({ length: 0, a: 1 }), false)
  })

  it('len and isEmpty read a size the class defines on its prototype', () => {
    assert.equal(len(new Sized()), 2)
    assert.equal(len(new SizeMethod()), 3)
    assert.equal(isEmpty(new Sized()), false)
    assert.equal(isEmpty(new SizeMethod()), false)
    assert.equal(len(new Deque([1, 2])), 2)
    assert.equal(isEmpty(new Deque()), true)
    assert.equal(len(new Blob(['abc'])), 3)
  })

  it('len agrees with isEmpty on functions, Dates, buffers and boxes', () => {
    assert.equal(
      len(function (a: number, b: number) {
        return a + b
      }),
      0
    )
    assert.equal(len(Object.assign(() => undefined, { a: 1 })), 1)
    assert.equal(len(new Date()), undefined)
    assert.equal(len(new Error('x')), 0)
    assert.equal(len(new Uint16Array(3)), 3)
    assert.equal(len(new DataView(new ArrayBuffer(8))), 8)
    assert.equal(len(new ArrayBuffer(8)), 8)
    assert.equal(len(new SharedArrayBuffer(8)), 8)
    assert.equal(len(new Number(5)), undefined)
    assert.equal(len(new String('ab')), 2)
    assert.equal(len(foreign('(function () { return arguments })(1, 2)')), 2)
  })

  it('isEmpty unboxes, reads buffers and ignores the realm', () => {
    assert.equal(isEmpty(new Number(5)), false)
    assert.equal(isEmpty(new Number(0)), true)
    assert.equal(isEmpty(new Boolean(true)), false)
    assert.equal(isEmpty(new Boolean(false)), true)
    assert.equal(isEmpty(Object(1n)), false)
    assert.equal(isEmpty(Object(0n)), true)
    assert.equal(isEmpty(Object(Symbol())), false)
    assert.equal(isEmpty(new String('')), true)
    assert.equal(isEmpty(new ArrayBuffer(8)), false)
    assert.equal(isEmpty(new ArrayBuffer(0)), true)
    assert.equal(isEmpty(new SharedArrayBuffer(8)), false)
    assert.equal(isEmpty(foreign('new Date(0)')), false)
    assert.equal(isEmpty(foreign('({ size: 0, a: 1 })')), false)
    assert.equal(isEmpty(foreign('new Map([[1, 2]])')), false)
  })

  it('isEmpty honors protocol.bool', () => {
    const truthy = { [protocol.bool]: () => true }
    const falsy = { [protocol.bool]: () => false, a: 1 }
    assert.equal(isEmpty(truthy), false)
    assert.equal(isEmpty(falsy), true)
  })
})

describe('str and uniqueId on odd input', () => {
  it('str falls back to the object tag when toString is not callable', () => {
    assert.equal(str(JSON.parse('{"toString":1}')), '[object Object]')
    assert.equal(str(Object.create(null)), '[object Object]')
    assert.equal(str({ toString: () => 'own' }), 'own')
  })

  it('uniqueId treats a null prefix as no prefix', () => {
    assert.match(uniqueId(null), /^\d+$/)
  })
})

describe('error names', () => {
  it('name is not an enumerable own key', () => {
    const err = new ValueError('bad')
    assert.equal(err.name, 'ValueError')
    assert.deepEqual(Object.keys(err), [])
    assert.equal(JSON.stringify(err), '{}')
    assert.equal(String(err), 'ValueError: bad')
    assert.equal(new IndexError('x').name, 'IndexError')
    assert.equal(new CustomError('x').name, 'CustomError')
  })

  it('a subclass reports its own name', () => {
    class Timeout extends ValueError {}
    class Conflict extends CustomError {}
    assert.equal(new Timeout('x').name, 'Timeout')
    assert.equal(String(new Conflict('x')), 'Conflict: x')
  })
})

describe('truncateForError under hostile values', () => {
  it('cuts nested strings and keys before stringifying', () => {
    const huge = 'x'.repeat(1e6)
    const stringify = vi.spyOn(JSON, 'stringify')
    try {
      assert.equal(truncateForError([huge]), `["${'x'.repeat(38)}...`)
      assert.equal(truncateForError({ a: huge }), `{"a":"${'x'.repeat(34)}...`)
      assert.equal(truncateForError({ [huge]: 1 }), `{"${'x'.repeat(38)}...`)
      const encoded = stringify.mock.calls.map(([value]) => String(value).length)
      assert(Math.max(...encoded) <= 48)
    } finally {
      stringify.mockRestore()
    }
  })

  it('falls back to the tag when a getter or proxy throws', () => {
    const throwing = {
      get a(): unknown {
        throw new Error('boom')
      }
    }
    assert.equal(truncateForError(throwing), '"[object Object]"')
    assert.equal(truncateForError(revokedProxy()), '"[object Object]"')
    assert.equal(truncateForError([throwing]), '"[object Array]"')
    assert.throws(() => durationField(throwing as never), {
      name: 'ValueError',
      message: 'unknown duration unit "[object Object]"'
    })
  })
})
