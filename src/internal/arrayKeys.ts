/**
 * Sparse-array helpers: detect huge sparse arrays and iterate own canonical indices.
 */

/** ECMAScript canonical array index name (0 .. 2^32-2). */
export function isCanonicalArrayIndex(key: string): boolean {
  if (!/^(0|[1-9]\d*)$/.test(key)) return false
  const n = Number(key)
  return n <= 0xffff_fffe && String(n) === key
}

/**
 * Own canonical index keys of `arr`, sorted numerically.
 * Prefer this over `0..length` when {@link isHugeSparseArray} is true.
 */
export function arrayOwnIndices(arr: unknown[]): string[] {
  return Object.keys(arr)
    .filter(isCanonicalArrayIndex)
    .sort((a, b) => Number(a) - Number(b))
}

/**
 * True when `arr.length` exceeds `2 * ownIndexCount + 1024`, so a dense `0..length` walk would
 * spend most of its time on holes.
 */
export function isHugeSparseArray(arr: unknown[]): boolean {
  // Dense arrays never qualify (length > 2*length + 1024 is impossible). Length <= 1024
  // cannot qualify either, so skip Object.keys on the common deep-nesting path.
  if (arr.length <= 1024) return false
  let own = 0
  for (const key of Object.keys(arr)) {
    if (isCanonicalArrayIndex(key)) own++
  }
  return arr.length > 2 * own + 1024
}
