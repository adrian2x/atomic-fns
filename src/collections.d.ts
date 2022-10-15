import { Function, Iteratee } from './globals.js';
/**
 * A container type that provides contains().
 *
 *
 * @interface Container
 */
export interface Container {
    contains: (x: any) => boolean;
}
/**
 * These are the "rich comparison" methods, inspired by Python operators.
 *
 *
 * @interface Comparable
 */
export interface Comparable {
    /** x < y: calls this.lt(other) reflection. */
    lt?: (other: any) => boolean;
    /** x ≤ y: calls this.le(other) reflection. */
    le?: (other: any) => boolean;
    /** x == y: calls this.eq(other) reflection. */
    eq: (other: any) => boolean;
    /** x != y: calls this.ne(other) reflection. */
    ne: (other: any) => boolean;
    /** x > y: calls this.gt(other) reflection. */
    gt?: (other: any) => boolean;
    /** x ≥ y: calls this.ge(other) reflection. */
    ge?: (other: any) => boolean;
}
/**
 * A Collection is an iterable container type.
 * This is an abstract base class for user-defined collection types.
 *
 *
 * @abstract
 * @class Collection
 * @implements {Container}
 */
export declare abstract class Collection implements Container {
    /**
     * Returns an iterator for the container items
     * @return {Iterator}
     */
    [Symbol.iterator](): this;
    /**
     * Implements the iterator protocol and returns the next item in the iterable.
     */
    next(): void;
    /**
     * Adds a new item to the container.
     * @param item
     */
    add(item: any): void;
    /**
     * Checks if item is present in the container.
     * @param item
     */
    contains(item: any): boolean;
    /**
     * Returns the total number of elements in the container.
     */
    size(): number;
    /**
     * Remove the first item from the container where `item == x`
     * @raises ValueError when x is not found
     */
    remove(x: any): void;
    /**
     * Retrieve and remove the item at index `i`.
     * @returns the item or undefined if not found.
     */
    pop(i: any): void;
    /**
     * Remove all items from the container
     */
    clear(): void;
}
/**
 * Implements an iterable that allows backward iteration.
 * @interface Reversible
 */
export interface Reversible<T = unknown> {
    reversed: () => Iterator<T>;
}
/**
 * A sequence is an iterable type with efficient index-based access.
 *
 *
 * @abstract
 * @class Sequence
 * @extends {Collection}
 * @template T
 */
export declare abstract class Sequence<T> extends Collection implements Reversible<T> {
    /**
     * Return the item at the given key or index
     * @param {*} key
     * @memberof Sequence
     */
    get(key: any): T | undefined;
    /**
     * Set a new value at the given key or index
     *
     * @param {*} key
     * @param {T} val
     * @memberof Sequence
     */
    set(key: any, val: T): void;
    /**
     * Deletes the given key or index, and its value.
     * Raises ValueError if not key is found.
     *
     * @param {*} key
     * @memberof Sequence
     */
    delete(key: any): void;
    /**
     * Adds a new item to the end of the sequence.
     *
     * @param {T} x
     * @memberof Sequence
     */
    append(x: T): void;
    /**
     * Append all the items to the sequence.
     *
     * @param {Iterable<T>} iter
     * @memberof Sequence
     */
    extend(iter: Iterable<T>): void;
    /**
     * Return the index of x in the sequence, or undefined if not found.
     *
     * @param {T} item
     * @return {(number | undefined)}
     * @memberof Sequence
     */
    indexOf(item: T): number | undefined;
    size(): number;
    reversed(): Iterator<T>;
}
/**
 * Returns a new immutable Set object with elements from `iterable`. Its contents cannot be altered after it's created.
 *
 *
 * @class FrozenSet
 * @extends {Set<T>}
 * @template T
 */
export declare class FrozenSet<T = any> extends Set<T> {
    constructor(iterable: Iterable<T>);
    add(): this;
    delete(): boolean;
    clear(): this;
    freeze(): Readonly<this>;
}
export declare const compact: (...arr: any[]) => any[];
/**
 * Creates a function that can be used to create named tuple-like objects.
 * @example
 * ```
 * let Point = namedtuple('x', 'y', 'z')
 * let userObj = User(0, 0, 0)
 * // -> {x: 0, y: 0, z: 0}
 * ```
 *
 *
 * @param {...string[]} fields
 * @return
 */
export declare function namedtuple(...fields: string[]): (...args: any[]) => {};
export declare function filter(arr: any, fn?: Iteratee | PropertyKey | Object): any[] | undefined;
export declare function find(arr: any, fn: Iteratee | PropertyKey | Object): any;
export declare function findRight(arr: any, fn: Iteratee | PropertyKey | Object): any;
export declare const matches: (o: any) => (x: any) => boolean;
export declare function forEach(arr: any[], fn: Iteratee): any;
export declare function forEach(arr: Object, fn: Iteratee): any;
export declare function flatten(arr: any, depth?: boolean | number): any;
export declare function flattenArray(arr: any[], depth?: boolean | number, result?: any[]): any[];
export declare function flattenObj(o: any, prefix?: string, result?: {}, keepNull?: boolean): {};
export declare const map: (arr: any, fn: Function | string) => any[] | undefined;
export declare function pick(obj: any, paths: Iteratee | string[]): {};
export declare function omit(obj: any, paths: Iteratee | string[]): {};
export declare function contains(arr: any, y: any): any;
export declare function indexOf(obj: any, x: any, start?: number): any;
export declare function lastIndexOf(obj: any, x: any, start?: any): any;
/**
 * Creates a clone of the given `obj`. If `deep` is `true` it will clone it recursively.
 *
 *
 * @param {*} obj
 * @param {boolean} [deep=false]
 * @return The clone value
 */
export declare function clone(obj: any, deep?: boolean): any;
export declare function cloneArray(arr: any, deep?: boolean): any;
export declare function cloneArrayBuffer(arrayBuffer: any): any;
export declare function cloneTypedArray(typedArray: any, isDeep: any): any;
export declare function uniq<T = any>(arr: T[], fn?: string | Iteratee): T[];
export declare function sortedUniq(arr: any, fn?: string | Iteratee): any[];
/**
 * Recursively merges own and inherited enumerable string keyed properties of source objects into the destination object. Source properties that resolve to `undefined` are skipped if a destination value exists. Array and plain object properties are merged recursively. Other objects and value types are overridden by assignment. Source objects are applied from left to right. Subsequent sources overwrite property assignments of previous sources.
 *
 * Note: this method mutates `obj`
 *
 *
 * @param {Object} obj
 * @param {...Object} sources
 * @return {Object} The destination object.
 */
export declare function merge(obj: any, ...sources: any[]): Object;
export declare function difference(...args: any[]): Generator<unknown, void, unknown>;
export declare function intersection(...args: any[]): Generator<any, void, unknown>;
export declare function union(...args: any[]): Generator<unknown, void, unknown>;
/**
 * Creates an object composed of keys generated from the results of running each element of `arr` thru `func`. The order of grouped values is determined by the order they occur in `arr`. The corresponding value of each key is an array of elements responsible for generating the key.
 *
 *
 * @param {(any[] | Object)} arr The collection to iterate over.
 * @param {(Iteratee | PropertyKey)} [func=id] The iteratee to transform keys.
 * @return {Object} Returns the composed aggregate object.
 */
export declare function groupBy(arr: any[] | Object, func?: Iteratee | PropertyKey): Object;
