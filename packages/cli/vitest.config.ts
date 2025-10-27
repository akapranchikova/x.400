import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@x400/shared/testing',
        replacement: path.resolve(rootDir, '../../shared/src/testing/index.ts'),
      },
      { find: '@x400/shared/', replacement: path.resolve(rootDir, '../../shared/src/') },
      { find: '@x400/shared', replacement: path.resolve(rootDir, '../../shared/src/index.ts') },
      { find: '@x400/sdk-wrapper/', replacement: path.resolve(rootDir, '../../sdk-wrapper/src/') },
      {
        find: '@x400/sdk-wrapper',
        replacement: path.resolve(rootDir, '../../sdk-wrapper/src/index.ts'),
      },
    ],
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.property.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      lines: 0.9,
      branches: 0.85,
      functions: 0.9,
      statements: 0.9,
    },
  },
});
