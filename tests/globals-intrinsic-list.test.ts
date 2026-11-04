/**
 * POL-30: intrinsic prototypes come from an explicit constructor list.
 * Own file so the fork can install globals before a fresh dynamic import.
 */
import { describe, expect, it, vi } from 'vitest'

describe('POL-30 intrinsic prototypes from an explicit list', () => {
  it('throwing globalThis getter does not break a fresh globals import', async () => {
    const key = '__atomicFnsThrowingProbe'
    Object.defineProperty(globalThis, key, {
      configurable: true,
      enumerable: true,
      get() {
        throw new Error('SecurityError')
      }
    })
    try {
      vi.resetModules()
      const mod = await import('../src/globals/index.js')
      expect(typeof mod.get).toBe('function')
      expect(mod.get('toString', {}, 'D')).toBe('D')
    } finally {
      Reflect.deleteProperty(globalThis, key)
    }
  })

  it('user class installed as a global keeps methods readable via get()', async () => {
    class UserBoxPol30 {
      secret() {
        return 42
      }
    }
    Object.defineProperty(globalThis, 'UserBoxPol30', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: UserBoxPol30
    })
    try {
      vi.resetModules()
      const mod = await import('../src/globals/index.js')
      const secret = mod.get('secret', new UserBoxPol30())
      expect(typeof secret).toBe('function')
      if (typeof secret === 'function') {
        expect(secret.call(new UserBoxPol30())).toBe(42)
      }
    } finally {
      Reflect.deleteProperty(globalThis, 'UserBoxPol30')
    }
  })
})
