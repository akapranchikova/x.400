import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const packageDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@x400/shared': resolve(packageDir, '../shared/src'),
      '@x400/shared/testing': resolve(packageDir, '../shared/src/testing/index.ts'),
    },
  },
  test: {
    threads: false,
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.property.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      lines: 0.9,
      functions: 0.9,
      statements: 0.9,
      branches: 0.85,
    },
  },
});
