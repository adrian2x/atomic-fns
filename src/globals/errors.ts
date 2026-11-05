/**
 * Library error classes.
 */

/**
 * A custom error class that inherits from the Error object.
 * Accepts the standard `Error` constructor arguments: an optional message and `ErrorOptions` (e.g. `cause`).
 * `name` is the concrete class's name, so a subclass reports its own. Like a native error's, it is
 * not an enumerable key.
 */
export class CustomError extends Error {
  // Explicit, so bundlers that rename classes leave err.name alone.
  static readonly name: string = 'CustomError'

  constructor(message?: string, options?: ErrorOptions) {
    super(message, options)
    Object.defineProperty(this, 'name', {
      value: new.target.name,
      writable: true,
      configurable: true
    })
  }
}

/** Custom error to signal an invalid index access. */
export class IndexError extends CustomError {
  static readonly name = 'IndexError'
}

/** Raised when a system function returns an I/O failure. */
export class IOError extends CustomError {
  static readonly name = 'IOError'
}

/** Custom error to signal an invalid key access. */
export class KeyError extends CustomError {
  static readonly name = 'KeyError'
}

/** Custom error to signal an invalid operation. */
export class NotImplementedError extends CustomError {
  static readonly name = 'NotImplementedError'
}

/** Custom error to signal an invalid value. */
export class ValueError extends CustomError {
  static readonly name = 'ValueError'
}

/** Raised when the second argument of a division or modulo operation is zero. */
export class ZeroDivisionError extends CustomError {
  static readonly name = 'ZeroDivisionError'
}
