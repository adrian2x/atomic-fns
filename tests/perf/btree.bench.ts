import { BTree } from '../../src/collections/BTree.js'
import { compare } from '../../src/operators/index.js'

/**
 * Informational BTree benchmarks. Not collected by `vitest run` (only `*.test.ts` is included).
 * Run manually with `npx tsx tests/perf/btree.bench.ts`.
 */

const N = 100_000
const sorted = Array.from({ length: N }, (_, i) => [i, i] as [number, number])
const numeric = (a: number, b: number) => a - b

export interface BenchCase {
  readonly name: string
  readonly run: () => void
}

export interface BenchResult {
  readonly name: string
  readonly ms: number
}

export function createBenchCases(): BenchCase[] {
  const byCompare = new BTree(sorted, compare)
  const byNumeric = new BTree(sorted, numeric)

  return [
    {
      name: '1e5 sequential get with compare',
      run: () => {
        for (let i = 0; i < N; i++) byCompare.get(i)
      }
    },
    {
      name: '1e5 sequential get with numeric',
      run: () => {
        for (let i = 0; i < N; i++) byNumeric.get(i)
      }
    },
    {
      name: 'new BTree 1e5 sorted numeric',
      run: () => {
        new BTree(sorted, numeric)
      }
    },
    {
      name: 'new Map 1e5 sorted',
      run: () => {
        new Map(sorted)
      }
    },
    {
      name: '1e5 random at',
      run: () => {
        for (let i = 0; i < N; i++) byNumeric.at((i * 2654435761) % N)
      }
    },
    {
      name: '1e5 sequential set with counts',
      run: () => {
        const t = new BTree<number, number>(undefined, numeric, { nodeCapacity: 64 })
        for (let i = 0; i < N; i++) t.set(i, i)
      }
    }
  ]
}

export function runBenchCases(cases: readonly BenchCase[] = createBenchCases()): BenchResult[] {
  return cases.map(({ name, run }) => {
    const start = performance.now()
    run()
    return { name, ms: performance.now() - start }
  })
}
