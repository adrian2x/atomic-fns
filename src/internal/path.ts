/**
 * The one path grammar behind `get`, `set`, `has`, `del`, `pick`, and `omit`.
 */

import { assertNotHugeSparse } from './arrayKeys.js'

const MAX_PATH_LENGTH = 2 ** 20

const INDEXED_SEGMENT = /^([^[\]]*)((?:\[\d+\])+)$/

/** `a[0][1]` -> `a`, `0`, `1`. A segment with any other bracket stays literal. */
function splitIndexes(segment: string): string[] {
  const match = INDEXED_SEGMENT.exec(segment)
  if (match === null) return [segment]
  const [, name, brackets] = match
  const indexes = brackets.slice(1, -1).split('][')
  return name === '' ? indexes : [name, ...indexes]
}

function normalizeSegment(segment: unknown): PropertyKey {
  if (typeof segment === 'symbol' || typeof segment === 'string') return segment
  if (typeof segment === 'number') return String(segment)
  throw new TypeError('path segments must be strings, numbers or symbols')
}

/**
 * Normalize a path to its segments. A string splits on `.` and on numeric brackets (`a[0].b`); an
 * array is taken literally, each segment a string, number or symbol; any other key is one segment.
 * @throws {RangeError} for a string over 2^20 characters or a huge sparse array.
 * @throws {TypeError} for a segment of another type, a hole included.
 */
export function parsePath(path: unknown): PropertyKey[] {
  if (typeof path === 'string') {
    if (path.length > MAX_PATH_LENGTH) {
      throw new RangeError(`path longer than ${String(MAX_PATH_LENGTH)} characters`)
    }
    const segments = path.split('.')
    return path.includes('[') ? segments.flatMap(splitIndexes) : segments
  }
  if (Array.isArray(path)) {
    assertNotHugeSparse(path)
    return Array.from(path, normalizeSegment)
  }
  return [normalizeSegment(path)]
}
