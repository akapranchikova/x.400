import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      lines: 0.8,
      branches: 0.75,
      functions: 0.8,
      statements: 0.8
    }
  }
});
