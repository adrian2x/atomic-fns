import assert from 'node:assert/strict'
import { values } from '../src/collections/entries.ts'
import { isEnumerable } from '../src/internal/keys.ts'
import { sampleSize } from '../src/random/index.ts'

const TWO_32 = 2 ** 32

function seeded() {
  let state = 17
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / TWO_32
  }
}

function sourceOf(random: () => number) {
  return () => {
    const value = random()
    if (typeof value !== 'number') throw new TypeError('random must return a number')
    if (!(value >= 0 && value < 1)) throw new RangeError('random must return a number in [0, 1)')
    return value
  }
}

function draw(min: number, max: number, source: () => number) {
  const span = max - min + 1
  const bucket = (TWO_32 - (TWO_32 % span)) / span
  for (let i = 0; i < 64; i++) {
    const bits = Math.floor(source() * TWO_32)
    const value = min + (bits - (bits % bucket)) / bucket
    if (value <= max) return value
  }
  return max
}

function copySample(input: number[], n: number, random: () => number) {
  const source = sourceOf(random)
  const items = values(input)
  const size = Math.min(n, items.length)
  for (let i = 0; i < size && i < items.length - 1; i++) {
    const j = draw(i, items.length - 1, source)
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  items.length = size
  return items
}

function mapSample(input: number[], n: number, random: () => number) {
  const source = sourceOf(random)
  const indices: number[] = []
  const displaced = new Map<number, number>()
  for (let i = 0; i < Math.min(n, input.length); i++) {
    const j = i < input.length - 1 ? draw(i, input.length - 1, source) : i
    const index = displaced.get(j) ?? j
    if (!isEnumerable(input, index)) return copySample(input, n, random)
    displaced.set(j, displaced.get(i) ?? i)
    indices.push(index)
  }
  return indices.map((index) => input[index])
}

const paths = {
  copy: copySample,
  map: mapSample,
  current: (input: number[], n: number, random: () => number) => sampleSize(input, n, { random })
}
let checksum = 0
for (const length of [10, 100, 1000, 100_000]) {
  const input = Array.from({ length }, (_, i) => i)
  for (const n of [1, 5, length / 2, length]) {
    const iterations = Math.max(20, Math.floor(200_000 / length))
    const timings: Record<string, number[]> = { copy: [], map: [], current: [] }
    const expected = copySample(input, n, seeded())
    for (const fn of Object.values(paths)) {
      assert.deepEqual(fn(input, n, seeded()), expected)
      const random = seeded()
      for (let i = 0; i < iterations; i++) checksum += fn(input, n, random)[0]
    }
    for (let run = 0; run < 7; run++) {
      const entries = Object.entries(paths)
      if (run % 2) entries.reverse()
      for (const [name, fn] of entries) {
        const random = seeded()
        const start = performance.now()
        let count = 0
        for (let i = 0; i < iterations; i++) {
          const result = fn(input, n, random)
          count += result.length
          checksum += result[0]
        }
        timings[name].push((performance.now() - start) / iterations)
        assert.equal(count, iterations * n)
      }
    }
    const stats = Object.fromEntries(
      Object.entries(timings).map(([name, ms]) => {
        ms.sort((a, b) => a - b)
        return [name, { median: ms[3], min: ms[0], max: ms[6] }]
      })
    )
    console.log(
      JSON.stringify({
        length,
        n,
        iterations,
        milliseconds: stats,
        mapOverCopy: stats.map.median / stats.copy.median,
        currentOverCopy: stats.current.median / stats.copy.median
      })
    )
  }
}
assert.ok(Number.isFinite(checksum) && checksum > 0)
console.log(JSON.stringify({ checksum, errors: 0 }))
