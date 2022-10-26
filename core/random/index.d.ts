/**
 * This module implements pseudo-random generators for various distributions.
 *
 * @module Random
 */
/**
 * Returns a random float between a [min, max) value (max exclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export declare const random: (min?: number, max?: number) => number;
/**
 * Returns a random integer between a [min, max] value (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export declare const randomInt: (min?: number, max?: number) => number;
/**
 * Returns the item at some random index in a sequence.
 * @returns {T}
 * @template T
 */
export declare const choice: <T>(arr: T[]) => T | undefined;
/**
 * Returns a random sample of size k from a list of items.
 * @param {Array} arr
 * @param {number} size
 * @returns A new array with `size` random elements from `arr`.
 * @template T
 */
export declare function sample<T>(arr: T[], size: number): T[];
/**
 * Shuffles a collection elements in-place. Uses the Fisher-Yates algorithm for uniform shuffling. If collection is an Object it returns shuffled `Object.values()`.
 *
 * @param {Array} arr
 * @param {number} size
 * @returns The shuffled array.
 * @template T
 */
export declare function shuffle<T>(arr: T[], size?: number): T[];
