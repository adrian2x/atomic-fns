/**
 * Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export const True = () => true

export const False = () => false

/**
 * A custom error class that inherits from the Error object.
 *
 * @export
 * @class CustomError
 * @extends {Error}
 */
export class CustomError extends Error {
  /**
   * Returns a new CustomError with the specified message.
   * @param message
   * @constructor
   */
  constructor(message?) {
    super(message)
    this.name = this.constructor.name
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor)
    } else {
      this.stack = new Error(message).stack
    }
  }
}

/**
 * Custom error to signal an invalid index access.
 * @extends {CustomError}
 */
export class IndexError extends CustomError {}

/**
 * Raised when a system function returns an I/O failure such as "file not found"
 * or "disk full".
 * @extends {CustomError}
 */
export class IOError extends CustomError {}

/**
 * Custom error to signal an invalid key access.
 * @extends {CustomError}
 */
export class KeyError extends CustomError {}

/**
 * Custom error to signal an invalid operation.
 * @extends {CustomError}
 */
export class NotImplementedError extends CustomError {}

/**
 * Custom error to signal an invalid value.
 * @extends {CustomError}
 */
export class ValueError extends CustomError {}

/**
 * Raised when the second argument of a division or modulo operation is zero.
 * @extends {CustomError}
 */
export class ZeroDivisionError extends CustomError {}

/**
 * Returns the true type of any value with correct detection for null, Array,
 * Object, Promise, Symbol, and NaN.
 *
 * @export
 * @param {*} value
 * @return
 */
export function type(value) {
  const result = typeof value
  if (result === 'object') {
    if (value) {
      if (value instanceof String) return 'string'
      if (value instanceof Boolean) return 'boolean'
      if (value instanceof Function) return 'function'
      // IE improperly marshals typeof across execution contexts, but a
      // cross-context object will still return false for "instanceof Object".
      if (value instanceof Array) return 'array'

      const className = str(value)
      // In Firefox 3.6, attempting to access iframe window objects' length
      // property throws an NS_ERROR_FAILURE, so we need to special-case it
      // here.
      if (className === '[object Window]') return 'object'

      // We cannot always use constructor === Array or instanceof Array because
      // different frames have different Array objects.
      // Mark Miller noticed that Object.prototype.toString
      // allows access to the unforgeable [[Class]] property.
      //  15.2.4.2 Object.prototype.toString ( )
      //  When the toString method is called, the following steps are taken:
      //      1. Get the [[Class]] property of this object.
      //      2. Compute a string value by concatenating the three strings
      //         "[object ", Result(1), and "]".
      //      3. Return Result(2).
      // and this behavior survives the destruction of the execution context.
      if (className.endsWith('Array]') || Array.isArray(value)) {
        return 'array'
      }
      // HACK: There is still an array case that fails.
      //     function ArrayImpostor() {}
      //     ArrayImpostor.prototype = [];
      //     var impostor = new ArrayImpostor;
      // this can be fixed by getting rid of the fast path
      // (value instanceof Array) and solely relying on
      // (value && Object.prototype.toString.vall(value) === '[object Array]')
      // but that would require many more function calls and is not warranted
      // unless closure code is receiving objects from untrusted sources.

      // IE in cross-window calls does not correctly marshal the function type
      // (it appears just as an object) so we cannot use just typeof val ==
      // 'function'. However, if the object has a call property, it is a
      // function.
      if (className.endsWith('Function]') || typeof value.call === 'function') {
        return 'function'
      }
      if (className === '[object Promise]' || value instanceof Promise) {
        return 'promise'
      }
      if (className === '[object Symbol]') {
        return 'symbol'
      }
    } else {
      return 'null'
    }
  } else if (result === 'function' && typeof value.call === 'undefined') {
    // In Safari typeof nodeList returns 'function', and on Firefox typeof
    // behaves similarly for HTML{Applet,Embed,Object}, Elements and RegExps. We
    // would like to return object for those and we can detect an invalid
    // function by making sure that the function object has a call method.
    return 'object'
  } else if (Number.isNaN(value)) return 'NaN'
  return result
}

/**
 * Equivalent to Object.toString()
 */
export const str = (x): string => Object.prototype.toString.call(x)

export const isBool = (x) => type(x) === 'boolean'

export const isObject = (x) => type(x) === 'object'

export const isString = (x) => type(x) === 'string'

export const isArray = (x) => type(x) === 'array'

export const isArrayLike = (x) => {
  const T = type(x)
  return T === 'array' || (T === 'object' && isNumber(x.length))
}

export const isFunc = (x) => type(x) === 'function'

export const isNumber = (x) => type(x) === 'number'

export const isBigint = (x) => type(x) === 'bigint'

export const isNaN = (x) => Number.isNaN(x)

export const isPromise = (x) => type(x) === 'promise'

export const isAsync = (x) => str(x) === '[object AsyncFunction]'

export const isNull = (x) => x === null

export const notNull = (x) => !isNull(x)

export const isSymbol = (x) => type(x) === 'symbol'

/**
 * Unique id generator function (pseudo-random)
 */
export const UID = () => (Math.random() * 1e10) >>> 0

export function call(key, obj, ...args) {
  if (!isNull(obj) && isFunc(obj[key])) {
    return obj[key](...args)
  }
}

export const chr = (x: number) => String.fromCodePoint(x)

export const ord = (x: string) => x.codePointAt(0)?.toString(16)

export const keys = (x) => Object.keys(x)

export const values = (x) => Object.values(x)

/**
 * Returns a tuple like (x / y, x % y)
 * @export
 * @param {number} x
 * @param {number} y
 * @return {number[]}
 */
export function divmod(x: number, y: number) {
  return [Math.floor(x / y), x % y]
}

export function log2(x) {
  if (x > 0) {
    return Math.log(x) * 1.442695
  }
  return Number.NaN
}

export function logBase(x, y) {
  if (x > 0 && y > 0) {
    return Math.log(y) / Math.log(x)
  }
  return Number.NaN
}

/**
 * Yields elements like [index, item] from an iterable.
 *
 * @export
 * @template T
 * @param {Iterable<T>} iter
 */
export function* enumerate<T = unknown>(iter: Iterable<T>) {
  let i = 0
  for (const item of iter) {
    yield [i++, item]
  }
}

export const getattr = (x, attr) => {
  try {
    return x[attr]
  } catch (error) {
    return undefined
  }
}

export function delattr(x, attr) {
  delete x[attr]
  return x
}

export function setattr(
  self: any,
  attr: PropertyKey,
  value,
  writable = false,
  enumerable = false
) {
  return Object.defineProperty(self, attr, {
    value,
    enumerable,
    writable
  })
}

export const HASH_KEY = Symbol('__hash__')

export function hash(obj) {
  const prev = getattr(obj, HASH_KEY)
  if (prev !== undefined) return prev

  if (typeof obj === 'string') {
    setattr(obj, HASH_KEY, hashCode(obj))
    return obj[HASH_KEY]
  }

  if (typeof obj === 'object') {
    setattr(obj, HASH_KEY, UID())
    return obj[HASH_KEY]
  }

  return obj
}

/**
 * A hash value generator for strings
 * @export
 * @param {string} str
 * @return {number}
 * @see http://isthe.com/chongo/tech/comp/fnv/
 */
export function hashCode(str: string) {
  const FNV1_32A_INIT = 0x811c9dc5
  let hval = FNV1_32A_INIT
  for (let i = 0; i < str.length; ++i) {
    hval ^= str.charCodeAt(i)
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24)
  }
  return hval >>> 0
}

export const hex = (n: number) => n.toString(16)

export const oct = (n: number) => n.toString(8)

export const int = (x, base) => parseInt(x, base)

export const float = (x) => parseFloat(x)

export const list = (arr) => Array.from(arr)

export const next = (iterator: Iterator<unknown>) => iterator.next()
