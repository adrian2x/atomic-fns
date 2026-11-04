import { describe, expect, it } from 'vitest'
import { accumulate, chain, first, iflatten, takeWhile, zip } from '../src/itertools/index.js'

/** Infinite counter whose `finally` records that the source was closed. */
function tracked(log: string[], name: string, limit = Infinity): Generator<number> {
  return (function* () {
    try {
      for (let i = 0; i < limit; i++) yield i
    } finally {
      log.push(name)
    }
  })()
}

/** Manual iterator so `return` is observable even when never started. */
function manual(
  log: string[],
  name: string,
  items: number[],
  onReturn: () => void = () => undefined
): IterableIterator<number> {
  let i = 0
  return {
    next: () =>
      i < items.length ? { done: false, value: items[i++] } : { done: true, value: undefined },
    return: () => {
      log.push(name)
      onReturn()
      return { done: true, value: undefined }
    },
    [Symbol.iterator]() {
      return this
    }
  }
}

describe('itertools close unfinished sources', () => {
  it('R10-D5 first closes the source', () => {
    const log: string[] = []
    expect(first(tracked(log, 'a'))).toBe(0)
    expect(log).toEqual(['a'])
  })

  it('R10-D5 first on an empty source does not call return again', () => {
    const log: string[] = []
    expect(first(manual(log, 'a', []))).toBeUndefined()
    expect(log).toEqual([])
  })

  it('R10-D5 first closes a plain iterable wrapper', () => {
    const log: string[] = []
    const iterable: Iterable<number> = { [Symbol.iterator]: () => manual(log, 'a', [1, 2]) }
    expect(first(iterable)).toBe(1)
    expect(log).toEqual(['a'])
  })

  it('R10-D5 zip closes the longer sources when the shortest ends', () => {
    const log: string[] = []
    const out = [...zip(tracked(log, 'long'), manual(log, 'short', [1, 2]), tracked(log, 'long2'))]
    expect(out).toEqual([
      [0, 1, 0],
      [1, 2, 1]
    ])
    expect(log.toSorted()).toEqual(['long', 'long2'])
  })

  it('R10-D5 zip does not close the exhausted source', () => {
    const log: string[] = []
    expect([...zip(manual(log, 'short', [1]), manual(log, 'other', [1, 2]))]).toEqual([[1, 1]])
    expect(log).toEqual(['other'])
  })

  it('R10-D5 zip closes every source when the consumer stops early', () => {
    const log: string[] = []
    const it = zip(tracked(log, 'a'), tracked(log, 'b'))
    expect(it.next().value).toEqual([0, 0])
    it.return?.()
    expect(log.toSorted()).toEqual(['a', 'b'])
  })

  it('R10-D5 zip closes the others when a source throws', () => {
    const log: string[] = []
    const boom = {
      [Symbol.iterator]: () => ({
        next(): IteratorResult<number> {
          throw new Error('boom')
        },
        return(): IteratorResult<number> {
          log.push('boom')
          return { done: true, value: undefined }
        }
      })
    }
    expect(() => [...zip(tracked(log, 'a'), boom, manual(log, 'c', [1, 2]))]).toThrow('boom')
    expect(log.toSorted()).toEqual(['a', 'c'])
  })

  it('R10-D5 zip closes the rest when one return throws', () => {
    const log: string[] = []
    const bad = manual(log, 'bad', [1, 2, 3], () => {
      throw new Error('close failed')
    })
    const it = zip(bad, tracked(log, 'ok'))
    it.next()
    expect(() => it.return?.()).toThrow('close failed')
    expect(log.toSorted()).toEqual(['bad', 'ok'])
  })

  it('R10-D5 accumulate closes the source when stopped after the seed', () => {
    const logSeed: string[] = []
    const withSeed = accumulate(manual(logSeed, 'a', [1, 2]), (a, b) => (a as number) + b, 100)
    expect(withSeed.next().value).toBe(100)
    withSeed.return?.()
    expect(logSeed).toEqual(['a'])

    const logHead: string[] = []
    const noSeed = accumulate(tracked(logHead, 'b'))
    expect(noSeed.next().value).toBe(0)
    noSeed.return?.()
    expect(logHead).toEqual(['b'])
  })

  it('R10-D5 accumulate still closes once when stopped mid-fold', () => {
    const log: string[] = []
    const it = accumulate(tracked(log, 'a'))
    it.next()
    it.next()
    it.return?.()
    expect(log).toEqual(['a'])
  })

  it('return before the first next closes every source', () => {
    const helpers: ((source: IterableIterator<number>) => Iterator<unknown>)[] = [
      (source) => zip(source, [1]),
      (source) => accumulate(source),
      (source) => accumulate(source, undefined, 0),
      (source) => takeWhile(source, () => true),
      (source) => chain(source),
      (source) => iflatten(source as never)
    ]
    for (const helper of helpers) {
      const log: string[] = []
      helper(manual(log, 'a', [1, 2])).return?.()
      expect(log).toEqual(['a'])
    }
  })

  it('chain closes the sources it has not reached', () => {
    const log: string[] = []
    const it = chain(manual(log, 'a', [1, 2]), manual(log, 'b', [3]))
    it.next()
    it.return?.()
    expect(log.toSorted()).toEqual(['a', 'b'])
  })

  it('takeWhile closes the source once when the predicate fails', () => {
    const log: string[] = []
    expect([...takeWhile(manual(log, 'a', [1, 2]), () => false)]).toEqual([])
    expect(log).toEqual(['a'])
  })

  it('an exhausted source is not closed again', () => {
    const log: string[] = []
    const source = manual(log, 'a', [1])
    const it = takeWhile(source, () => true)
    expect([...it]).toEqual([1])
    it.return?.()
    expect(log).toEqual([])
  })

  it('an error in flight outranks a failing return', () => {
    const failingClose = (log: string[]): IterableIterator<number> =>
      manual(log, 'bad', [1, 2], () => {
        throw new Error('close failed')
      })
    const brokenNext = {
      [Symbol.iterator]: () => ({
        next(): IteratorResult<number> {
          throw new Error('next failed')
        }
      })
    }
    const log: string[] = []
    expect(() => zip(failingClose(log), brokenNext).next()).toThrow('next failed')
    expect(() => [
      ...takeWhile(failingClose(log), () => {
        throw new Error('predicate failed')
      })
    ]).toThrow('predicate failed')
    expect(() => [
      ...accumulate(failingClose(log), () => {
        throw new Error('func failed')
      })
    ]).toThrow('func failed')
    expect(log).toEqual(['bad', 'bad', 'bad'])
  })
})
