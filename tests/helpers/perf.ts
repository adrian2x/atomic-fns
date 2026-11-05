import { expect } from 'vitest'

/** CI runners under coverage run several times slower than a workstation. */
const RUNNER_SLOWDOWN = process.env.CI ? 8 : 1

/** Milliseconds to allow on this runner for work budgeted at `ms` on a workstation. */
export function budget(ms: number): number {
  return ms * RUNNER_SLOWDOWN
}

/** Wall-clock DoS/perf guard: up to 3 runs; pass if the fastest is under budgetMs. */
export function expectFast(fn: () => void, budgetMs: number): void {
  const limit = budget(budgetMs)
  let best = Number.POSITIVE_INFINITY
  for (let attempt = 0; attempt < 3; attempt++) {
    const t0 = performance.now()
    fn()
    const dt = performance.now() - t0
    if (dt < best) best = dt
    if (best < limit) break
  }
  expect(best).toBeLessThan(limit)
}
