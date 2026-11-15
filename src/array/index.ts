/**
 * Array building blocks (`chunk`, `zip`, `range`, `remove`, `dropWhile`, `takeWhile`) and set
 * operations (`uniqBy`, `uniqWith` and the `difference`, `intersection`, `union` and `xor`
 * families), which keep the order of first appearance and compare with SameValueZero unless a key
 * or equality function is given.
 * @module array
 */
export { chunk, dropWhile, range, remove, takeWhile, zip } from './list.ts'
export {
  difference,
  differenceBy,
  differenceWith,
  intersection,
  intersectionBy,
  union,
  unionBy,
  uniqBy,
  uniqWith,
  xor,
  xorBy
} from './sets.ts'
