import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@x400/shared/testing',
        replacement: path.resolve(rootDir, '../../packages/shared/src/testing/index.ts'),
      },
      { find: '@x400/shared/', replacement: path.resolve(rootDir, '../../packages/shared/src/') },
      {
        find: '@x400/shared',
        replacement: path.resolve(rootDir, '../../packages/shared/src/index.ts'),
      },
      {
        find: '@x400/sdk-wrapper/',
        replacement: path.resolve(rootDir, '../../packages/sdk-wrapper/src/'),
      },
      {
        find: '@x400/sdk-wrapper',
        replacement: path.resolve(rootDir, './src/test-utils/sdk-wrapper.ts'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['e2e/offline/**/*.test.ts?(x)'],
    server: {
      deps: {
        inline: ['@x400/sdk-wrapper'],
      },
    },
  },
});
