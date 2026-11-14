/** An array of `length` with only the indices in `at` present: every other index is a hole. */
export function sparse(length: number, at: Record<number, unknown>): unknown[] {
  const arr: unknown[] = []
  arr.length = length
  for (const [k, v] of Object.entries(at)) arr[Number(k)] = v
  return arr
}
