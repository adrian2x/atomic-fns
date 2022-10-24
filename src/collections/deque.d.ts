import { Iteratee } from '../globals/index.js';
import { Sequence } from './abc.js';
/**
 * Fixed capacity double-ended queue implemented as ring deque.
 *
 * @constructor
 */
export declare class Deque<T> extends Sequence<T> {
    ArrayClass: any;
    capacity: number;
    items: T[];
    start: number;
    count: number;
    constructor(ArrayClass?: T[], capacity?: number);
    size(): number;
    /**
     * Method used to clear the structure.
     *
     * @return {undefined}
     */
    clear(): void;
    /**
     * Alias of {@link Deque.append}
     *
     * @param  {any}    item - Item to append.
     * @return {number}      - Returns the new size of the deque.
     */
    add(item: any): number;
    /**
     * Method used to append a value to the deque.
     *
     * @param  {any}    item - Item to append.
     * @return {number}      - Returns the new size of the deque.
     */
    append(item: any): number;
    /**
     * Method used to prepend a value to the deque.
     *
     * @param  {any}    item - Item to prepend.
     * @return {number}      - Returns the new size of the deque.
     */
    appendleft(item: any): number;
    /**
     * Method used to pop the deque.
     *
     * @return {any} - Returns the popped item.
     */
    pop(): T | undefined;
    /**
     * Alias of {@link Deque.pop}
     */
    remove(): T | undefined;
    /**
     * Method used to shift the deque.
     *
     * @return {any} - Returns the shifted item.
     */
    popleft(): T | undefined;
    /**
     * Method used to peek the first value of the deque.
     *
     * @return {any}
     */
    first(): T | undefined;
    /**
     * Method used to get the desired value of the deque.
     *
     * @param  {number} index
     * @return {any}
     */
    get(index: any): T | undefined;
    /**
     * Update the value at a given `index`.
     * @param index The given index
     * @param value The new value to set at `index`.
     */
    set(index: number, value: T): void;
    contains(x: any): boolean;
    find(iteratee: Iteratee<T>): T | undefined;
    /**
     * Method used to iterate over the deque.
     *
     * @param  {function}  iteratee - Function to call for each item.
     * @param  {object}    scope    - Optional scope.
     * @return {undefined}
     */
    forEach(iteratee: any): void;
    reversed(): any;
    /**
     * Method used to convert the deque to a JavaScript array.
     *
     * @return {array}
     */
    toArray(): any;
    /**
     * Method used to create an iterator over the deque's values.
     *
     * @return {Iterator}
     */
    values(): Iterable<T>;
    keys(): Iterable<T>;
    /**
     * Method used to create an iterator over the deque's entries.
     *
     * @return {Iterator}
     */
    entries(): Iterator<[number, T], any, undefined> & Iterable<[number, T]>;
    [Symbol.iterator](): Iterable<T>;
    inspect(): any;
}
