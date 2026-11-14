import assert from 'node:assert/strict'
import { Decimal } from '../src/decimal/index.ts'

const d = (value: string | number | bigint) => new Decimal(value)
const measure = <T>(name: string, fn: () => T, validate?: (result: T) => void) => {
  const samples = Array.from({ length: 3 }, () => {
    const start = performance.now()
    const result = fn()
    const elapsed = performance.now() - start
    validate?.(result)
    return elapsed
  })
  console.log(JSON.stringify({ name, samplesMs: samples }))
  return Math.min(...samples)
}

console.log(JSON.stringify({ node: process.version, runs: 3 }))

const shapes = (n: number) => [
  `${'1'.repeat(n)}x`,
  `.${'1'.repeat(n - 1)}x`,
  `-${'1'.repeat(n - 1)}x`,
  `${'1'.repeat(n - 2)}.x`,
  `${'1'.repeat(n - 2)}ex`,
  `${' '.repeat(n)}x`,
  `${' '.repeat(Math.floor(n / 2))}1${' '.repeat(Math.ceil(n / 2) - 2)}x`
]
const limit = 2 * Decimal.MAX_EXPONENT + Decimal.MAX_DIGITS + 31
const short = shapes(Math.floor(limit / 8))
for (const [index, input] of shapes(limit).entries()) {
  const smallMs = measure(`parse short ${index}`, () =>
    assert.throws(() => d(short[index]), RangeError)
  )
  const largeMs = measure(`parse long ${index}`, () => assert.throws(() => d(input), RangeError))
  console.log(JSON.stringify({ name: `parse ${index}`, ratio: largeMs / smallMs }))
}

for (const [name, small, large] of [
  ['odd bigint', (1n << 131_072n) + 1n, (1n << 2_097_152n) + 1n],
  ['trailing zeros', 10n ** 262_144n, 10n ** 1_048_576n]
] as const) {
  const smallMs = measure(`${name} short`, () => assert.throws(() => d(small), RangeError))
  const largeMs = measure(`${name} long`, () => assert.throws(() => d(large), RangeError))
  console.log(JSON.stringify({ name, ratio: largeMs / smallMs }))
}

const tiny = d('1e-9999')
measure('wide-scale addition', () => {
  assert.equal(tiny.add(1).toPlainString(), `1.${'0'.repeat(9998)}1`)
})

const original = BigInt.prototype.toString
let conversions = 0
BigInt.prototype.toString = function (radix?: number) {
  if ((radix ?? 10) === 10) conversions++
  return original.call(this, radix)
}
let total = d(0)
try {
  measure('running totals', () => {
    total = d(0)
    for (let i = 0; i < 1400; i++) total = total.add(i % 2 ? '1e-9' : '1e9980')
  })
} finally {
  BigInt.prototype.toString = original
}
assert.equal(total.toPlainString(), `7${'0'.repeat(9982)}.0000007`)
console.log(JSON.stringify({ name: 'running totals', base10Conversions: conversions }))

const values = Array.from({ length: 200 }, (_, i) => d(i % 2 ? '1e-9999' : '1e9999'))
measure('extreme-exponent sort', () => {
  assert.deepEqual(values.toSorted(Decimal.compare).map(String), [
    ...Array<string>(100).fill('1e-9999'),
    ...Array<string>(100).fill('1e+9999')
  ])
})
const wide = [d(`1${'9'.repeat(9999)}`), d(`2${'9'.repeat(9999)}`)]
measure('wide-coefficient comparison', () => assert.equal(wide[0].compare(wide[1]), -1))

let [previous, current] = [0n, 1n]
const threshold = 10n ** 9999n
while (current < threshold) [previous, current] = [current, previous + current]
const dividend = d(current)
const divisor = d(previous)
const half = d('7'.repeat(5000))
const product = (BigInt('7'.repeat(5000)) ** 2n).toString()
const multiplyMs = measure(
  '5000-digit multiply',
  () => half.multiply(half),
  (result) => assert.equal(result.toPlainString(), product)
)
const divideMs = measure(
  '10000-digit coprime divide',
  () => dividend.divide(divisor),
  (result) => assert.equal(result.toString(), '1.618033988749894848204586834365638')
)
console.log(JSON.stringify({ name: 'divide / multiply', ratio: divideMs / multiplyMs }))
measure('10000-digit quotient', () => {
  assert.equal(d(1).divide(3, { precision: 10_000 }).toPlainString(), `0.${'3'.repeat(10_000)}`)
})
measure('extreme-exponent sqrt', () => assert.equal(d('1e10000').sqrt().toString(), '1e+5000'))
measure('10000-digit sqrt', () => {
  const printed = d('2e10000').sqrt({ precision: 10_000, roundingMode: 'trunc' }).toPlainString()
  assert.equal(printed.split('.')[1].length, 4999)
  const root = BigInt(printed.replace('.', ''))
  const radicand = 2n * 10n ** 19_998n
  assert(root * root <= radicand && (root + 1n) * (root + 1n) > radicand)
})
