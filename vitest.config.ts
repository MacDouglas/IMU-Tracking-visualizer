import { defineConfig } from 'vitest/config'

// Tests read fixtures/ relative to the project root (where `npm test` runs).
export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
})
