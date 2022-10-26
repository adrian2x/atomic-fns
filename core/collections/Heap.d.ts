import type { Comparer } from '../operators/index.js';
import { compare } from '../operators/index.js';
import { Collection } from './abc.js';
export declare class Heap<T> extends Collection {
    private readonly heap;
    private readonly compare;
    private count;
    /**
     * Initializes a new Heap instance.
     *
     * **Note:** When constructing the heap from an array, it will operate directly on this array. For other iterables, it will create a new array.
     *
     * @param {Iterable<T>} [container=[]] The initial values.
     * @param {Comparer} [cmp=compare] Compare function. Defaults to smaller values first.
     */
    constructor(container?: Iterable<T>, cmp?: Comparer);
    at(n: number): T | undefined;
    get size(): number;
    clear(): void;
    /**
     * Push element into a container in order.
     * @param item The element to push.
     */
    add(item: T): void;
    /**
     * Removes the top element.
     */
    pop(): T | undefined;
    /**
     * Accesses the top element.
     */
    top(): T | undefined;
    /**
     * Check if element is in heap.
     * @param item The item want to find.
     * @return `true` if element exists.
     */
    contains(item: T): boolean;
    /**
     * Remove specified item from heap.
     * @param item The item want to remove.
     * @return `true` if the item was removed.
     */
    remove(item: T): boolean;
    /**
     * Returns an iterable with all the values in the heap.
     * @returns {Iterable<T>} The values in the heap.
     */
    values(): IterableIterator<T>;
}
/**
 * Transform any array into a heap, in-place, in linear time.
 * @param {Array} heap
 * @param {Comparer} [compareFn=compare] Custom compare function
 */
export declare function heapify(heap: any, compareFn?: typeof compare): void;
/**
 * Push the value `item` onto the `heap`, maintaining the heap invariant.
 * @param {Array} heap
 * @param {*} item
 * @param {Comparer} [compareFn=compare] Custom compare function
 */
export declare function heappush<T>(heap: T[], item: T, compareFn?: typeof compare): void;
/**
 * Pop and return the smallest item from the `heap`, maintaining the heap invariant.
 * @param {Array} heap
 * @param {Comparer} [compareFn=compare] Custom compare function
 */
export declare function heappop<T>(heap: T[], compareFn?: typeof compare): T;
