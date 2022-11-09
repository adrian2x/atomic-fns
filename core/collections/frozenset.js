/**
 * Returns a new immutable Set object with elements from `iterable`. Its contents cannot be altered after it's created.
 *
 *
 * @class FrozenSet
 * @extends {Set<T>}
 * @template T
 */
export class FrozenSet extends Set {
    constructor(iterable) {
        super(iterable);
        return this.freeze();
    }
    /** @private */
    add() {
        return this;
    }
    /** @private */
    delete() {
        return false;
    }
    /** @private */
    clear() {
        return this;
    }
    /** @private */
    freeze() {
        return Object.freeze(this);
    }
}
