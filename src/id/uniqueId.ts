const slot = Symbol.for('atomic-fns.uniqueId')
const realm = globalThis as typeof globalThis & { [slot]?: { counter: number } }

/**
 * The next id from one realm-wide counter, as a decimal string: '1', '2', and so on.
 * Every copy of atomic-fns loaded in this realm shares the counter. Each worker and each
 * process counts on its own, so ids repeat across them; use {@link uuid} for that.
 * Takes no parameters. Like `crypto.randomUUID`, it ignores any arguments passed at runtime,
 * including a lodash-style prefix argument. Add a prefix with a template string instead.
 * @returns The next id as a decimal string.
 * @example
 * ```ts
 * uniqueId() // '1'
 * `user_${uniqueId()}` // 'user_2'
 * ```
 */
export function uniqueId(): string {
  const state = (realm[slot] ??= { counter: 0 })
  state.counter++
  return String(state.counter)
}
