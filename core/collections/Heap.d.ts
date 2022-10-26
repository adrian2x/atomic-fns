import type { Comparer } from '../operators/index.js';
import { Collection } from './abc.js';
export declare class Heap<T> extends Collection {
    private readonly items;
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
    values(): IterableIterator<T>;
    private heapifyUp;
    private heapifyDown;
}
