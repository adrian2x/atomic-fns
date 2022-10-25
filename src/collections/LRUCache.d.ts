import { Iteratee } from '../globals/index.js';
import { Mapping } from './abc.js';
/**
 * Base append-only Cache collection.
 */
export declare class Cache<K, V = any> extends Mapping<K, V> {
    capacity: number;
    head: number;
    tail: number;
    count: number;
    protected items: Map<K, number>;
    protected forward: Uint8Array | Uint16Array | Uint32Array;
    protected backward: Uint8Array | Uint16Array | Uint32Array;
    protected K: K[];
    protected V: V[];
    constructor(capacity?: number, Keys?: ArrayConstructor, Values?: ArrayConstructor);
    /**
     * This is just an alias of {@link Cache.set}.
     * @param {K} key The key to add (note value will be `undefined`).
     */
    add(key: K): void;
    /**
     * Method used to check whether the key exists in the cache.
     *
     * @param  {any} key   - Key.
     * @return {boolean}
     */
    contains(key: any): boolean;
    /**
     * Method used to clear the structure.
     */
    clear(): void;
    get size(): number;
    /**
     * Method used to splay a value on top.
     *
     * @param  {number}   pointer - Pointer of the value to splay on top.
     * @return {Cache}
     */
    protected splayOnTop(pointer: any): this;
    /**
     * Method used to get the value attached to the given key. Will move the
     * related key to the front of the underlying linked list.
     *
     * @param  {any} key   - Key.
     * @return {any}
     */
    get(key: any): V | undefined;
    /**
     * Method used to set the value for the given key in the cache.
     *
     * @param  {any} key   - Key.
     * @param  {any} value - Value.
     * @return {undefined}
     */
    set(key: any, value: any): void;
    /**
     * Method used to get the value attached to the given key. Does not modify
     * the ordering of the underlying linked list.
     *
     * @param  {any} key   - Key.
     * @return {any}
     */
    peek(key: any): V | undefined;
    /**
     * Method used to iterate over the cache's entries using a callback.
     *
     * @param  {Iteratee<V>}  iteratee - Function to call for each item.
     */
    forEach(iteratee: Iteratee<V>): void;
    /**
     * Method used to create an iterator over the cache's keys from most
     * recently used to least recently used.
     *
     * @return {Iterator<K>}
     */
    keys(): Iterator<any, any, undefined> & Iterable<any>;
    /**
     * Method used to create an iterator over the cache's values from most
     * recently used to least recently used.
     *
     * @return {Iterator<V>}
     */
    values(): Iterator<any, any, undefined> & Iterable<any>;
    /**
     * Method used to create an iterator over the cache's entries from most
     * recently used to least recently used.
     *
     * @return {Iterator<[K, V]>}
     */
    entries(): Iterator<[K, V], any, undefined> & Iterable<[K, V]>;
    /**
     * NotImplemented -- throws an exception.
     * @param key
     * @returns
     */
    remove(key: any): void;
    [Symbol.iterator](): Iterator<[K, V], any, undefined> & Iterable<[K, V]>;
    /**
     * Convenience known methods.
     */
    inspect(): Map<any, any>;
}
export declare class LRUCache<K, V> extends Cache<K, V> {
    deletedSize: number;
    deleted: Uint8Array | Uint16Array | Uint32Array;
    constructor(capacity?: number, Keys?: ArrayConstructor, Values?: ArrayConstructor);
    clear(): void;
    /**
     * Method used to set the value for the given key in the cache.
     *
     * @param  {any} key   - Key.
     * @param  {any} value - Value.
     * @return {undefined}
     */
    set(key: any, value: any): void;
    /**
     * Method used to delete the entry for the given key in the cache.
     *
     * @param  {any} key   - Key.
     * @return {boolean}   - true if the item was present
     */
    delete(key: any): boolean;
    /**
     * Method used to remove and return the value for the given key in the cache.
     *
     * @param  {any} key                 - Key.
     * @return {any} The value, if present; the missing indicator if absent
     */
    remove(key: any): V | undefined;
}
