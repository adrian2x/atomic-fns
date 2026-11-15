/**
 * The path grammar behind `get`, `set`, `has`, `unset`, `pick` and `omit`.
 */

import { assertNotHugeSparse } from '../internal/sparse.ts'
import { truncateForError } from '../internal/truncate.ts'

/** A dotted string with `[0]` and `['key']` segments, or an array of keys. */
export type Path = string | readonly PropertyKey[]

const MAX_PATH_LENGTH = 2 ** 20

/** Segments that lead to a prototype unless they are own data. */
export const DANGEROUS_KEYS: ReadonlySet<PropertyKey> = new Set([
  '__proto__',
  'constructor',
  'prototype'
])

function malformed(path: string): TypeError {
  return new TypeError(`malformed path ${truncateForError(path)}`)
}

/** Read the bracket segment at `path[i]` (`[0]`, `['key']`, `["key"]`); returns it and the end. */
function readBracket(path: string, i: number): [segment: string, end: number] {
  const quote = path[i + 1]
  if (quote === "'" || quote === '"') {
    let key = ''
    let j = i + 2
    while (j < path.length && path[j] !== quote) {
      if (path[j] === '\\' && j + 1 < path.length) j++
      key += path[j++]
    }
    if (path[j] !== quote || path[j + 1] !== ']') throw malformed(path)
    return [key, j + 2]
  }
  const close = path.indexOf(']', i)
  const index = close < 0 ? '' : path.slice(i + 1, close)
  if (!/^(0|[1-9]\d*)$/.test(index)) throw malformed(path)
  return [index, close + 1]
}

/** Split a string path: `a.b[0]['c.d']` is `a`, `b`, `0`, `c.d`. */
function splitString(path: string): string[] {
  const out: string[] = []
  let i = 0
  let needName = path[0] !== '['
  for (;;) {
    if (needName) {
      let end = i
      while (end < path.length && path[end] !== '.' && path[end] !== '[') {
        if (path[end] === ']') throw malformed(path)
        end++
      }
      out.push(path.slice(i, end))
      i = end
    }
    while (path[i] === '[') {
      const [segment, end] = readBracket(path, i)
      out.push(segment)
      i = end
    }
    if (i >= path.length) return out
    if (path[i] !== '.') throw malformed(path)
    i++
    needName = path[i] !== '['
  }
}

/**
 * The segments of `path`. A string splits on `.`, on `[0]` index segments and on `['key']` or
 * `["key"]` segments (with `\\` escaping a quote); an array is taken as its keys, a number segment
 * as its string.
 * @throws {TypeError} for a malformed string path or a segment that is not a string, number or
 * symbol.
 * @throws {RangeError} for a string path over 2^20 characters or a huge sparse array.
 */
export function parsePath(path: Path): PropertyKey[] {
  if (typeof path === 'string') {
    if (path.length > MAX_PATH_LENGTH) {
      throw new RangeError(`path longer than ${String(MAX_PATH_LENGTH)} characters`)
    }
    return path.includes('[') || path.includes(']') ? splitString(path) : path.split('.')
  }
  if (!Array.isArray(path)) {
    throw new TypeError(`a path is a string or an array of keys, got ${typeof path}`)
  }
  assertNotHugeSparse(path)
  return Array.from(path as readonly unknown[], (segment) => {
    if (typeof segment === 'string' || typeof segment === 'symbol') return segment
    if (typeof segment === 'number') return String(segment)
    throw new TypeError('path segments must be strings, numbers or symbols')
  })
}
