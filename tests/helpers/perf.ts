import { expect } from 'vitest'

/** Wall-clock DoS/perf guard: up to 3 runs; pass if the fastest is under budgetMs. */
export function expectFast(fn: () => void, budgetMs: number): void {
  let best = Number.POSITIVE_INFINITY
  for (let attempt = 0; attempt < 3; attempt++) {
    const t0 = performance.now()
    fn()
    const dt = performance.now() - t0
    if (dt < best) best = dt
    if (best < budgetMs) break
  }
  expect(best).toBeLessThan(budgetMs)
}
