export const True = () => true;
export const False = () => false;
/**
 * A custom error class that inherits from the Error object.
 *
 *
 * @class CustomError
 * @extends {Error}
 */
export class CustomError extends Error {
    /**
     * Returns a new CustomError with the specified message.
     * @param message
     * @constructor
     */
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
        else {
            this.stack = new Error(message).stack;
        }
    }
}
/**
 * Custom error to signal an invalid index access.
 * @extends {CustomError}
 */
export class IndexError extends CustomError {
}
/**
 * Raised when a system function returns an I/O failure such as "file not found"
 * or "disk full".
 * @extends {CustomError}
 */
export class IOError extends CustomError {
}
/**
 * Custom error to signal an invalid key access.
 * @extends {CustomError}
 */
export class KeyError extends CustomError {
}
/**
 * Custom error to signal an invalid operation.
 * @extends {CustomError}
 */
export class NotImplementedError extends CustomError {
}
/**
 * Custom error to signal an invalid value.
 * @extends {CustomError}
 */
export class ValueError extends CustomError {
}
/**
 * Raised when the second argument of a division or modulo operation is zero.
 * @extends {CustomError}
 */
export class ZeroDivisionError extends CustomError {
}
/**
 * Returns the true type of any value with correct detection for null, Array,
 * Object, Promise, Symbol, and NaN.
 *
 *
 * @param {*} value
 * @return
 */
export function type(value) {
    const result = typeof value;
    if (result === 'object') {
        if (value) {
            if (value instanceof String)
                return 'string';
            if (value instanceof Boolean)
                return 'boolean';
            if (value instanceof Function)
                return 'function';
            // IE improperly marshals typeof across execution contexts, but a
            // cross-context object will still return false for "instanceof Object".
            if (value instanceof Array)
                return 'array';
            const className = str(value);
            // In Firefox 3.6, attempting to access iframe window objects' length
            // property throws an NS_ERROR_FAILURE, so we need to special-case it
            // here.
            if (className === '[object Window]')
                return 'object';
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
                return 'array';
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
                return 'function';
            }
            if (className === '[object Promise]' || value instanceof Promise) {
                return 'promise';
            }
            if (className === '[object Symbol]') {
                return 'symbol';
            }
        }
        else {
            return 'null';
        }
    }
    else if (result === 'function' && typeof value.call === 'undefined') {
        // In Safari typeof nodeList returns 'function', and on Firefox typeof
        // behaves similarly for HTML{Applet,Embed,Object}, Elements and RegExps. We
        // would like to return object for those and we can detect an invalid
        // function by making sure that the function object has a call method.
        return 'object';
    }
    else if (Number.isNaN(value))
        return 'NaN';
    return result;
}
/** Same as `x.toString()`. Returns `''` when x is null or undefined */
export const str = (x) => (x != null ? x.toString() : '');
/** Check if value is a boolean type */
export const isBool = (x) => type(x) === 'boolean';
/** Check if value is an object type */
export const isObject = (x) => typeof x === 'object' && type(x) === 'object';
/** Check if value is a string type */
export const isString = (x) => type(x) === 'string';
/** Check if value is an Array type */
export const isArray = (x) => type(x) === 'array';
/** Check if value is Array-like type.
 * A value is considered array-like if it's not a function and has a
 * `.length` number property.
 */
export const isArrayLike = (x) => {
    const T = type(x);
    return T === 'array' || (T === 'object' && isNumber(x.length));
};
/** Check if value is a function type */
export const isFunc = (x) => type(x) === 'function';
/** Check if value is a number type */
export const isNumber = (x) => type(x) === 'number';
/** Check if value is a Bigint type */
export const isBigint = (x) => type(x) === 'bigint';
/** Check if value is NaN based on `Number.isNaN` */
export const isNaN = (x) => Number.isNaN(x);
/** Check if value is a Promise type */
export const isPromise = (x) => type(x) === 'promise';
/** Check if value is an async function type */
export const isAsync = (x) => get(x, 'constructor.name') === 'AsyncFunction';
/** Check if value is a generator function type */
export const isGenerator = (x) => {
    return get(x, 'constructor.constructor.name') === 'GeneratorFunction';
};
/** Check if value is null or undefined */
export const isNull = (x) => x == null;
/** Check if value is not null or undefined */
export const notNull = (x) => x != null;
export function len(x) {
    if (x == null)
        return;
    if (x.length !== undefined) {
        return x.length;
    }
    if (isFunc(x.size)) {
        return x.size();
    }
    if (isObject(x)) {
        return Object.keys(x).length;
    }
}
/** Returns true for objects without length or falsey values. */
export const isEmpty = (x) => (len(x) === 0 ? true : !x);
/** Check if value is a Symbol type */
export const isSymbol = (x) => type(x) === 'symbol';
/**
 * Generates a unique ID using random numbers.
 * If prefix is given, the ID is appended to it
 */
export const uniqueId = (pre = '') => 
// @ts-expect-error
(pre || 0) + ((Math.random() * 1e10) >>> 0);
/**
 * Checks if `obj.key` is a function, and calls it with any `args`.
 *
 *
 * @param {*} obj
 * @param {PropertyKey} key
 * @param {...any[]} args
 * @return `obj.key(...args)`
 */
export function call(obj, key, ...args) {
    if (isFunc(get(obj, key))) {
        return obj[key](...args);
    }
}
/** Convert number to unicode character */
export const chr = (x) => String.fromCodePoint(x);
/** Convert character to Unicode code point */
export const ord = (x) => x.charCodeAt(0);
/** `Object.keys(x)` */
export const keys = (x) => Object.keys(x);
/** `Object.values(x)` */
export const values = (x) => Object.values(x);
/**
 * Round `x` to the number of digits after the decimal point. If `digits` is
 * omitted, it returns the nearest integer to x.
 *
 * @param {number} x
 * @param {number} [digits=0]
 */
export function round(x, digits = 0) {
    const base = 10 ** digits;
    return Math.round(x * base) / base;
}
export const floor = (x) => Math.floor(x);
export const ceil = (x) => Math.ceil(x);
/**
 * Yields elements like [index, item] from an iterable.
 *
 *
 * @template T
 * @param {Iterable<T>} iterable
 */
export function* enumerate(iterable) {
    let i = 0;
    for (const item of iterable) {
        yield [i++, item];
    }
}
export const has = (obj, attr) => obj && attr in obj;
/**
 * Check if the attribute is present in the object, or return optional default.
 *
 *
 * @param {*} obj
 * @param {PropertyKey} key
 * @param {*} [value=undefined]
 * @return The property value or default value
 */
export function get(obj, key, value = undefined) {
    if (obj == null)
        return value;
    let paths = Array.isArray(key) ? key : [key];
    if (typeof key === 'string') {
        paths = key.split('.');
    }
    try {
        let result = obj;
        for (const k of paths) {
            result = result[k];
        }
        return result === undefined ? value : result;
    }
    catch (error) {
        return value;
    }
}
export function del(x, attr) {
    if (x != null)
        delete x[attr];
    return x;
}
export function set(self, attr, value, writable = false, enumerable = false) {
    return Object.defineProperty(self, attr, {
        value,
        enumerable,
        writable
    });
}
export const HASH_KEY = Symbol.for('HASH_KEY');
export function hash(obj) {
    if (typeof obj === 'string') {
        return hashCode(obj);
    }
    if (typeof obj === 'object') {
        if (obj[HASH_KEY] == null) {
            set(obj, HASH_KEY, uniqueId());
        }
        return obj[HASH_KEY];
    }
    return obj;
}
/**
 * A hash value generator for strings
 *
 * @param {string} str
 * @return {number}
 * @see http://isthe.com/chongo/tech/comp/fnv/
 */
export function hashCode(str) {
    const FNV1_32A_INIT = 0x811c9dc5;
    let hval = FNV1_32A_INIT;
    for (let i = 0; i < str.length; ++i) {
        hval ^= str.charCodeAt(i);
        hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    return hval >>> 0;
}
export const bin = (n) => n.toString(2);
export const hex = (n) => n.toString(16);
export const oct = (n) => n.toString(8);
export const float = (x) => parseFloat(x);
export const int = (x, base = 10) => parseInt(x, base);
export const list = (arr) => (arr ? Array.from(arr) : []);
export const next = (iter) => iter.next().value;
