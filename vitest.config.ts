import { defineConfig } from 'vitest/config'

// The date specs assert en-US text and UTC wall clock fields.
process.env.LC_ALL = 'en_US.UTF-8'
process.env.TZ = 'UTC'

export default defineConfig({
  test: {
    execArgv: ['--expose-gc'],
    globals: true,
    include: ['tests/**/*.spec.ts']
  }
})
