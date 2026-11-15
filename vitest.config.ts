import { defineConfig } from 'vitest/config'

// Intl output in the specs is asserted in en-US.
process.env.LC_ALL = 'en_US.UTF-8'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts']
  }
})
