import { describe, expect, it } from 'vitest'
import { ValueError } from '../src/globals/errors.js'
import { Duration } from '../src/i18n/duration.js'
import { asDate, formatDate, strftime } from '../src/i18n/format.js'
import { camelCase, words } from '../src/string/index.js'
import { expectFast } from './helpers/perf.js'

/** Pre-fix: ReDoS hang / multi-second. Hang-floor budget max(1000, 5xM). */
const BUDGET = 1000

describe('NFR-4 ReDoS guards', () => {
  it('SPEC-R63 words finishes on 1e5-char adversarial input', () => {
    const input = 'a'.repeat(1e5) + '!'
    expectFast(() => {
      words(input)
    }, BUDGET)
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
      expectFast(() => {
        words(s)
      }, BUDGET)
      expectFast(() => {
        camelCase(s.slice(0, 20_000))
      }, BUDGET)
    }
  })

  it('SPEC-R87 asDate finishes on 1e5-char adversarial input', () => {
    const input = '2022' + '1'.repeat(1e5) + 'x'
    expectFast(() => {
      asDate(input)
    }, BUDGET)
  })

  it('SPEC-R87 asDate ReDoS vectors stay within budget and invalid', () => {
    for (const input of [
      '2021-' + '1'.repeat(1e5),
      '2021-01-01T' + '1'.repeat(1e5),
      ' '.repeat(1e5)
    ]) {
      expectFast(() => {
        const d = asDate(input)
        expect(Number.isNaN(d.getTime())).toBe(true)
      }, BUDGET)
    }
  })

  it('SPEC-R94 Duration.from finishes and rejects 1e5-digit P input', () => {
    const input = 'P' + '1'.repeat(1e5)
    expectFast(() => {
      expect(() => Duration.from(input)).toThrow(ValueError)
    }, BUDGET)
  })

  it('SPEC-R94 Duration.from ReDoS vectors stay within budget', () => {
    for (const input of [
      'P' + '1Y'.repeat(5e4),
      '-P' + '-1.1'.repeat(5e4),
      'P' + '9'.repeat(5e4) + 'X'
    ]) {
      expectFast(() => {
        expect(() => Duration.from(input)).toThrow(ValueError)
      }, BUDGET)
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
      expectFast(() => {
        run()
      }, BUDGET)
    }
    expect(formatDate('['.repeat(10), d)).toBe('['.repeat(10))
  })
})
