#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const uiClientDir = path.resolve(__dirname, '..');

const browserNames = ['chromium', 'firefox'];

const candidateBrowserDirs = () => {
  const explicit = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const dirs = new Set();
  if (explicit && explicit !== '0') {
    dirs.add(path.resolve(explicit));
  }
  dirs.add(path.join(uiClientDir, 'node_modules', '.cache', 'ms-playwright'));
  dirs.add(path.join(repoRoot, 'node_modules', '.cache', 'ms-playwright'));
  dirs.add(path.join(os.homedir(), '.cache', 'ms-playwright'));
  if (process.platform === 'win32') {
    dirs.add(path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'));
  }
  if (process.platform === 'darwin') {
    dirs.add(path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'));
  }
  return Array.from(dirs);
};

const hasBrowsers = () => {
  const dirs = candidateBrowserDirs();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      const foundAll = browserNames.every((name) =>
        entries.some((entry) => entry.isDirectory() && entry.name.startsWith(`${name}-`)),
      );
      if (foundAll) {
        return true;
      }
    } catch (error) {
      // ignore unreadable directories
    }
  }
  return false;
};

const run = (command, args, options = {}) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options,
    });
    child.on('close', (code, signal) => {
      resolve({ code, signal });
    });
    child.on('error', (error) => {
      console.error(error);
      resolve({ code: 1, signal: null });
    });
  });

const ensureBrowsers = async () => {
  if (hasBrowsers()) {
    return true;
  }
  console.log(
    'No Playwright browsers detected locally. Attempting to install Chromium and Firefox…',
  );
  const result = await run(
    'pnpm',
    ['--dir', uiClientDir, 'exec', 'playwright', 'install', 'chromium', 'firefox'],
    {
      env: { ...process.env },
    },
  );
  if (result.code === 0) {
    return true;
  }
  console.warn('Playwright browser installation failed.');
  return false;
};

const runPlaywright = async () => {
  const env = {
    ...process.env,
    PLAYWRIGHT_UI_BASE_URL: process.env.PLAYWRIGHT_UI_BASE_URL ?? 'http://127.0.0.1:4173',
    CORE_IPC_SCHEME: process.env.CORE_IPC_SCHEME ?? 'http',
    CORE_IPC_HOST: process.env.CORE_IPC_HOST ?? '127.0.0.1',
    CORE_IPC_PORT: process.env.CORE_IPC_PORT ?? '3333',
  };
  const result = await run(
    'pnpm',
    ['--dir', uiClientDir, 'exec', 'playwright', 'test', '-c', 'playwright.config.ts'],
    { env },
  );
  return result.code === 0;
};

const runOfflineSuite = async () => {
  const env = {
    ...process.env,
    UI_CLIENT_E2E_OFFLINE: '1',
    CORE_IPC_SCHEME: process.env.CORE_IPC_SCHEME ?? 'http',
    CORE_IPC_HOST: process.env.CORE_IPC_HOST ?? '127.0.0.1',
    CORE_IPC_PORT: process.env.CORE_IPC_PORT ?? '3333',
  };
  const result = await run(
    'pnpm',
    ['--dir', uiClientDir, 'exec', 'vitest', 'run', '--config', 'vitest.e2e.config.ts'],
    { env },
  );
  return result.code === 0;
};

const shouldForcePlaywright = () => {
  const value = process.env.PLAYWRIGHT_DISABLE_FALLBACK;
  return value === '1' || value?.toLowerCase() === 'true';
};

const main = async () => {
  const force = shouldForcePlaywright();
  const canRunPlaywright = (await ensureBrowsers()) && (await runPlaywright());
  if (canRunPlaywright) {
    process.exit(0);
  }
  if (force) {
    process.exit(1);
  }
  console.warn('Falling back to the offline Vitest UI flow.');
  const success = await runOfflineSuite();
  process.exit(success ? 0 : 1);
};

main();
