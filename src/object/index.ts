/**
 * Objects by path, structure and shape: `get`, `set`, `has`, `unset`, deep equality, and the
 * object helpers that copy, merge and match.
 * @module object
 */
export { type EqualityCustomizer, isEqual, isEqualWith } from './isEqual.ts'
export type { Path } from './parsePath.ts'
export { get, has, set, unset } from './path.ts'
export { isPlainObject } from '../is/isPlainObject.ts'
