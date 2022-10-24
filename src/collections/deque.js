import { KeyError, ValueError } from '../globals/index.js';
import { IterableIterator } from '../itertools/index.js';
import { eq } from '../operators/index.js';
import { Sequence } from './abc.js';
/**
 * Fixed capacity double-ended queue implemented as ring deque.
 *
 * @constructor
 */
export class Deque extends Sequence {
    ArrayClass;
    capacity;
    items;
    start = 0;
    count = 0;
    constructor(ArrayClass = [], capacity = 1024) {
        super();
        if (typeof capacity !== 'number' || capacity <= 0)
            throw new ValueError(`Deque capacity should be a positive integer.`);
        this.ArrayClass = ArrayClass.constructor;
        this.capacity = capacity;
        this.items = new this.ArrayClass(ArrayClass.length || this.capacity);
        this.clear();
        if (ArrayClass.length) {
            for (const item of ArrayClass) {
                this.append(item);
            }
        }
    }
    size() {
        return this.count;
    }
    /**
     * Method used to clear the structure.
     *
     * @return {undefined}
     */
    clear() {
        // Properties
        this.start = 0;
        this.count = 0;
    }
    /**
     * Alias of {@link Deque.append}
     *
     * @param  {any}    item - Item to append.
     * @return {number}      - Returns the new size of the deque.
     */
    add(item) {
        return this.append(item);
    }
    /**
     * Method used to append a value to the deque.
     *
     * @param  {any}    item - Item to append.
     * @return {number}      - Returns the new size of the deque.
     */
    append(item) {
        if (this.count === this.capacity)
            this.popleft();
        const index = (this.start + this.count) % this.capacity;
        this.items[index] = item;
        return ++this.count;
    }
    /**
     * Method used to prepend a value to the deque.
     *
     * @param  {any}    item - Item to prepend.
     * @return {number}      - Returns the new size of the deque.
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
     * Method used to pop the deque.
     *
     * @return {any} - Returns the popped item.
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
     */
    remove() {
        return this.pop();
    }
    /**
     * Method used to shift the deque.
     *
     * @return {any} - Returns the shifted item.
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
     * Method used to peek the first value of the deque.
     *
     * @return {any}
     */
    first() {
        if (this.count === 0)
            return;
        return this.items[this.start];
    }
    /**
     * Method used to get the desired value of the deque.
     *
     * @param  {number} index
     * @return {any}
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
     * Update the value at a given `index`.
     * @param index The given index
     * @param value The new value to set at `index`.
     */
    set(index, value) {
        if (index < 0)
            index += this.count;
        if (index > this.count)
            throw new KeyError(`Invalid index: ${index} not in Deque.`);
        this.items[index] = value;
    }
    contains(x) {
        for (const value of this.values()) {
            if (eq(x, value))
                return true;
        }
        return false;
    }
    find(iteratee) {
        for (const [key, value] of this.entries()) {
            if (iteratee(value, key, this))
                return value;
        }
    }
    /**
     * Method used to iterate over the deque.
     *
     * @param  {function}  iteratee - Function to call for each item.
     * @param  {object}    scope    - Optional scope.
     * @return {undefined}
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
    reversed() {
        return this.toArray().reverse();
    }
    /**
     * Method used to convert the deque to a JavaScript array.
     *
     * @return {array}
     */
    toArray() {
        // Optimization
        const offset = this.start + this.count;
        if (offset < this.capacity)
            return this.items.slice(this.start, offset);
        const array = new this.ArrayClass(this.count);
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
     * Method used to create an iterator over the deque's values.
     *
     * @return {Iterator}
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
    keys() {
        return this.values();
    }
    /**
     * Method used to create an iterator over the deque's entries.
     *
     * @return {Iterator}
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
    inspect() {
        const array = this.toArray();
        array.type = this.ArrayClass.name;
        array.capacity = this.capacity;
        // Trick so that node displays the name of the constructor
        Object.defineProperty(array, 'constructor', {
            value: Deque,
            enumerable: false
        });
        return array;
    }
}
