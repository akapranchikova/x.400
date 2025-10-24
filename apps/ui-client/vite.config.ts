// vite.config.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config'; // ⬅️ важно: vitest/config

const rootDir = fileURLToPath(new URL('.', import.meta.url));
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [rootDir, path.resolve(rootDir, '../../packages')],
    },
  },
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
    include: ['src/**/*.spec.ts?(x)'],
    exclude: [
      'node_modules',
      'dist',
      '**/e2e/**', // ⬅️ Playwright-спеки не для Vitest
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,tsup,build,eslint,prettier}.config.*',
    ],
    alias: {
      '@x400/sdk-wrapper': path.resolve(rootDir, './src/test-utils/sdk-wrapper.ts'),
      '@x400/sdk-wrapper/': path.resolve(rootDir, '../../packages/sdk-wrapper/src/'),
    },
    deps: {
      inline: ['@x400/sdk-wrapper'],
    },
  },
});
