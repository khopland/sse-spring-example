import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: 'src/setupTests.ts',
    include: ['src/**/*.test.{ts,tsx}'],
    // produce coverage and junit test output for CI
    reporters: [["junit", { outputFile: 'coverage/junit.xml' }], 'default'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text', 'cobertura'],
      reportsDirectory: 'coverage',
    },
  },
})
