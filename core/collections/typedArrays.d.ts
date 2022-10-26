export declare function getPointerArray(size: any): Uint8ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor;
export declare function getSignedPointerArray(size: any): Int8ArrayConstructor | Int16ArrayConstructor | Int32ArrayConstructor | Float64ArrayConstructor;
/**
 * Function returning the minimal type able to represent the given number.
 *
 * @param  {number} value - Value to test.
 * @return {TypedArrayClass}
 */
export declare function getNumberType(value: any): Uint8ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor | Int8ArrayConstructor | Int16ArrayConstructor | Int32ArrayConstructor | Float64ArrayConstructor;
export declare function getMinimalRepresentation(array: any, getter: any): null;
/**
 * Function returning whether the given value is a typed array.
 *
 * @param  {any} value - Value to test.
 * @return {boolean}
 */
export declare function isTypedArray(value: any): boolean;
/**
 * Function used to concat byte arrays.
 *
 * @param  {...ByteArray}
 * @return {ByteArray}
 */
export declare function concat(): any;
/**
 * Function used to initialize a byte array of indices.
 *
 * @param  {number}    length - Length of target.
 * @return {ByteArray}
 */
export declare function indices(length: any): any;
