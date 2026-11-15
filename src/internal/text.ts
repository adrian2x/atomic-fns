/**
 * Text helpers shared by the `fns/string` modules.
 */

/** Lodash `toString`: `null` and `undefined` become `''`, anything else goes through `String`. */
export function toText(value: unknown): string {
  return value == null ? '' : String(value)
}

/** Whether every UTF-16 code unit of `s` is ASCII. */
export function isAsciiString(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0x7f) return false
  }
  return true
}
