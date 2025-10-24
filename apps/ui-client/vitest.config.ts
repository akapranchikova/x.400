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
    globals: true, // ← это нужно, чтобы describe/it/expect были глобально
    setupFiles: ['./src/test/setup.ts'], // ← путь до setup (от корня пакета ui-client)
    include: ['src/**/*.spec.ts?(x)'],
    exclude: [
      'node_modules',
      'dist',
      'e2e/**',
      '**/e2e/**',
      '**/*.e2e.*',
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
