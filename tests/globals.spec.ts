import assert from 'assert'
import {
  bin,
  call,
  chr,
  CustomError,
  False,
  get,
  hash,
  hashCode,
  HASH_KEY,
  hex,
  isArray,
  isArrayLike,
  isAsyncFunction,
  isBigint,
  isBool,
  isEmpty,
  isFunction,
  isNull,
  isNumber,
  isObject,
  isPromise,
  isString,
  isSymbol,
  keys,
  list,
  next,
  oct,
  ord,
  str,
  True,
  type,
  uniqueId,
  values,
  noop
} from '../src/globals/index.js'
import { enumerate } from '../src/itertools/index.js'

describe('globals', () => {
  it('CustomError', () => {
    let err = new CustomError('custom')
    assert.equal(err.message, 'custom')
  })

  it('True', () => assert(True() === true))

  it('False', () => assert(False() === false))

  it('type', () => {
    assert(type(null) === 'null')
    assert(type(undefined) === 'undefined')
    assert(type(true) === 'boolean')
    assert(type(Boolean()) === 'boolean')
    assert(type(True()) === 'boolean')
    assert(type(False()) === 'boolean')
    assert(type('') === 'string')
    assert(type(String('')) === 'string')
    assert(type(NaN) === 'NaN')
    assert(type(42) === 'number')
    assert(type(Number(42)) === 'number')
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
  })

  it('isBool', () => {
    assert(isBool(true))
    assert(isBool(Boolean()))
    assert(!isBool(''))
    assert(!isBool({}))
    assert(!isBool(undefined))
  })

  it('isObject', () => {
    assert(isObject({}))
    assert(!isObject(''))
    assert(!isObject([]))
  })

  it('isString', () => {
    assert(isString(''))
    assert(!isString([]))
  })

  it('isArray', () => {
    assert(isArray([]))
    assert(isArrayLike([]))
    assert(!isArray(''))
    assert(!isArrayLike(''))
  })

  it('isFunction', () => {
    assert(isFunction(noop))
    assert(!isFunction([]))
  })

  it('isAsyncFunction', () => {
    assert(isAsyncFunction(async function () {}))
    assert(isAsyncFunction(async () => {}))
    assert(!isAsyncFunction(noop))
  })

  it('isNumber', () => {
    assert(!isNumber(NaN))
    assert(isNumber(42))
    assert(isNumber(Number(42)))
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

  it('uniqueId', () => {
    const uid = uniqueId()
    assert(isNumber(uid))
    let prefix = 'user_'
    const userId = uniqueId('user_')
    assert(userId.startsWith('user_'))
  })

  it('call', () => {
    const obj = {
      foo() {
        return 42
      }
    }
    assert(call(obj, 'foo') === 42)
  })

  it('chr', () => {
    assert(chr(97) === 'a')
    assert(chr(8364) === '€')
  })

  it('ord', () => {
    assert(ord('a') === 97)
    assert(ord('€') === 8364)
  })

  it('keys', () => {
    let obj = { a: 1, b: 2 }
    assert.deepEqual(keys(obj), Object.keys(obj))
  })

  it('values', () => {
    let obj = { a: 1, b: 2 }
    assert.deepEqual(values(obj), Object.values(obj))
  })

  it('next', () => {
    const iter = enumerate([1, 2, 3])
    assert.deepEqual(next(iter), [0, 1])
    assert.deepEqual(next(iter), [1, 2])
    assert.deepEqual(next(iter), [2, 3])
  })

  it('hash', () => {
    let obj = { a: 1, b: 2 }
    let h = hash(obj)
    assert(h != undefined, String(h))
    assert(h === hash(obj), String(hash(obj)))
    assert(obj[HASH_KEY] === h, String(obj[HASH_KEY]))
  })

  it('hashCode', () => {
    let obj = '{ a: 1, b: 2 }'
    assert(hash(obj) === hashCode(obj))
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

  it('get', () => {
    const arr = [1, 2, 3]
    assert(get('2', arr) === 3)
    assert(get('3', arr, false) === false)
    assert(get('3', arr, false) === false)
    let obj = { foo: { bar: true } }
    let h = hash(obj)
    assert(get('foo.bar', obj))
    assert(get(['foo', 'bar'], obj))
    assert(get(HASH_KEY, obj) === h)
    assert(get([HASH_KEY], obj) === h)
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
  })
})
