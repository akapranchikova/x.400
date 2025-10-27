import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url);
const specPath = path.resolve(new URL('.', root), 'packages/core-service/api/openapi.json');
const manifestPath = path.resolve(new URL('.', root), 'packages/sdk-wrapper/.openapi-hash');

if (!existsSync(specPath)) {
  console.error('OpenAPI specification not found at', specPath);
  process.exit(1);
}

if (!existsSync(manifestPath)) {
  console.error('Expected hash manifest missing at', manifestPath);
  console.error('Run `pnpm contract:update` to generate it.');
  process.exit(1);
}

const spec = readFileSync(specPath);
const hash = createHash('sha256').update(spec).digest('hex');
const expected = readFileSync(manifestPath, 'utf8').trim();

if (hash !== expected) {
  console.error('OpenAPI contract drift detected.');
  console.error(
    'Run `pnpm contract:update` after regenerating clients and updating documentation.',
  );
  process.exit(1);
}

console.log('OpenAPI contract matches recorded hash.');
