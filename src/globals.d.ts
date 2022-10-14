interface ErrorConstructor {
  /** See https://v8.dev/docs/stack-trace-api#stack-trace-collection-for-custom-exceptions. */
  // eslint-disable-next-line @typescript-eslint/ban-types
  captureStackTrace(error: Object, constructor?: Function): void
}
