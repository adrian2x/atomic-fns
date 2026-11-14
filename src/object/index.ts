/**
 * Objects by path, structure and shape: `get`, `set`, `has`, `unset`, deep equality, and the
 * object helpers that copy, merge and match.
 * @module object
 */
export { cloneDeep } from './cloneDeep.ts'
export { type EqualityCustomizer, isEqual, isEqualWith } from './isEqual.ts'
export { isMatch, matches } from './matches.ts'
export { defaults, defaultsDeep, merge } from './merge.ts'
export type { Path } from './parsePath.ts'
export { get, has, set, unset } from './path.ts'
export { omit, omitBy, type Paths, type PickedBy, pick, pickBy, type PlainKey } from './pick.ts'
export { isPlainObject } from '../is/isPlainObject.ts'
