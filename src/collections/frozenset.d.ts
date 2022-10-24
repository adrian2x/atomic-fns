/**
 * Returns a new immutable Set object with elements from `iterable`. Its contents cannot be altered after it's created.
 *
 *
 * @class FrozenSet
 * @extends {Set<T>}
 * @template T
 */
export declare class FrozenSet<T = any> extends Set<T> {
    constructor(iterable: Iterable<T>);
    /** @private */
    add(): this;
    /** @private */
    delete(): boolean;
    /** @private */
    clear(): this;
    /** @private */
    freeze(): Readonly<this>;
}
