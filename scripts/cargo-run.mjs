#!/usr/bin/env node
import { spawn } from 'node:child_process';

const rawArgs = process.argv.slice(2);

const sanitizedArgs = [];
for (let i = 0; i < rawArgs.length; i += 1) {
  const arg = rawArgs[i];

  if (arg === '--output-logs') {
    i += 1;
    continue;
  }

  if (arg && arg.startsWith('--output-logs=')) {
    continue;
  }

  sanitizedArgs.push(arg);
}

let cargoArgs = sanitizedArgs;
let binaryArgs = [];
const separatorIndex = sanitizedArgs.indexOf('--');

if (separatorIndex !== -1) {
  cargoArgs = sanitizedArgs.slice(0, separatorIndex);
  binaryArgs = sanitizedArgs.slice(separatorIndex + 1);
}

const finalArgs = ['run', ...cargoArgs];

if (binaryArgs.length > 0) {
  finalArgs.push('--', ...binaryArgs);
}

console.log(`[cargo-run] Starting Cargo with: cargo ${finalArgs.join(' ')}`);

const child = spawn('cargo', finalArgs, {
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
  console.error('[cargo-run] Failed to start cargo run:', error);
  process.exit(1);
});
