/**
 * POL-31: hash seed is created on first use, with a crypto fallback.
 * Own file so the fork can delete / break crypto before a fresh dynamic import.
 */
import { describe, expect, it, vi } from 'vitest'

describe('POL-31 lazy hash seed with crypto fallback', () => {
  it('import and Heap equality succeed with globalThis.crypto deleted', async () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
    Reflect.deleteProperty(globalThis, 'crypto')
    try {
      vi.resetModules()
      const { Heap } = await import('../src/collections/Heap.js')
      const { deepEqual } = await import('../src/operators/index.js')
      const a = new Heap([1, 2, 3])
      const b = new Heap([1, 2, 3])
      expect(deepEqual(a, b)).toBe(true)
      expect(deepEqual(a, new Heap([1, 2]))).toBe(false)
    } finally {
      if (desc !== undefined) Object.defineProperty(globalThis, 'crypto', desc)
      else Reflect.deleteProperty(globalThis, 'crypto')
    }
  })

  it('import and Heap equality succeed with a throwing crypto getter', async () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: true,
      get() {
        throw new Error('SecurityError')
      }
    })
    try {
      vi.resetModules()
      const { Heap } = await import('../src/collections/Heap.js')
      const { deepEqual } = await import('../src/operators/index.js')
      const a = new Heap([{ x: 1 }, { x: 2 }])
      const b = new Heap([{ x: 1 }, { x: 2 }])
      expect(deepEqual(a, b)).toBe(true)
      expect(deepEqual(a, new Heap([{ x: 1 }]))).toBe(false)
    } finally {
      if (desc !== undefined) Object.defineProperty(globalThis, 'crypto', desc)
      else Reflect.deleteProperty(globalThis, 'crypto')
    }
  })
})
