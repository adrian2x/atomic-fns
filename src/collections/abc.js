/**
 * A `Collection` is an iterable {@link Container} type.
 * This is an abstract base class for user-defined collection types.
 *
 *
 * @abstract
 * @class Collection
 * @implements {Container}
 */
export class Collection {
    get length() {
        return this.size();
    }
    /**
     * Check if there are no items.
     * @returns {boolean} `true` if is empty.
     */
    empty() {
        return !this.size();
    }
}
/**
 * A sequence is an iterable {@link Collection} type with efficient index-based access.
 * @abstract
 * @class Sequence
 * @extends {Collection}
 * @template V
 */
export class Sequence extends Collection {
}
export class Mapping extends Collection {
}
