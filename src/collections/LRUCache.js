import { NotImplementedError, ValueError } from '../globals/index.js';
import { IterableIterator } from '../itertools/index.js';
import { Mapping } from './abc.js';
import { getPointerArray } from './typedArrays.js';
/**
 * Base append-only Cache collection.
 */
export class Cache extends Mapping {
    capacity;
    head = 0;
    tail = 0;
    count = 0;
    items = new Map();
    forward;
    backward;
    K;
    V;
    constructor(capacity = 1024, Keys = Array, Values = Array) {
        super();
        this.capacity = capacity;
        if (typeof this.capacity !== 'number' || this.capacity <= 0)
            throw new ValueError('LRUCache capacity should be a positive integer.');
        else if (!isFinite(this.capacity) || Math.floor(this.capacity) !== this.capacity)
            throw new ValueError('LRUCache capacity should be a finite positive integer.');
        const PointerArray = getPointerArray(capacity);
        this.forward = new PointerArray(capacity);
        this.backward = new PointerArray(capacity);
        this.K = new Keys(capacity);
        this.V = new Values(capacity);
    }
    /**
     * This is just an alias of {@link Cache.set}.
     * @param {K} key The key to add (note value will be `undefined`).
     */
    add(key) {
        return this.set(key, undefined);
    }
    /**
     * Method used to check whether the key exists in the cache.
     *
     * @param  {any} key   - Key.
     * @return {boolean}
     */
    contains(key) {
        return this.items.has(key);
    }
    /**
     * Method used to clear the structure.
     */
    clear() {
        this.count = 0;
        this.head = 0;
        this.tail = 0;
        this.items = new Map();
    }
    get size() {
        return this.count;
    }
    /**
     * Method used to splay a value on top.
     *
     * @param  {number}   pointer - Pointer of the value to splay on top.
     * @return {Cache}
     */
    splayOnTop(pointer) {
        const oldHead = this.head;
        if (this.head === pointer)
            return this;
        const previous = this.backward[pointer];
        const next = this.forward[pointer];
        if (this.tail === pointer) {
            this.tail = previous;
        }
        else {
            this.backward[next] = previous;
        }
        this.forward[previous] = next;
        this.backward[oldHead] = pointer;
        this.head = pointer;
        this.forward[pointer] = oldHead;
        return this;
    }
    /**
     * Method used to get the value attached to the given key. Will move the
     * related key to the front of the underlying linked list.
     *
     * @param  {any} key   - Key.
     * @return {any}
     */
    get(key) {
        const pointer = this.items.get(key);
        if (typeof pointer === 'undefined')
            return;
        this.splayOnTop(pointer);
        return this.V[pointer];
    }
    /**
     * Method used to set the value for the given key in the cache.
     *
     * @param  {any} key   - Key.
     * @param  {any} value - Value.
     * @return {undefined}
     */
    set(key, value) {
        let pointer = this.items.get(key);
        // The key already exists, we just need to update the value and splay on top
        if (typeof pointer !== 'undefined') {
            this.splayOnTop(pointer);
            this.V[pointer] = value;
            return;
        }
        // The cache is not yet full
        if (this.count < this.capacity) {
            pointer = this.count++;
        }
        // Cache is full, we need to drop the last value
        else {
            pointer = this.tail;
            this.tail = this.backward[pointer];
            this.items.delete(this.K[pointer]);
        }
        // Storing key & value
        this.items.set(key, pointer);
        this.K[pointer] = key;
        this.V[pointer] = value;
        // Moving the item at the front of the list
        this.forward[pointer] = this.head;
        this.backward[this.head] = pointer;
        this.head = pointer;
    }
    /**
     * Method used to get the value attached to the given key. Does not modify
     * the ordering of the underlying linked list.
     *
     * @param  {any} key   - Key.
     * @return {any}
     */
    peek(key) {
        const pointer = this.items.get(key);
        if (typeof pointer === 'undefined')
            return;
        return this.V[pointer];
    }
    /**
     * Method used to iterate over the cache's entries using a callback.
     *
     * @param  {Iteratee<V>}  iteratee - Function to call for each item.
     */
    forEach(iteratee) {
        let i = 0;
        const l = this.count;
        let pointer = this.head;
        const keys = this.K;
        const values = this.V;
        const forward = this.forward;
        while (i < l) {
            iteratee(values[pointer], keys[pointer], this);
            pointer = forward[pointer];
            i++;
        }
    }
    /**
     * Method used to create an iterator over the cache's keys from most
     * recently used to least recently used.
     *
     * @return {Iterator<K>}
     */
    keys() {
        let i = 0;
        const l = this.count;
        let pointer = this.head;
        const keys = this.K;
        const forward = this.forward;
        return IterableIterator(() => {
            if (i >= l)
                return { done: true };
            const key = keys[pointer];
            i++;
            if (i < l)
                pointer = forward[pointer];
            return {
                done: false,
                value: key
            };
        });
    }
    /**
     * Method used to create an iterator over the cache's values from most
     * recently used to least recently used.
     *
     * @return {Iterator<V>}
     */
    values() {
        let i = 0;
        const l = this.count;
        let pointer = this.head;
        const values = this.V;
        const forward = this.forward;
        return IterableIterator(() => {
            if (i >= l)
                return { done: true };
            const value = values[pointer];
            i++;
            if (i < l)
                pointer = forward[pointer];
            return {
                done: false,
                value
            };
        });
    }
    /**
     * Method used to create an iterator over the cache's entries from most
     * recently used to least recently used.
     *
     * @return {Iterator<[K, V]>}
     */
    entries() {
        let i = 0;
        const l = this.count;
        let pointer = this.head;
        const keys = this.K;
        const values = this.V;
        const forward = this.forward;
        return IterableIterator(() => {
            if (i >= l)
                return { done: true };
            const key = keys[pointer];
            const value = values[pointer];
            i++;
            if (i < l)
                pointer = forward[pointer];
            return { value: [key, value] };
        });
    }
    /**
     * NotImplemented -- throws an exception.
     * @param key
     * @returns
     */
    remove(key) {
        throw new NotImplementedError(`Base Cache class does not implement remove().`);
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    /**
     * Convenience known methods.
     */
    inspect() {
        const proxy = new Map();
        const iterator = this.entries();
        let step;
        while (((step = iterator.next()), !step.done))
            proxy.set(step.value[0], step.value[1]);
        // Trick so that node displays the name of the constructor
        Object.defineProperty(proxy, 'constructor', {
            value: Cache,
            enumerable: false
        });
        return proxy;
    }
    [Symbol.for('nodejs.util.inspect.custom')]() {
        return this.inspect();
    }
}
export class LRUCache extends Cache {
    deletedSize = 0;
    deleted;
    constructor(capacity = 1024, Keys = Array, Values = Array) {
        super(capacity, Keys, Values);
        const PointerArray = getPointerArray(capacity);
        this.deleted = new PointerArray(capacity);
    }
    clear() {
        super.clear();
        this.deletedSize = 0;
    }
    /**
     * Method used to set the value for the given key in the cache.
     *
     * @param  {any} key   - Key.
     * @param  {any} value - Value.
     * @return {undefined}
     */
    set(key, value) {
        let pointer = this.items.get(key);
        // The key already exists, we just need to update the value and splay on top
        if (typeof pointer !== 'undefined') {
            this.splayOnTop(pointer);
            this.V[pointer] = value;
            return;
        }
        // The cache is not yet full
        if (this.count < this.capacity) {
            if (this.deletedSize > 0) {
                // If there is a "hole" in the pointer list, reuse it
                pointer = this.deleted[--this.deletedSize];
            }
            else {
                // otherwise append to the pointer list
                pointer = this.count;
            }
            this.count++;
        }
        // Cache is full, we need to drop the last value
        else {
            pointer = this.tail;
            this.tail = this.backward[pointer];
            this.items.delete(this.K[pointer]);
        }
        // Storing key & value
        this.items.set(key, pointer);
        this.K[pointer] = key;
        this.V[pointer] = value;
        // Moving the item at the front of the list
        this.forward[pointer] = this.head;
        this.backward[this.head] = pointer;
        this.head = pointer;
    }
    /**
     * Method used to delete the entry for the given key in the cache.
     *
     * @param  {any} key   - Key.
     * @return {boolean}   - true if the item was present
     */
    delete(key) {
        const pointer = this.items.get(key);
        if (typeof pointer === 'undefined') {
            return false;
        }
        this.items.delete(key);
        if (this.count === 1) {
            this.count = 0;
            this.head = 0;
            this.tail = 0;
            this.deletedSize = 0;
            return true;
        }
        const previous = this.backward[pointer];
        const next = this.forward[pointer];
        if (this.head === pointer) {
            this.head = next;
        }
        if (this.tail === pointer) {
            this.tail = previous;
        }
        this.forward[previous] = next;
        this.backward[next] = previous;
        this.count--;
        this.deleted[this.deletedSize++] = pointer;
        return true;
    }
    /**
     * Method used to remove and return the value for the given key in the cache.
     *
     * @param  {any} key                 - Key.
     * @return {any} The value, if present; the missing indicator if absent
     */
    remove(key) {
        const pointer = this.items.get(key);
        if (typeof pointer === 'undefined') {
            return;
        }
        const dead = this.V[pointer];
        this.items.delete(key);
        if (this.count === 1) {
            this.count = 0;
            this.head = 0;
            this.tail = 0;
            this.deletedSize = 0;
            return dead;
        }
        const previous = this.backward[pointer];
        const next = this.forward[pointer];
        if (this.head === pointer) {
            this.head = next;
        }
        if (this.tail === pointer) {
            this.tail = previous;
        }
        this.forward[previous] = next;
        this.backward[next] = previous;
        this.count--;
        this.deleted[this.deletedSize++] = pointer;
        return dead;
    }
}
