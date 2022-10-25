/**
 * When using an unsigned integer array to store pointers, one might want to
 * choose the optimal word size in regards to the actual numbers of pointers
 * to store.
 *
 * This helpers does just that.
 *
 * @param  {number} size - Expected size of the array to map.
 * @return {TypedArray}
 */
const MAX_8BIT_INTEGER = Math.pow(2, 8) - 1;
const MAX_16BIT_INTEGER = Math.pow(2, 16) - 1;
const MAX_32BIT_INTEGER = Math.pow(2, 32) - 1;
const MAX_SIGNED_8BIT_INTEGER = Math.pow(2, 7) - 1;
const MAX_SIGNED_16BIT_INTEGER = Math.pow(2, 15) - 1;
const MAX_SIGNED_32BIT_INTEGER = Math.pow(2, 31) - 1;
export function getPointerArray(size) {
    const maxIndex = size - 1;
    if (maxIndex <= MAX_8BIT_INTEGER)
        return Uint8Array;
    if (maxIndex <= MAX_16BIT_INTEGER)
        return Uint16Array;
    if (maxIndex <= MAX_32BIT_INTEGER)
        return Uint32Array;
    throw new Error('mnemonist: Pointer Array of size > 4294967295 is not supported.');
}
export function getSignedPointerArray(size) {
    const maxIndex = size - 1;
    if (maxIndex <= MAX_SIGNED_8BIT_INTEGER)
        return Int8Array;
    if (maxIndex <= MAX_SIGNED_16BIT_INTEGER)
        return Int16Array;
    if (maxIndex <= MAX_SIGNED_32BIT_INTEGER)
        return Int32Array;
    return Float64Array;
}
/**
 * Function returning the minimal type able to represent the given number.
 *
 * @param  {number} value - Value to test.
 * @return {TypedArrayClass}
 */
export function getNumberType(value) {
    // <= 32 bits itnteger?
    if (value === (value | 0)) {
        // Negative
        if (Math.sign(value) === -1) {
            if (value <= 127 && value >= -128)
                return Int8Array;
            if (value <= 32767 && value >= -32768)
                return Int16Array;
            return Int32Array;
        }
        else {
            if (value <= 255)
                return Uint8Array;
            if (value <= 65535)
                return Uint16Array;
            return Uint32Array;
        }
    }
    // 53 bits integer & floats
    // NOTE: it's kinda hard to tell whether we could use 32bits or not...
    return Float64Array;
}
/**
 * Function returning the minimal type able to represent the given array
 * of JavaScript numbers.
 *
 * @param  {array}    array  - Array to represent.
 * @param  {function} getter - Optional getter.
 * @return {TypedArrayClass}
 */
const TYPE_PRIORITY = {
    Uint8Array: 1,
    Int8Array: 2,
    Uint16Array: 3,
    Int16Array: 4,
    Uint32Array: 5,
    Int32Array: 6,
    Float32Array: 7,
    Float64Array: 8
};
export function getMinimalRepresentation(array, getter) {
    let maxType = null;
    let maxPriority = 0;
    let p;
    let t;
    let v;
    let i;
    let l;
    for (i = 0, l = array.length; i < l; i++) {
        v = getter ? getter(array[i]) : array[i];
        t = exports.getNumberType(v);
        p = TYPE_PRIORITY[t.name];
        if (p > maxPriority) {
            maxPriority = p;
            maxType = t;
        }
    }
    return maxType;
}
/**
 * Function returning whether the given value is a typed array.
 *
 * @param  {any} value - Value to test.
 * @return {boolean}
 */
export function isTypedArray(value) {
    return ArrayBuffer.isView(value);
}
/**
 * Function used to concat byte arrays.
 *
 * @param  {...ByteArray}
 * @return {ByteArray}
 */
export function concat() {
    let length = 0;
    let i;
    let o;
    let l;
    for (i = 0, l = arguments.length; i < l; i++)
        length += arguments[i].length;
    const array = new arguments[0].constructor(length);
    for (i = 0, o = 0; i < l; i++) {
        array.set(arguments[i], o);
        o += arguments[i].length;
    }
    return array;
}
/**
 * Function used to initialize a byte array of indices.
 *
 * @param  {number}    length - Length of target.
 * @return {ByteArray}
 */
export function indices(length) {
    const PointerArray = exports.getPointerArray(length);
    const array = new PointerArray(length);
    for (let i = 0; i < length; i++)
        array[i] = i;
    return array;
}
