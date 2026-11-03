import { describe, expect, it } from 'vitest'
import { ValueError } from '../src/globals/errors.js'
import { Duration } from '../src/i18n/duration.js'
import { asDate, formatDate, strftime } from '../src/i18n/format.js'
import { camelCase, words } from '../src/string/index.js'

describe('NFR-4 ReDoS guards', () => {
  it('SPEC-R63 words finishes on 1e5-char adversarial input', () => {
    const input = 'a'.repeat(1e5) + '!'
    const t0 = performance.now()
    words(input)
    expect(performance.now() - t0).toBeLessThan(200)
  })

  it('SPEC-R63 D9 words and camelCase stay linear on 100k-char vectors', () => {
    const vectors = [
      ' a'.repeat(5e4),
      'a'.repeat(1e5),
      'A'.repeat(1e5),
      'aA'.repeat(5e4),
      '1'.repeat(1e5),
      "a'".repeat(5e4),
      '1t'.repeat(5e4),
      '👨‍👩‍👧'.repeat(1e4),
      'é'.repeat(1e5),
      '!'.repeat(1e5),
      "A'S".repeat(33_333)
    ]
    for (const s of vectors) {
      const t0 = performance.now()
      words(s)
      expect(performance.now() - t0).toBeLessThan(100)
      const t1 = performance.now()
      camelCase(s.slice(0, 20_000))
      expect(performance.now() - t1).toBeLessThan(100)
    }
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

  it('SPEC-R94 Duration.fromISO ReDoS vectors stay under 50ms', () => {
    for (const input of [
      'P' + '1Y'.repeat(5e4),
      '-P' + '-1.1'.repeat(5e4),
      'P' + '9'.repeat(5e4) + 'X'
    ]) {
      const t0 = performance.now()
      expect(() => Duration.fromISO(input)).toThrow(ValueError)
      expect(performance.now() - t0).toBeLessThan(50)
    }
  })

  it('SPEC-R85 formatDate and strftime scanners stay linear on adversarial patterns', () => {
    const d = new Date(2024, 0, 5)
    for (const run of [
      () => formatDate('['.repeat(1e5), d),
      () => formatDate('[a'.repeat(5e4), d),
      () => strftime('%-'.repeat(5e4), d),
      () => strftime('%' + 'a'.repeat(1e5), d)
    ]) {
      const t0 = performance.now()
      run()
      expect(performance.now() - t0).toBeLessThan(100)
    }
    expect(formatDate('['.repeat(10), d)).toBe('['.repeat(10))
  })
})
