import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { nanoid, uniqueId, uuid, uuidv7 } from '../src/id/index.ts'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Web Crypto whose `getRandomValues` fills every byte with `byte`. */
function constantCrypto(byte: number) {
  return { getRandomValues: (array: Uint8Array<ArrayBuffer>) => array.fill(byte) }
}

/** `uuidv7` from a freshly loaded module, so no earlier test has set its last timestamp. */
async function freshUuidv7(): Promise<() => string> {
  vi.resetModules()
  return (await import('../src/id/uuid.ts')).uuidv7
}

/** The 48-bit Unix millisecond prefix of a v7 UUID. */
function timeOf(id: string): number {
  return Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('uniqueId', () => {
  const slot = Symbol.for('atomic-fns.uniqueId')

  beforeEach(() => {
    vi.stubGlobal(slot, undefined)
  })

  it('takes no parameters and counts up as decimal strings from one', async () => {
    expectTypeOf(uniqueId).parameters.toEqualTypeOf<[]>()
    expectTypeOf(uniqueId).returns.toEqualTypeOf<string>()
    vi.resetModules()
    const { uniqueId: fresh } = await import('../src/id/index.ts')
    expect(Array.from({ length: 12 }, () => fresh())).toStrictEqual(
      Array.from({ length: 12 }, (_, i) => String(i + 1))
    )
    expect(`user_${fresh()}`).toBe('user_13')
  })

  it.each([
    ['1', ''],
    ['a1', 'a']
  ])('a supplied %s prefix cannot collide with later ids', async (firstPrefix, nextPrefix) => {
    vi.resetModules()
    const { uniqueId: fresh } = await import('../src/id/index.ts')
    const ids = [
      Reflect.apply(fresh, undefined, [firstPrefix]),
      ...Array.from({ length: 10 }, () => Reflect.apply(fresh, undefined, [nextPrefix]))
    ]
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toStrictEqual(Array.from({ length: 11 }, (_, i) => String(i + 1)))
  })

  it.each([
    { args: ['user_'] },
    { args: [''] },
    { args: [undefined] },
    { args: [null] },
    { args: [1] },
    { args: [Symbol('prefix')] },
    { args: [Object.create(null)] },
    { args: ['user_', 1, null] }
  ])('ignores runtime arguments $args', async ({ args }) => {
    vi.resetModules()
    const { uniqueId: fresh } = await import('../src/id/index.ts')
    expect(Reflect.apply(fresh, undefined, args)).toBe('1')
    expect(fresh()).toBe('2')
  })

  it('shares its counter between the root and id exports', async () => {
    vi.resetModules()
    const { uniqueId: fromRoot } = await import('../src/index.ts')
    const { uniqueId: fromId } = await import('../src/id/index.ts')
    expect([fromRoot(), fromId(), fromRoot(), fromId()]).toStrictEqual(['1', '2', '3', '4'])
  })

  it('keeps ids unique across independently loaded copies in one realm', async () => {
    const url = new URL('../src/id/uniqueId.ts', import.meta.url)
    const first = await import(`${url.href}?copy=first`)
    const second = await import(`${url.href}?copy=second`)

    expect([
      first.uniqueId(),
      second.uniqueId(),
      first.uniqueId(),
      second.uniqueId()
    ]).toStrictEqual(['1', '2', '3', '4'])
  })
})

describe('uuid', () => {
  it('is a v4 UUID', () => {
    expect(uuid()).toMatch(V4)
    expect(uuid()).not.toBe(uuid())
  })

  it('returns crypto.randomUUID where present', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'f81d4fae-7dec-41d0-a765-00a0c91e6bf6'
    })
    expect(uuid()).toBe('f81d4fae-7dec-41d0-a765-00a0c91e6bf6')
  })

  it('falls back to getRandomValues, setting the version and variant bits', () => {
    vi.stubGlobal('crypto', constantCrypto(0xff))
    expect(uuid()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
    vi.stubGlobal('crypto', constantCrypto(0x00))
    expect(uuid()).toBe('00000000-0000-4000-8000-000000000000')
  })
})

describe('uuidv7', () => {
  it('sets the version and variant bits and seeds the sequence from random bits', async () => {
    const fresh = await freshUuidv7()
    vi.useFakeTimers({ now: 1_700_000_000_000 })
    vi.stubGlobal('crypto', constantCrypto(0xff))
    expect(fresh()).toBe('018bcfe5-6800-77ff-bfff-ffffffffffff')
    vi.setSystemTime(1_700_000_000_001)
    vi.stubGlobal('crypto', constantCrypto(0x00))
    expect(fresh()).toBe('018bcfe5-6801-7000-8000-000000000000')
  })

  it('sorts in creation order within one millisecond and when the clock steps back', async () => {
    const fresh = await freshUuidv7()
    vi.useFakeTimers({ now: 1_700_000_000_000 })
    const ids = Array.from({ length: 5000 }, () => fresh())
    expect(timeOf(ids[0])).toBe(1_700_000_000_000)
    vi.setSystemTime(1_699_999_999_000)
    ids.push(fresh(), fresh())
    expect(ids.every((id) => V7.test(id))).toBe(true)
    expect(ids.toSorted()).toEqual(ids)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('without Web Crypto', () => {
  it('throws TypeError from every random id', () => {
    vi.stubGlobal('crypto', undefined)
    expect(() => uuid()).toThrow(TypeError)
    expect(() => uuidv7()).toThrow(TypeError)
    expect(() => nanoid()).toThrow(TypeError)
  })
})

describe('nanoid', () => {
  it('draws 21 URL-safe characters by default', () => {
    const id = nanoid()
    expect(id).toMatch(/^[A-Za-z0-9_-]{21}$/)
    expect(nanoid()).not.toBe(id)
  })

  it('takes a size and an alphabet, code points included', () => {
    expect(nanoid(8, '0123456789')).toMatch(/^\d{8}$/)
    const emoji = [...nanoid(10, '😀😃')]
    expect(emoji).toHaveLength(10)
    expect(emoji.every((c) => c === '😀' || c === '😃')).toBe(true)
    expect(nanoid(1)).toHaveLength(1)
  })

  it('takes an alphabet of 256 code points', () => {
    const alphabet = String.fromCodePoint(...Array.from({ length: 256 }, (_, i) => 0x1f300 + i))
    const id = [...nanoid(4, alphabet)]
    expect(id).toHaveLength(4)
    for (const c of id) expect(alphabet).toContain(c)
  })

  it('draws every alphabet index and rejects out-of-range indices', () => {
    const bytes = [0, 3, 1, 255, 2, 4, 7, 5, 6]
    let offset = 0
    vi.stubGlobal('crypto', {
      getRandomValues: (array: Uint8Array<ArrayBuffer>) => {
        for (let i = 0; i < array.length; i++) array[i] = bytes[offset++ % bytes.length]
        return array
      }
    })
    expect(nanoid(6, 'abc')).toBe('abcabc')
    vi.stubGlobal('crypto', constantCrypto(0))
    expect(nanoid(1024, 'ab')).toBe('a'.repeat(1024))
  })

  it('refuses sizes and alphabets out of range', () => {
    for (const size of [0, -1, 1.5, 1025, NaN]) expect(() => nanoid(size)).toThrow(RangeError)
    expect(() => nanoid(5, 'a')).toThrow(RangeError)
    expect(() => nanoid(5, 'aab')).toThrow(RangeError)
    expect(() =>
      nanoid(5, String.fromCharCode(...Array.from({ length: 257 }, (_, i) => 0x100 + i)))
    ).toThrow(RangeError)
    expect(() => nanoid(5, 'ab'.repeat(300))).toThrow(RangeError)
    expect(() => nanoid(5, 'ab\uD800')).toThrow(RangeError)
  })

  it('refuses a size or an alphabet of the wrong type', () => {
    expect(() => nanoid('8' as never)).toThrow(TypeError)
    expect(() => nanoid(null as never)).toThrow(TypeError)
    for (const alphabet of [1, ['a', 'b']]) {
      expect(() => nanoid(5, alphabet as never)).toThrowError(
        new TypeError('alphabet must be a string')
      )
    }
  })
})
