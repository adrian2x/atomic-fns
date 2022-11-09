import { Iteratee } from '../globals/index.js';
import { Sequence } from './abc.js';
/**
 * Fixed capacity double-ended queue implemented as ring deque.
 * @template T
 */
export declare class Deque<T = any> extends Sequence<T> {
    items: T[];
    start: number;
    count: number;
    capacity: number;
    ArrayConstructor: any;
    /**
     * Creates a new `Deque` instance of a fixed size.
     * @param {Array} [arrType = []] The initial elements or array type to use (accepts any kind of typed array).
     * @param {number} [capacity=1024] The fixed size of the deque. Defaults to `1024`.
     */
    constructor(arrType?: T[], capacity?: number);
    /** Returns the total number of elements in the deque. */
    get size(): number;
    /**
     * Method used to clear the structure.
     */
    clear(): void;
    /**
     * Alias of {@link Deque.append}
     * @param {T} item Item to append.
     * @returns {number} Returns the new size of the deque.
     */
    add(item: any): number;
    /**
     * Appends a new element to the end of the deque.
     * @param {T} item Item to append.
     * @returns {number} Returns the new size of the deque.
     */
    append(item: any): number;
    /**
     * Appends a new element to the beginning of the deque.
     * @param {T} item Item to prepend.
     * @returns {number} Returns the new size of the deque.
     */
    appendleft(item: any): number;
    /**
     * Removes and returns the element at the end of the deque.
     * @returns {?T} Returns the popped item.
     */
    pop(): T;
    /**
     * Alias of {@link Deque.pop}
     * @returns {?T} Returns the popped item.
     */
    remove(): T;
    /**
     * Removes and returns the element at the beginning of the deque.
     * @returns {?T} Returns the removed deque element.
     */
    popleft(): T;
    /**
     * Returns the element at the beginning of the deque.
     * @returns {?T} The element if exists
     */
    first(): T;
    /**
     * Returns the element at a specified index position in the deque.
     * @param {number} index The given index
     * @returns {?T} The element if exists
     */
    get(index: any): T;
    /**
     * Update the element at a given `index`.
     * @param {number} index The given index
     */
    set(index: number, value: T): void;
    /**
     * Check if a given element is in the deque.
     * @param {T} x The value to find
     * @returns {boolean} `true` if the value is found
     */
    contains(x: any): boolean;
    /**
     * Returns the first element that matches the `iteratee` function.
     * @param {Iteratee<T>} iteratee A function that will be invoked per element
     * @returns {?T} The element if exists
     */
    find(iteratee: Iteratee<T>): T;
    /**
     * Calls `iteratee` function for every element in the deque.
     * @param {Iteratee<T>} iteratee A function that will be invoked per element
     */
    forEach(iteratee: any): void;
    /**
     * Returns a new array with all the elements in reverse order.
     * @returns {Array<T>} The elements reversed
     */
    reversed(): any;
    /**
     * Returns a new array with all the elements in the order they were added to the deque.
     * @returns {Array<T>} The elements array
     */
    toArray(): any;
    /**
     * Returns an iterator over the deque's values.
     * @returns {Iterator}
     */
    values(): Iterable<T>;
    /**
     * Alias of {@link Deque.values}. Returns iterator of values.
     */
    keys(): Iterable<T>;
    /**
     * Creates an iterator of `[index, value]` pairs for all elements in the deque.
     * @returns {Iterator}
     */
    entries(): Iterator<[number, T], any, undefined> & Iterable<[number, T]>;
    [Symbol.iterator](): Iterable<T>;
    inspect(): any;
}
