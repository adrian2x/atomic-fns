import { bytesToHex } from '../internal/bytes.ts'
import { randomBytes } from '../internal/crypto.ts'

function format(bytes: Uint8Array): string {
  const hex = bytesToHex(bytes)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * A random (version 4) UUID, from `crypto.randomUUID` where the runtime has it (secure contexts) and
 * from `crypto.getRandomValues` elsewhere. Throws `TypeError` where neither exists.
 * @returns A lowercase UUID string.
 * @example
 * ```ts
 * uuid() // '0b5e1f9c-8a5d-4f8e-9b8a-2a8f6a1c3d4e'
 * ```
 */
export function uuid(): string {
  const crypto = globalThis.crypto as Crypto | undefined
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  const bytes = randomBytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return format(bytes)
}

let lastTime = -1
let sequence = 0

/**
 * A time-ordered (version 7) UUID, RFC 9562: 48 bits of Unix milliseconds, then a 12-bit sequence
 * and 62 random bits, so ids sort by creation time as strings and as bytes. Ids made in one
 * millisecond, or while the clock steps back, count up the sequence from a random start, so they
 * still sort in the order this process made them: they keep the last timestamp, and when its
 * sequence runs out they borrow the next millisecond (RFC 9562 section 6.2), so the timestamp can
 * run ahead of the clock. Throws `TypeError` without Web Crypto.
 * @returns A lowercase UUID string.
 * @example
 * ```ts
 * const [a, b] = [uuidv7(), uuidv7()]
 * a < b // true
 * ```
 */
export function uuidv7(): string {
  const bytes = randomBytes(16)
  let time = Date.now()
  if (time > lastTime) {
    sequence = ((bytes[6] << 8) | bytes[7]) & 0x7ff
  } else {
    time = lastTime
    sequence++
    if (sequence > 0xfff) {
      time++
      sequence = 0
    }
  }
  lastTime = time
  for (let i = 5; i >= 0; i--) {
    bytes[i] = time % 256
    time = Math.floor(time / 256)
  }
  bytes[6] = 0x70 | (sequence >> 8)
  bytes[7] = sequence & 0xff
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return format(bytes)
}
