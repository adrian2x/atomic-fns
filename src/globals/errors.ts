/**
 * Library error classes.
 */

/**
 * A custom error class that inherits from the Error object.
 * Accepts the standard `Error` constructor arguments: an optional message and `ErrorOptions` (e.g. `cause`).
 */
export class CustomError extends Error {
  override name: string
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CustomError'
  }
}

/** Custom error to signal an invalid index access. */
export class IndexError extends CustomError {
  override name = 'IndexError'
}

/** Raised when a system function returns an I/O failure. */
export class IOError extends CustomError {
  override name = 'IOError'
}

/** Custom error to signal an invalid key access. */
export class KeyError extends CustomError {
  override name = 'KeyError'
}

/** Custom error to signal an invalid operation. */
export class NotImplementedError extends CustomError {
  override name = 'NotImplementedError'
}

/** Custom error to signal an invalid value. */
export class ValueError extends CustomError {
  override name = 'ValueError'
}

/** Raised when the second argument of a division or modulo operation is zero. */
export class ZeroDivisionError extends CustomError {
  override name = 'ZeroDivisionError'
}
