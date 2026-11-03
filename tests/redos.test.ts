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

  it('SPEC-R94 Duration.fromISO finishes and rejects 1e5-digit P input', () => {
    const input = 'P' + '1'.repeat(1e5)
    const t0 = performance.now()
    expect(() => Duration.fromISO(input)).toThrow(ValueError)
    expect(performance.now() - t0).toBeLessThan(200)
  })
})
