let check: ((map: object) => void) | undefined

/** Called once by `SortedMap`'s static block with access to its private structure check. */
export function registerSortedMapCheck(fn: (map: object) => void): void {
  check = fn
}

/** Throws when a `SortedMap`'s B+ tree breaks an invariant. For tests. */
export function checkSortedMap(map: object): void {
  if (check === undefined) {
    throw new Error('no SortedMap from this module graph has registered its invariant check')
  }
  check(map)
}
