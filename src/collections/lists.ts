/**
 * How the list helpers read their input and walk it.
 */

import { isIterable } from '../globals/index.js'
import {
  HUGE_SPARSE_MIN_LENGTH,
  isCanonicalArrayIndex,
  isHugeSparse,
  walkArray,
  type ArrayWalkEvent
} from '../internal/arrayKeys.js'
import { arrayFromIterable } from '../internal/iterable.js'

const MAX_ARRAY_LENGTH = 2 ** 32 - 1

function isArrayLength(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= MAX_ARRAY_LENGTH
}

/**
 * `x` as an array if it is an array, an iterable, or an array-like whose own index keys back its
 * `length`, by the rule that marks a huge sparse array. Parsed JSON can claim any `length`.
 */
export function listOf(x: unknown): unknown[] | undefined {
  if (Array.isArray(x)) return x as unknown[]
  if (isIterable(x)) return arrayFromIterable(x)
  if (x === null || typeof x !== 'object') return undefined
  const { length } = x as { length?: unknown }
  if (!isArrayLength(length)) return undefined
  const elements = x as Record<string, unknown>
  const indices = Object.keys(elements).filter(
    (key) => isCanonicalArrayIndex(key) && Number(key) < length
  )
  if (length > 2 * indices.length + 1024) return undefined
  const list: unknown[] = []
  list.length = length
  for (const key of indices) list[Number(key)] = elements[key]
  return list
}

/** {@link listOf}, with anything else empty. */
export function toList<T>(x: unknown): T[] {
  return (listOf(x) ?? []) as T[]
}

/** Visit `list` as `new Set(list)` reads it, holes as `undefined`; a huge sparse array skips them. */
export function forEachMember<T>(list: T[], visit: (value: T, index: number) => void): void {
  if (isHugeSparse(list)) {
    walkArray(list, (ev) => {
      if (ev.kind === 'value') visit(ev.value as T, ev.index)
    })
    return
  }
  const { length } = list
  for (let i = 0; i < length; i++) visit(list[i], i)
}

/** `ToIntegerOrInfinity`. */
export function toInteger(x: unknown): number {
  return Math.trunc(Number(x)) || 0
}

/** Where a forward search of `length` elements starts: negative counts from the end. */
export function forwardStart(start: unknown, length: number): number {
  const from = toInteger(start)
  return from < 0 ? Math.max(length + from, 0) : from
}

/** Where a backward search of `length` elements starts, the last element by default. */
export function backwardStart(start: unknown, length: number): number {
  if (start === undefined) return length - 1
  return Math.min(forwardStart(start, length), length - 1)
}

type IndexTest<T> = (value: T, index: number) => unknown

/**
 * First index the walk from `from` in direction `step` passes `test`, or -1. Every index is tested,
 * holes as `undefined`. On a huge sparse array a hole run is tested once, at its end nearest `from`.
 */
export function scan<T>(list: T[], from: number, step: 1 | -1, test: IndexTest<T>): number {
  const { length } = list
  let mayBeHuge = length > HUGE_SPARSE_MIN_LENGTH
  for (let i = from; i >= 0 && i < length; i += step) {
    if (mayBeHuge && !(i in list)) {
      if (isHugeSparse(list)) return scanHugeSparse(list, i, step, test)
      mayBeHuge = false
    }
    if (test(list[i], i)) return i
  }
  return -1
}

function scanHugeSparse<T>(list: T[], from: number, step: 1 | -1, test: IndexTest<T>): number {
  const events: ArrayWalkEvent[] = []
  walkArray(list, (ev) => {
    events.push(ev)
  })
  if (step < 0) events.reverse()
  for (const ev of events) {
    const [first, last] = ev.kind === 'value' ? [ev.index, ev.index] : [ev.start, ev.end - 1]
    const index = step > 0 ? Math.max(first, from) : Math.min(last, from)
    if (index < first || index > last) continue
    if (test((ev.kind === 'value' ? ev.value : undefined) as T, index)) return index
  }
  return -1
}
