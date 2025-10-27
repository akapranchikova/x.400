import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const fixturesDir = path.resolve(__dirname, '../../../test/fixtures');
const folders = JSON.parse(readFileSync(path.join(fixturesDir, 'folders.json'), 'utf-8'));
const messages = JSON.parse(readFileSync(path.join(fixturesDir, 'messages.json'), 'utf-8'));

const composeMessageName = 'Mocked welcome message';

test.describe('IPC chaos resilience', () => {
  test('retries after transient faults @chaos', async ({ page }) => {
    let messageAttempts = 0;

    await page.route('**', async (route, request) => {
      let url: URL;
      try {
        url = new URL(request.url());
      } catch (error) {
        await route.fallback();
        return;
      }

      if (request.method() === 'GET' && url.pathname === '/health') {
        await route.fulfill({ json: { status: 'ok' } });
        return;
      }

      if (request.method() === 'GET' && url.pathname === '/folders') {
        await route.fulfill({ json: folders });
        return;
      }

      if (request.method() === 'GET' && url.pathname === '/messages') {
        messageAttempts += 1;
        if (messageAttempts === 1) {
          await route.fulfill({ status: 503 });
          return;
        }
        await route.fulfill({ json: messages.map((entry: any) => entry.envelope) });
        return;
      }

      if (request.method() === 'GET' && url.pathname.startsWith('/messages/')) {
        const id = url.pathname.replace('/messages/', '');
        const message = messages.find((entry: any) => entry.envelope.id === id);
        await route.fulfill({ json: message });
        return;
      }

      await route.fallback();
    });

    await page.goto('/');
    await page.waitForTimeout(300);
    await expect(
      page.getByRole('button', { name: new RegExp(composeMessageName, 'i') }),
    ).toBeVisible({
      timeout: 5000,
    });
    expect(messageAttempts).toBeGreaterThan(1);
  });
});
