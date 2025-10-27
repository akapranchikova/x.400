#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const rawArgs = process.argv.slice(2);

let project = 'tsconfig.json';
const passThrough = [];

for (let i = 0; i < rawArgs.length; i += 1) {
  const arg = rawArgs[i];

  if (arg === '--') {
    break;
  }

  if (arg === '--output-logs') {
    i += 1;
    continue;
  }

  if (arg.startsWith('--output-logs=')) {
    continue;
  }

  if (arg === '--project' || arg === '-p') {
    const next = rawArgs[i + 1];
    if (next) {
      project = next;
      i += 1;
    }
    continue;
  }

  if (arg.startsWith('--project=')) {
    project = arg.slice('--project='.length);
    continue;
  }

  if (arg.startsWith('-p')) {
    const value = arg.includes('=') ? arg.split('=')[1] : arg.slice(2);
    if (value) {
      project = value;
    }
    continue;
  }

  passThrough.push(arg);
}

const tsconfigPath = resolve(process.cwd(), project);

const tscArgs = ['exec', 'tsc', '--watch', '--project', tsconfigPath, ...passThrough];

console.log(`[watch-tsc] Starting TypeScript compiler with: pnpm ${tscArgs.join(' ')}`);

const child = spawn('pnpm', tscArgs, {
  stdio: 'inherit',
});

child.on('close', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('[watch-tsc] Failed to start TypeScript compiler:', error);
  process.exit(1);
});
