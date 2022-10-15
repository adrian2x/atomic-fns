/** Returns a random float between a [min, max) value (max exclusive). */
export declare const random: (min?: number, max?: number) => number;
/** Returns a random integer between a [min, max] value (inclusive). */
export declare const randomInt: (min?: number, max?: number) => number;
/** Returns the item at some random index in a sequence. */
export declare const choice: (arr: any[]) => any;
/**
 * Returns a random sample of size k from a list of items.
 *
 * @export
 * @param {any[]} arr
 * @param {number} k
 * @return
 */
export declare function sample(arr: any[], k: number): any[] | undefined;
/**
 * Shuffles a collection elements in-place. Uses the Fisher-Yates algorithm for uniform shuffling. If collection is an Object it returns shuffled `Object.values()`.
 *
 * @param {*} arr
 * @return
 */
export declare function shuffle(arr: any): any;
