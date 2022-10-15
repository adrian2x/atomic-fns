import assert from 'assert'
import {
  True,
  False,
  CustomError,
  type,
  str,
  isBool,
  isObject,
  isString,
  isArray,
  isArrayLike,
  isNumber,
  isNaN,
  isNull,
  isBigint,
  isFunc,
  isPromise,
  isSymbol,
  isAsync,
  uniqueId,
  call,
  chr,
  ord,
  keys,
  values,
  round,
  enumerate,
  isGenerator,
  hash,
  hashCode,
  HASH_KEY,
  bin,
  hex,
  oct,
  list,
  next,
  get
} from '../build/globals.js'
import { isEmpty } from '../src/globals.js'

function cb() {}

describe('globals', () => {
  it('CustomError', () => {
    let err = new CustomError('custom')
    assert.equal(err.message, 'custom')
  })

  it('type', () => {
    assert(True())
    assert(!False())
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
    assert(type(Symbol()) === 'symbol')
    assert(type(new Promise(cb)) === 'promise')
    assert(isBool(true))
    assert(isBool(Boolean()))
    assert(!isBool(''))
    assert(!isBool({}))
    assert(!isBool(undefined))
    assert(isObject({}))
    assert(!isObject(''))
    assert(!isObject([]))
    assert(isString(''))
    assert(!isString([]))
    assert(isArray([]))
    assert(isArrayLike([]))
    assert(!isArray(''))
    assert(!isArrayLike(''))
    assert(isFunc(cb))
    assert(!isFunc([]))
    assert(isAsync(async function () {}))
    assert(isAsync(async () => {}))
    assert(!isAsync(cb))
    assert(isNaN(NaN))
    assert(!isNumber(NaN))
    assert(isNumber(42))
    assert(isNumber(Number(42)))
    assert(isNumber(Number('42')))
    assert(isNumber(parseFloat('42.0')))
    assert(isBigint(42n))
    assert(isBigint(BigInt('42')))
    assert(isPromise(new Promise(cb)))
    assert(isSymbol(Symbol()))
    assert(isNull(null))
    assert(isNull(undefined))
    assert(!isNull(''))
    assert(!isNull([]))
    assert(!isNull({}))
  })

  it('str', () => {
    assert(str(undefined) === '')
    assert(str(null) === '')
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

  it('round', () => {
    assert(round(0.5) === 1)
    assert(round(-0.5) === 0)
    assert(round(1.5) === 2)
    assert(round(1.54, 2) === 1.54)
    assert(round(1.545, 3) === 1.545)
  })

  it('enumerate', () => {
    let iter = enumerate(['foo', 'bar', 'baz'])
    assert(isGenerator(iter))
    let values = [...iter]
    assert.deepEqual(values, [
      [0, 'foo'],
      [1, 'bar'],
      [2, 'baz']
    ])
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
    assert(h === hash(obj))
    assert(obj[HASH_KEY] === h)
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
    assert(get(arr, '2') === 3)
    assert(get(arr, '3', false) === false)
    assert(get(arr, '3', false) === false)
    let obj = { foo: { bar: true } }
    let h = hash(obj)
    assert(get(obj, 'foo.bar'))
    assert(get(obj, ['foo', 'bar']))
    assert(get(obj, HASH_KEY) === h)
    assert(get(obj, [HASH_KEY]) === h)
  })

  it('isEmpty', () => {
    assert(isEmpty(null))
    assert(isEmpty(undefined))
    assert(isEmpty([]))
    assert(isEmpty(''))
    assert(isEmpty({}))
    assert(isEmpty(0))
    assert(!isEmpty(1))
  })
})
