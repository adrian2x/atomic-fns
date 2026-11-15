import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const gc = globalThis.gc
if (!gc) throw new Error('Run with node --expose-gc bench/sorted-set.ts [checkout]')

const checkout = resolve(process.argv[2] ?? resolve(import.meta.dirname, '..'))
const { SortedMap }: typeof import('../src/collections/sorted-map.ts') = await import(
  pathToFileURL(resolve(checkout, 'src/collections/sorted-map.ts')).href
)
const { SortedSet }: typeof import('../src/collections/sorted-set.ts') = await import(
  pathToFileURL(resolve(checkout, 'src/collections/sorted-set.ts')).href
)

const count = 1_000_000
const seed = 0x12345678
const warmupCount = 100_000
const builders = {
  SortedSet(values: Uint32Array) {
    const set = new SortedSet<number>()
    for (const value of values) set.add(value)
    return set
  },
  SortedMap(values: Uint32Array) {
    const map = new SortedMap<number, number>()
    for (const value of values) map.set(value, value)
    return map
  }
}

console.log(JSON.stringify({ node: process.version, checkout, count, seed, warmupCount }))

const measure = (build: (typeof builders)[keyof typeof builders], values: Uint32Array) => {
  assert.equal(build(values.subarray(0, warmupCount)).size, warmupCount)
  gc()
  const before = process.memoryUsage().heapUsed
  const start = performance.now()
  const result = build(values)
  const insertMs = performance.now() - start
  gc()
  const retainedBytes = process.memoryUsage().heapUsed - before

  assert.equal(result.size, count)
  let expected = 0
  for (const [key, value] of result.entries()) {
    assert.equal(key, expected)
    assert.equal(value, expected)
    expected++
  }
  assert.equal(expected, count)
  return { insertMs, retainedBytes, verified: expected }
}

for (const order of ['random', 'ascending']) {
  const values = Uint32Array.from({ length: count }, (_, i) => i)
  if (order === 'random') {
    let state = seed
    for (let i = count - 1; i > 0; i--) {
      state ^= state << 13
      state ^= state >>> 17
      state ^= state << 5
      const j = Math.floor(((state >>> 0) / 2 ** 32) * (i + 1))
      ;[values[i], values[j]] = [values[j], values[i]]
    }
  }

  for (const [collection, build] of Object.entries(builders)) {
    console.log(JSON.stringify({ collection, order, ...measure(build, values) }))
  }
}
