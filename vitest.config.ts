import { defineConfig } from 'vitest/config'

// Intl output in the specs is asserted in en-US.
process.env.LC_ALL = 'en_US.UTF-8'

const packageThresholds = { lines: 90, statements: 90, functions: 90, branches: 85 }

export default defineConfig({
  test: {
    execArgv: ['--expose-gc'],
    include: ['tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      thresholds: { 'src/**': packageThresholds }
    }
  }
})
