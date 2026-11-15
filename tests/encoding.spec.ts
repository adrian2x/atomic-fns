import { describe, expect, it, vi } from 'vitest'
import * as loaded from '../src/encoding/index.ts'
import { decodeBase64, encodeBase64 } from '../src/internal/codec.ts'

type Encoding = typeof loaded

const NATIVE_METHODS = [
  [Uint8Array, 'fromBase64'],
  [Uint8Array, 'fromHex'],
  [Uint8Array.prototype, 'toBase64'],
  [Uint8Array.prototype, 'toHex']
] as const

const hasNativeMethods = NATIVE_METHODS.every(
  ([owner, name]) => typeof Object.getOwnPropertyDescriptor(owner, name)?.value === 'function'
)

/** A fresh copy of the encoding module, loaded while the native methods are missing. */
async function importWithoutNativeMethods(): Promise<Encoding> {
  const saved = NATIVE_METHODS.map(
    ([owner, name]) => [owner, name, Object.getOwnPropertyDescriptor(owner, name)] as const
  )
  for (const [owner, name] of NATIVE_METHODS) Reflect.deleteProperty(owner, name)
  try {
    vi.resetModules()
    return await import('../src/encoding/index.ts')
  } finally {
    for (const [owner, name, descriptor] of saved) {
      if (descriptor !== undefined) Object.defineProperty(owner, name, descriptor)
    }
  }
}

const portable = await importWithoutNativeMethods()

const IMPLEMENTATIONS: [string, Encoding][] = [
  ['native methods where present', loaded],
  ['the portable fallback', portable]
]

function bytesOfLength(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, i) => (i * 37 + 11) & 255)
}

/** RFC 4648 section 10. */
const RFC_4648_VECTORS: [text: string, base64: string, base16: string][] = [
  ['', '', ''],
  ['f', 'Zg==', '66'],
  ['fo', 'Zm8=', '666f'],
  ['foo', 'Zm9v', '666f6f'],
  ['foob', 'Zm9vYg==', '666f6f62'],
  ['fooba', 'Zm9vYmE=', '666f6f6261'],
  ['foobar', 'Zm9vYmFy', '666f6f626172']
]

/** Text `Uint8Array.fromBase64` decodes, with the bytes it returns. */
const BASE64_DECODES: [text: string, alphabet: 'base64' | 'base64url', bytes: number[]][] = [
  ['', 'base64', []],
  ['ab', 'base64', [0x69]],
  ['abc', 'base64', [0x69, 0xb7]],
  ['abcd', 'base64', [0x69, 0xb7, 0x1d]],
  ['ab==', 'base64', [0x69]],
  ['abc=', 'base64', [0x69, 0xb7]],
  ['ab= =', 'base64', [0x69]],
  [' a b ', 'base64', [0x69]],
  ['a\tb', 'base64', [0x69]],
  ['+/', 'base64', [0xfb]],
  ['-_', 'base64url', [0xfb]]
]

/** Text `Uint8Array.fromBase64` rejects with `SyntaxError`. */
const BASE64_MALFORMED: [text: string, alphabet: 'base64' | 'base64url'][] = [
  ['a', 'base64'],
  ['ab=', 'base64'],
  ['abc==', 'base64'],
  ['abcd=', 'base64'],
  ['abcdefg==', 'base64'],
  ['a===', 'base64'],
  ['ab=c', 'base64'],
  ['ab==ab', 'base64'],
  ['a\vb', 'base64'],
  ['-_', 'base64'],
  ['+/', 'base64url'],
  ['abé', 'base64']
]

/** Text `Uint8Array.fromHex` rejects with `SyntaxError`. */
const HEX_MALFORMED = ['abc', 'zz', '0x00', ' 00', '00 ']

describe.each(IMPLEMENTATIONS)('toBase64 through %s', (_, { toBase64 }) => {
  it.each(RFC_4648_VECTORS)('encodes the RFC 4648 vector %j', (text, base64) => {
    expect(toBase64(text)).toBe(base64)
  })

  it('encodes a string as UTF-8', () => {
    expect(toBase64('é')).toBe('w6k=')
  })

  it('encodes a Uint8Array, an ArrayBuffer, another typed array and a DataView', () => {
    expect(toBase64(new Uint8Array([1, 2, 3]))).toBe('AQID')
    expect(toBase64(new Uint8Array([1, 2, 3]).buffer)).toBe('AQID')
    expect(toBase64(new Uint16Array(new Uint8Array([1, 0]).buffer))).toBe('AQA=')
    expect(toBase64(new DataView(new Uint8Array([0, 1, 2, 3]).buffer, 1))).toBe('AQID')
  })

  it('uses the base64url alphabet when asked', () => {
    expect(toBase64(new Uint8Array([251, 255]))).toBe('+/8=')
    expect(toBase64(new Uint8Array([251, 255]), { alphabet: 'base64url' })).toBe('-_8=')
  })

  it('leaves out the padding when asked', () => {
    expect(toBase64(new Uint8Array([251, 255]), { alphabet: 'base64url', omitPadding: true })).toBe(
      '-_8'
    )
    expect(toBase64('f', { omitPadding: true })).toBe('Zg')
  })

  it('throws TypeError on an unknown alphabet', () => {
    expect(() => toBase64('x', { alphabet: 'hex' as never })).toThrow(TypeError)
  })

  it('throws TypeError on data that is neither bytes nor a string', () => {
    expect(() => toBase64(1 as never)).toThrow(TypeError)
  })
})

describe.each(IMPLEMENTATIONS)('fromBase64 through %s', (_, { fromBase64, toBase64 }) => {
  it.each(RFC_4648_VECTORS)('decodes the RFC 4648 vector %j', (text, base64) => {
    expect(new TextDecoder().decode(fromBase64(base64))).toBe(text)
  })

  it.each(BASE64_DECODES)('decodes %j in %s', (text, alphabet, bytes) => {
    expect([...fromBase64(text, { alphabet })]).toEqual(bytes)
  })

  it.each(BASE64_MALFORMED)('throws SyntaxError on %j in %s', (text, alphabet) => {
    expect(() => fromBase64(text, { alphabet })).toThrow(SyntaxError)
  })

  it('round-trips UTF-8 text through TextDecoder', () => {
    expect(new TextDecoder().decode(fromBase64(toBase64('😀')))).toBe('😀')
  })

  it('throws TypeError on text that is not a primitive string', () => {
    expect(() => fromBase64(1 as never)).toThrow(TypeError)
    expect(() => fromBase64(new String('aGk=') as never)).toThrow(TypeError)
  })

  it('throws TypeError on an unknown alphabet', () => {
    expect(() => fromBase64('aGk=', { alphabet: 'hex' as never })).toThrow(TypeError)
  })
})

describe.each(IMPLEMENTATIONS)('toHex through %s', (_, { toHex }) => {
  it.each(RFC_4648_VECTORS)(
    'encodes the RFC 4648 vector %j in lowercase',
    (text, _base64, base16) => {
      expect(toHex(text)).toBe(base16)
    }
  )

  it('writes two digits per byte', () => {
    expect(toHex(new Uint8Array([0, 15, 255]))).toBe('000fff')
  })

  it('throws TypeError on data that is neither bytes nor a string', () => {
    expect(() => toHex(1 as never)).toThrow(TypeError)
  })
})

describe.each(IMPLEMENTATIONS)('fromHex through %s', (_, { fromHex }) => {
  it.each(RFC_4648_VECTORS)('decodes the RFC 4648 vector %j', (text, _base64, base16) => {
    expect(new TextDecoder().decode(fromHex(base16))).toBe(text)
  })

  it('reads digits in either case', () => {
    expect([...fromHex('000fFF')]).toEqual([0, 15, 255])
  })

  it.each(HEX_MALFORMED)('throws SyntaxError on %j', (text) => {
    expect(() => fromHex(text)).toThrow(SyntaxError)
  })

  it('throws TypeError on text that is not a primitive string', () => {
    expect(() => fromHex(1 as never)).toThrow(TypeError)
    expect(() => fromHex(new String('00') as never)).toThrow(TypeError)
  })
})

describe.runIf(hasNativeMethods)('the portable base64 codec, against the native methods', () => {
  it('encodes and decodes every length, alphabet and padding choice the same', () => {
    for (let length = 0; length < 40; length++) {
      const bytes = bytesOfLength(length)
      for (const alphabet of ['base64', 'base64url'] as const) {
        for (const omitPadding of [false, true]) {
          const text = bytes.toBase64({ alphabet, omitPadding })
          expect(encodeBase64(bytes, alphabet, omitPadding)).toBe(text)
          expect([...decodeBase64(text, alphabet)]).toStrictEqual([
            ...Uint8Array.fromBase64(text, { alphabet })
          ])
        }
      }
    }
  })
})
