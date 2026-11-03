import { pathToFileURL } from 'node:url'
import { words } from '../../src/string/index.js'

/**
 * Informational words throughput benchmarks. Not collected by `vitest run` (only `*.test.ts`).
 * Run manually with `npx tsx tests/perf/words.bench.ts`.
 *
 * Budgets (design 7.5 #8): ~1 MB mixed <= 40 ms; 1 MB pure ASCII <= 10 ms.
 */

function fill(chunks: readonly string[], bytes: number): string {
  let out = ''
  let i = 0
  while (out.length < bytes) {
    out += chunks[i % chunks.length]
    i++
  }
  return out.slice(0, bytes)
}

function buildAscii(bytes: number): string {
  return fill(
    [
      'equipmentClassName ',
      'XMLHttpRequest ',
      'orderIDValues ',
      '11th_place-holder ',
      "don't_stop ",
      'fooBar2Baz '
    ],
    bytes
  )
}

function buildMixed(bytes: number): string {
  return fill(
    [
      'equipmentClassName ',
      'ПриветМир ',
      'grandŒil ',
      'XMLHttpRequest ',
      '11th place ',
      'café ',
      'fooŁódź ',
      'ΑλφαΒήτα '
    ],
    bytes
  )
}

export interface BenchResult {
  readonly name: string
  readonly ms: number
  readonly bytes: number
}

export function runWordsBench(): BenchResult[] {
  const ascii = buildAscii(1_000_000)
  const mixed = buildMixed(1_000_000)
  words(ascii.slice(0, 10_000))
  words(mixed.slice(0, 10_000))

  const cases: [string, string][] = [
    ['1 MB pure ASCII', ascii],
    ['1 MB mixed ASCII/Latin/Cyrillic', mixed]
  ]
  const results: BenchResult[] = []
  for (const [name, input] of cases) {
    const t0 = performance.now()
    words(input)
    results.push({ name, ms: performance.now() - t0, bytes: input.length })
  }
  return results
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const { name, ms, bytes } of runWordsBench()) {
    console.log(`${name}: ${ms.toFixed(2)} ms (${String(bytes)} chars)`)
  }
}
