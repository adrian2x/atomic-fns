/**
 * Iteratee shorthands.
 */

import { get, has } from '../globals/index.js'
import { identity } from '../operators/index.js'
import type { Iteratee } from '../types.js'
import { matches } from './matches.js'

function matchesProperty<T>(path: PropertyKey, expected: unknown): Iteratee<T> {
  if (expected === undefined) return (obj) => has(obj, path) && get(path, obj) === undefined
  const test = matches({ value: expected })
  return (obj) => test({ value: get(path, obj) })
}

/**
 * The function behind an iteratee shorthand: nullish is identity, `[path, value]` tests that path
 * as `matches` would, any other object is a `matches` shape, and a key reads that property path.
 */
export function toIteratee<T>(
  fn: Iteratee<T> | object | PropertyKey | null | undefined
): Iteratee<T> {
  if (fn == null) return identity
  if (typeof fn === 'function') return fn as Iteratee<T>
  if (Array.isArray(fn)) return matchesProperty(fn[0] as PropertyKey, fn[1])
  if (typeof fn === 'object') return matches(fn)
  return (obj) => get(fn, obj)
}
