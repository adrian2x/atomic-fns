import { KeyError, ValueError } from '../globals/index.js';
import { IterableIterator } from '../itertools/index.js';
import { eq } from '../operators/index.js';
import { Sequence } from './abc.js';
/**
 * Fixed capacity double-ended queue implemented as ring deque.
 * @template T
 */
export class Deque extends Sequence {
    items;
    start = 0;
    count = 0;
    capacity;
    ArrayConstructor;
    /**
     * Creates a new `Deque` instance of a fixed size.
     * @param {Array} [arrType = []] The initial elements or array type to use (accepts any kind of typed array).
     * @param {number} [capacity=1024] The fixed size of the deque. Defaults to `1024`.
     */
    constructor(arrType = [], capacity = 1024) {
        super();
        if (typeof capacity !== 'number' || capacity <= 0)
            throw new ValueError(`Deque capacity should be a positive integer.`);
        this.ArrayConstructor = arrType.constructor;
        this.capacity = capacity;
        this.items = new this.ArrayConstructor(arrType.length || this.capacity);
        this.clear();
        if (arrType.length) {
            for (const item of arrType) {
                this.append(item);
            }
        }
    }
    /** Returns the total number of elements in the deque. */
    get size() {
        return this.count;
    }
    /**
     * Method used to clear the structure.
     */
    clear() {
        // Properties
        this.start = 0;
        this.count = 0;
    }
    /**
     * Alias of {@link Deque.append}
     * @param {T} item Item to append.
     * @returns {number} Returns the new size of the deque.
     */
    add(item) {
        return this.append(item);
    }
    /**
     * Appends a new element to the end of the deque.
     * @param {T} item Item to append.
     * @returns {number} Returns the new size of the deque.
     */
    append(item) {
        if (this.count === this.capacity)
            this.popleft();
        const index = (this.start + this.count) % this.capacity;
        this.items[index] = item;
        return ++this.count;
    }
    /**
     * Appends a new element to the beginning of the deque.
     * @param {T} item Item to prepend.
     * @returns {number} Returns the new size of the deque.
     */
    appendleft(item) {
        if (this.count === this.capacity)
            this.pop();
        let index = this.start - 1;
        if (this.start === 0)
            index = this.capacity - 1;
        this.items[index] = item;
        this.start = index;
        return ++this.count;
    }
    /**
     * Removes and returns the element at the end of the deque.
     * @returns {?T} Returns the popped item.
     */
    pop() {
        if (this.count === 0)
            return;
        const index = (this.start + this.count - 1) % this.capacity;
        this.count--;
        return this.items[index];
    }
    /**
     * Alias of {@link Deque.pop}
     * @returns {?T} Returns the popped item.
     */
    remove() {
        return this.pop();
    }
    /**
     * Removes and returns the element at the beginning of the deque.
     * @returns {?T} Returns the removed deque element.
     */
    popleft() {
        if (this.count === 0)
            return;
        const index = this.start;
        this.count--;
        this.start++;
        if (this.start === this.capacity)
            this.start = 0;
        return this.items[index];
    }
    /**
     * Returns the element at the beginning of the deque.
     * @returns {?T} The element if exists
     */
    first() {
        if (this.count === 0)
            return;
        return this.items[this.start];
    }
    /**
     * Returns the element at a specified index position in the deque.
     * @param {number} index The given index
     * @returns {?T} The element if exists
     */
    get(index) {
        if (this.count === 0)
            return;
        index = this.start + index;
        if (index < 0)
            index += this.count;
        if (index > this.capacity)
            index -= this.capacity;
        return this.items[index];
    }
    /**
     * Update the element at a given `index`.
     * @param {number} index The given index
     */
    set(index, value) {
        if (index < 0)
            index += this.count;
        if (index > this.count)
            throw new KeyError(`Invalid index: ${index} not in Deque.`);
        this.items[index] = value;
    }
    /**
     * Check if a given element is in the deque.
     * @param {T} x The value to find
     * @returns {boolean} `true` if the value is found
     */
    contains(x) {
        for (const value of this.values()) {
            if (eq(x, value))
                return true;
        }
        return false;
    }
    /**
     * Returns the first element that matches the `iteratee` function.
     * @param {Iteratee<T>} iteratee A function that will be invoked per element
     * @returns {?T} The element if exists
     */
    find(iteratee) {
        for (const [key, value] of this.entries()) {
            if (iteratee(value, key, this))
                return value;
        }
    }
    /**
     * Calls `iteratee` function for every element in the deque.
     * @param {Iteratee<T>} iteratee A function that will be invoked per element
     */
    forEach(iteratee) {
        const c = this.capacity;
        const l = this.count;
        let i = this.start;
        let j = 0;
        while (j < l) {
            iteratee(this.items[i], j, this);
            i++;
            j++;
            if (i === c)
                i = 0;
        }
    }
    /**
     * Returns a new array with all the elements in reverse order.
     * @returns {Array<T>} The elements reversed
     */
    reversed() {
        return this.toArray().reverse();
    }
    /**
     * Returns a new array with all the elements in the order they were added to the deque.
     * @returns {Array<T>} The elements array
     */
    toArray() {
        // Optimization
        const offset = this.start + this.count;
        if (offset < this.capacity)
            return this.items.slice(this.start, offset);
        const array = new this.ArrayConstructor(this.count);
        const c = this.capacity;
        const l = this.count;
        let i = this.start;
        let j = 0;
        while (j < l) {
            array[j] = this.items[i];
            i++;
            j++;
            if (i === c)
                i = 0;
        }
        return array;
    }
    /**
     * Returns an iterator over the deque's values.
     * @returns {Iterator}
     */
    values() {
        const items = this.items;
        const c = this.capacity;
        const l = this.count;
        let i = this.start;
        let j = 0;
        return IterableIterator(() => {
            if (j >= l)
                return {
                    done: true
                };
            const value = items[i];
            i++;
            j++;
            if (i === c)
                i = 0;
            return {
                value,
                done: false
            };
        });
    }
    /**
     * Alias of {@link Deque.values}. Returns iterator of values.
     */
    keys() {
        return this.values();
    }
    /**
     * Creates an iterator of `[index, value]` pairs for all elements in the deque.
     * @returns {Iterator}
     */
    entries() {
        const items = this.items;
        const c = this.capacity;
        const l = this.count;
        let i = this.start;
        let j = 0;
        return IterableIterator(() => {
            if (j >= l)
                return {
                    done: true
                };
            const value = items[i];
            i++;
            if (i === c)
                i = 0;
            return {
                value: [j++, value],
                done: false
            };
        });
    }
    [Symbol.iterator]() {
        return this.values();
    }
    [Symbol.for('nodejs.util.inspect.custom')]() {
        return this.inspect();
    }
    // This is just for debugging in nodejs
    inspect() {
        const array = this.toArray();
        array.type = this.ArrayConstructor.name;
        array.capacity = this.capacity;
        // Trick so that node displays the name of the constructor
        Object.defineProperty(array, 'constructor', {
            value: Deque,
            enumerable: false
        });
        return array;
    }
}
