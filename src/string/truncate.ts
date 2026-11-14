/**
 * Grapheme-safe truncation on `Intl.Segmenter`.
 * @module
 */
import { toText } from '../internal/text.ts'

/** Options for {@link truncate}. */
export interface TruncateOptions {
  /**
   * Most graphemes in the result, `omission` included (default 30), unless `omission` alone is
   * at least as long, in which case the result is `omission`.
   */
  length?: number
  /** What marks the cut (default `'...'`). */
  omission?: string
}

/** Lazy: Intl.Segmenter at module load fails where Intl is incomplete. */
let graphemeSegmenter: Intl.Segmenter | undefined

function getGraphemeSegmenter(): Intl.Segmenter {
  graphemeSegmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return graphemeSegmenter
}

/**
 * Shortens a string to at most `length` graphemes, ending with `omission` when it cuts. Lengths
 * count user-perceived characters, so an emoji family or a letter with its marks is never split.
 * When `omission` alone is at least as long as `length`, the result is `omission`, as in lodash.
 * @param s The string to shorten.
 * @param options `length` and `omission`.
 * @returns The shortened string.
 * @throws {RangeError} when `length` is not a non-negative integer.
 * @example
 * ```ts
 * truncate('hi-diddly-ho there, neighborino', { length: 24 }) // 'hi-diddly-ho there, n...'
 * truncate('👨‍👩‍👧👨‍👩‍👧👨‍👩‍👧', { length: 2, omission: '' }) // '👨‍👩‍👧👨‍👩‍👧'
 * ```
 */
export function truncate(s: unknown, options?: TruncateOptions): string {
  const text = toText(s)
  const length = options?.length ?? 30
  const omission = toText(options?.omission ?? '...')
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new RangeError('length must be a non-negative integer')
  }
  const segmenter = getGraphemeSegmenter()
  const keep = Math.max(length - [...segmenter.segment(omission)].length, 0)
  let count = 0
  let cut = 0
  for (const { index } of segmenter.segment(text)) {
    if (count === keep) cut = index
    if (++count > length) return text.slice(0, cut) + omission
  }
  return text
}
