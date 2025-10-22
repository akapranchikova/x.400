#!/usr/bin/env tsx
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env'), override: false });
dotenv.config({ path: path.join(rootDir, '.env.local'), override: false });
dotenv.config({ path: path.join(rootDir, '.env.test'), override: false });

const baseUrl = process.env.X400_CORE_SERVICE_URL ?? 'http://127.0.0.1:7878';

async function postJson(endpoint: string, payload: unknown) {
  const response = await fetch(new URL(endpoint, baseUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.X400_CORE_SERVICE_API_KEY ?? 'test-api-key'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request to ${endpoint} failed: ${response.status} ${response.statusText} - ${body}`);
  }

  return response.json();
}

async function seed() {
  const fixturesDir = path.join(rootDir, 'test/fixtures');
  const messagesRaw = await readFile(path.join(fixturesDir, 'messages.json'), 'utf-8');
  const reportsRaw = await readFile(path.join(fixturesDir, 'reports.json'), 'utf-8');

  const messages = JSON.parse(messagesRaw);
  const reports = JSON.parse(reportsRaw);

  for (const message of messages) {
    const envelope = message.envelope;
    const content = message.content;

    await postJson('/submit', {
      envelope: {
        ...envelope,
        id: envelope.id,
        created_at: envelope.createdAt,
        updated_at: envelope.updatedAt
      },
      content,
      strategy: 1
    });
  }

  console.log(
    `Seeded ${messages.length} message(s) to ${baseUrl}. ${reports.length} delivery report fixture(s) are available for tests.`,
  );
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
