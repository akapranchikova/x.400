// vite.config.ts
import { defineConfig } from 'vitest/config'; // ⬅️ важно: vitest/config
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
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
  },
});
