import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    pool: 'forks',
    testTimeout: process.env.CI ? 40_000 : 5000,
    execArgv: ['--expose-gc'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/i18n/index.ts'],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 }
    }
  }
})
