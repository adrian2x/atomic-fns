import assert from 'node:assert/strict'
import { deburr, words } from '../src/string/index.ts'

const wordsInputs: [string, (n: number) => string, (n: number) => string[]][] = [
  ['spaces', (n) => ' a'.repeat(n), (n) => Array(n).fill('a')],
  ['case', (n) => 'aA'.repeat(n), (n) => ['a', ...Array(n - 1).fill('Aa'), 'A']],
  ['apostrophes', (n) => "a'".repeat(n), (n) => [`${"a'".repeat(n - 1)}a`]],
  ['digits', (n) => '1t'.repeat(n), (n) => Array(n).fill(['1', 't']).flat()],
  ['families', (n) => '👨‍👩‍👧'.repeat(n / 5), (n) => Array(n / 5).fill('👨‍👩‍👧')],
  ['accents', (n) => 'é'.repeat(2 * n), (n) => ['é'.repeat(2 * n)]],
  ['punctuation', (n) => `${'a'.repeat(2 * n)}!`, (n) => ['a'.repeat(2 * n)]],
  ['capitals', (n) => "A'S".repeat(n), (n) => ["A'S".repeat(n)]],
  ['keycaps', (n) => '1️⃣'.repeat(n), (n) => Array(n).fill('1️⃣')]
]

function measure<T>(fn: () => T, expected: T): number[] {
  assert.deepEqual(fn(), expected)
  return Array.from({ length: 3 }, () => {
    const start = performance.now()
    const result = fn()
    const elapsed = performance.now() - start
    assert.deepEqual(result, expected)
    return elapsed
  })
}

for (const [name, build, expected] of wordsInputs) {
  const small = build(12_500)
  const large = build(50_000)
  const smallMs = measure(() => words(small), expected(12_500))
  const largeMs = measure(() => words(large), expected(50_000))
  console.log(
    JSON.stringify({ name, smallMs, largeMs, ratio: Math.min(...largeMs) / Math.min(...smallMs) })
  )
}

for (const [name, marks, count, repeats, normalized] of [
  ['doubled marks', '\u0344', 30, 100_000, '\u0308\u0301'.repeat(30)],
  ['long marks', '\u0301', 1000, 3000, '\u0301'.repeat(30)]
] as const) {
  const input = `ก${marks.repeat(count)}`.repeat(repeats)
  const output = `ก${normalized}`.repeat(repeats)
  console.log(JSON.stringify({ name, milliseconds: measure(() => deburr(input), output) }))
}
