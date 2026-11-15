import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Decimal as DecimalType } from '../src/decimal/decimal.ts'

// Run with node bench/decimal-pow10.ts; the baseline commit must exist in local Git history.
const baseline = '84fa075410b6609c3efe657d7e43b1ae56fe14ba'
const root = fileURLToPath(new URL('..', import.meta.url))
const oldPow10 = execFileSync(
  'git',
  ['-C', root, 'show', `${baseline}:src/decimal/internal/pow10.ts`],
  { encoding: 'utf8' }
)
const temporary = mkdtempSync(join(tmpdir(), 'decimal-pow10-'))
const samples = 5
const warmup = 2_000
const workloads = [
  { name: 'mixed-default-precision', iterations: 50_000 },
  { name: 'divide-precision-500', iterations: 5_000 },
  { name: 'powers-0-through-1023', iterations: 51_200 }
]
type Measurement = {
  sample: number
  variant: string
  workload: string
  iterations: number
  ms: number
  cpuMs: number
  peakCachedDigits: number
  checksum: number
}
const measurements: Measurement[] = []

try {
  for (let sample = 0; sample < samples; sample++) {
    for (const workload of workloads) {
      const variants = sample % 2 === 0 ? ['old', 'new'] : ['new', 'old']
      for (const variant of variants) {
        const directory = join(temporary, `${sample}-${workload.name}-${variant}`)
        cpSync(join(root, 'src/decimal'), directory, { recursive: true })
        writeFileSync(join(directory, 'package.json'), '{"type":"module"}')
        if (variant === 'old') writeFileSync(join(directory, 'internal/pow10.ts'), oldPow10)
        const { Decimal }: { Decimal: typeof DecimalType } = await import(
          pathToFileURL(join(directory, 'decimal.ts')).href
        )
        const { pow10, getPow10CachedDigits }: typeof import('../src/decimal/internal/pow10.ts') =
          await import(pathToFileURL(join(directory, 'internal/pow10.ts')).href)
        const work = (i: number): string => {
          if (workload.name === 'mixed-default-precision') {
            return new Decimal(`${i % 997}.125`)
              .add('0.875')
              .multiply('1.25')
              .divide(3)
              .sqrt()
              .toString()
          }
          if (workload.name === 'divide-precision-500') {
            return new Decimal((i % 97) + 1).divide(3, { precision: 500 }).toString()
          }
          return pow10(i % 1024).toString()
        }
        for (let i = 0; i < warmup; i++) work(i)
        let checksum = 0
        const cpuStart = process.cpuUsage()
        const start = performance.now()
        for (let i = 0; i < workload.iterations; i++) {
          const result = work(i)
          checksum += result.length + result.charCodeAt(0) + result.charCodeAt(result.length - 1)
        }
        const ms = performance.now() - start
        const cpu = process.cpuUsage(cpuStart)
        measurements.push({
          sample,
          variant,
          workload: workload.name,
          iterations: workload.iterations,
          ms,
          cpuMs: (cpu.user + cpu.system) / 1000,
          // These caches only grow, so their final size is also their peak.
          peakCachedDigits: getPow10CachedDigits(),
          checksum
        })
      }
      const [first, second] = measurements.slice(-2)
      assert.equal(first.checksum, second.checksum, `${workload.name}: output checksums differ`)
    }
  }
  const median = (values: number[]): number => values.toSorted((a, b) => a - b)[2]
  const summary = workloads.map(({ name }) => {
    const sides = ['old', 'new'].map((variant) => {
      const rows = measurements.filter((row) => row.workload === name && row.variant === variant)
      const times = rows.map((row) => row.ms)
      return {
        variant,
        medianMs: median(times),
        minMs: Math.min(...times),
        maxMs: Math.max(...times),
        medianCpuMs: median(rows.map((row) => row.cpuMs)),
        peakCachedDigits: Math.max(...rows.map((row) => row.peakCachedDigits))
      }
    })
    return { workload: name, sides, newOverOld: sides[1].medianMs / sides[0].medianMs }
  })
  console.log(
    JSON.stringify(
      { node: process.version, baseline, samples, warmup, failures: 0, summary, measurements },
      null,
      2
    )
  )
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
