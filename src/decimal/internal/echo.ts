/** UTF-16 units of bad input an error message repeats. */
export const MAX_ECHO = 40

/** `value` quoted and cut to {@link MAX_ECHO} units. */
export function quoteForError(value: string): string {
  return `${JSON.stringify(value.slice(0, MAX_ECHO))}${value.length > MAX_ECHO ? '...' : ''}`
}
