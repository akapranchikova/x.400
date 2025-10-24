import { spawnSync } from 'node:child_process';
import process from 'node:process';

const baseArgs = ['--filter', 'ui-client', 'exec', 'playwright'];

const run = (args) => {
  const pnpmArgs = [...baseArgs, ...args];
  const pnpmExecPath = process.env.npm_execpath;

  let result;

  if (pnpmExecPath && process.execPath) {
    result = spawnSync(process.execPath, [pnpmExecPath, ...pnpmArgs], {
      stdio: 'inherit',
    });
  } else {
    const pnpmBinary = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    result = spawnSync(pnpmBinary, pnpmArgs, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  }

  if (result.error) {
    console.error(result.error);
    return 1;
  }

  return typeof result.status === 'number' ? result.status : 0;
};

if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD) {
  console.log('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set; skipping Playwright browser installation');
  process.exit(0);
}

console.log('Ensuring Playwright browsers are installed...');

let exitCode = 0;

if (process.platform === 'linux') {
  exitCode = run(['install', '--with-deps']);
  if (exitCode !== 0) {
    console.warn('Falling back to Playwright browser install without --with-deps');
    exitCode = run(['install']);
  }
} else {
  exitCode = run(['install']);
}

if (exitCode !== 0) {
  process.exit(exitCode);
}
