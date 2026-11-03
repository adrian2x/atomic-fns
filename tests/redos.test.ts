import { describe, expect, it } from 'vitest'
import { ValueError } from '../src/globals/errors.js'
import { Duration } from '../src/i18n/duration.js'
import { asDate } from '../src/i18n/format.js'
import { words } from '../src/string/index.js'

describe('NFR-4 ReDoS guards', () => {
  it('SPEC-R63 words finishes on 1e5-char adversarial input', () => {
    const input = 'a'.repeat(1e5) + '!'
    const t0 = performance.now()
    words(input)
    expect(performance.now() - t0).toBeLessThan(200)
  })

  it('SPEC-R87 asDate finishes on 1e5-char adversarial input', () => {
    const input = '2022' + '1'.repeat(1e5) + 'x'
    const t0 = performance.now()
    asDate(input)
    expect(performance.now() - t0).toBeLessThan(200)
  })

  it('SPEC-R87 asDate ReDoS vectors stay under 50ms and invalid', () => {
    for (const input of [
      '2021-' + '1'.repeat(1e5),
      '2021-01-01T' + '1'.repeat(1e5),
      ' '.repeat(1e5)
    ]) {
      const t0 = performance.now()
      const d = asDate(input)
      expect(performance.now() - t0).toBeLessThan(50)
      expect(Number.isNaN(d.getTime())).toBe(true)
    }
  })

  it('SPEC-R94 Duration.fromISO finishes and rejects 1e5-digit P input', () => {
    const input = 'P' + '1'.repeat(1e5)
    const t0 = performance.now()
    expect(() => Duration.fromISO(input)).toThrow(ValueError)
    expect(performance.now() - t0).toBeLessThan(200)
  })
})
