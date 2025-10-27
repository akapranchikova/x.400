import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url);
const specPath = path.resolve(new URL('.', root), 'packages/core-service/api/openapi.json');
const manifestPath = path.resolve(new URL('.', root), 'packages/sdk-wrapper/.openapi-hash');

const spec = readFileSync(specPath);
const hash = createHash('sha256').update(spec).digest('hex');

writeFileSync(manifestPath, `${hash}\n`);
console.log('Updated OpenAPI hash manifest:', hash);
