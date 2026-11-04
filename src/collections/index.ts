/**
 * Collection classes and helpers (arrays, objects, sets, maps, trees).
 *
 * @module collections
 */

export { SetCollection, ValueCollection, MapCollection } from './abc.js'
export * from './BTree.js'
export * from './deque.js'
export * from './frozenset.js'
export * from './Heap.js'
export * from './LRUCache.js'
export * from './SortedMap.js'
export * from './SortedSet.js'
export * from './SplayTree.js'

export * from './Trie.js'
export {
  clone,
  defaults,
  defineData,
  isPlainObject,
  merge,
  omit,
  pick,
  type PropertyPath
} from './object.js'
export { bisect, bisectLeft, binarySearch, insort, insortLeft } from './bisect.js'
export { flatten } from './flatten.js'
export { count, groupBy, groupByMap } from './group.js'
export { compact, filter, find, findLast, forEach, forEachRight, insert, map } from './iterate.js'
export { matches } from './matches.js'
export { findIndex, findLastIndex, indexOf, lastIndexOf } from './search.js'
export {
  difference,
  intersection,
  reject,
  remove,
  sortedUniq,
  symmetricDifference,
  union,
  uniq,
  without
} from './sets.js'
export type { Iteratee } from '../types.js'
