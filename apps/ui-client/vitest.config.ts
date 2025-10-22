import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
  },
});
