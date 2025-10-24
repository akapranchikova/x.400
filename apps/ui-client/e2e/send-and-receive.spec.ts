import { test, expect, Page } from '@playwright/test';
import { injectAxe, checkA11y } from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const fixturesDir = path.resolve(__dirname, '../../../test/fixtures');
const folders = JSON.parse(readFileSync(path.join(fixturesDir, 'folders.json'), 'utf-8'));
const messages = JSON.parse(readFileSync(path.join(fixturesDir, 'messages.json'), 'utf-8'));
const reports = JSON.parse(readFileSync(path.join(fixturesDir, 'reports.json'), 'utf-8'));

const coreScheme = process.env.CORE_IPC_SCHEME ?? 'http';
const coreHost = process.env.CORE_IPC_HOST ?? '127.0.0.1';
const corePort = process.env.CORE_IPC_PORT ?? '3333';
const coreBaseUrl = `${coreScheme}://${coreHost}:${corePort}`;
const healthUrl = `${coreBaseUrl}/health`;
const healthTimeoutMs = Number(process.env.PLAYWRIGHT_HEALTH_TIMEOUT ?? '15000');
const healthIntervalMs = Number(process.env.PLAYWRIGHT_HEALTH_INTERVAL ?? '250');

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForHealth = async (page: Page, url: string, timeoutMs: number, intervalMs: number) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const ok = await page.evaluate(async (target) => {
      try {
        const response = await fetch(target);
        return response.ok;
      } catch (error) {
        return false;
      }
    }, url);

    if (ok) {
      return;
    }

    await wait(intervalMs);
  }

  throw new Error(`Service did not become healthy at ${url} within ${timeoutMs}ms`);
};

test.describe('Send and Receive flow', () => {
  test('@flaky lists, reads, composes and verifies delivery reports', async ({ page }) => {
    const messageStore = new Map<string, any>();
    const envelopeState = messages.map((entry: any) => {
      messageStore.set(entry.envelope.id, entry);
      return entry.envelope;
    });

    await page.route('**', async (route, request) => {
      let url: URL;
      try {
        url = new URL(request.url());
      } catch (error) {
        await route.fallback();
        return;
      }

      if (url.port !== corePort) {
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
        await route.fulfill({ json: envelopeState });
        return;
      }

      if (request.method() === 'GET' && url.pathname.startsWith('/messages/')) {
        const id = url.pathname.replace('/messages/', '');
        const message = messageStore.get(id);
        if (!message) {
          await route.fulfill({ status: 404 });
          return;
        }
        await route.fulfill({ json: message });
        return;
      }

      if (request.method() === 'POST' && url.pathname === '/compose') {
        const payload = request.postDataJSON() as any;
        const id = randomUUID();
        const now = new Date().toISOString();

        const envelope = {
          id,
          subject: payload.subject,
          sender: payload.sender,
          to: payload.recipients,
          cc: [],
          bcc: [],
          priority: 'normal',
          sensitivity: 'normal',
          folder: 'inbox',
          status: 'queued',
          createdAt: now,
          updatedAt: now,
          messageId: `<${id}@mocked.x400>`,
        };

        const message = {
          envelope,
          content: { text: payload.body, attachments: [] },
          reports: [],
        };

        envelopeState.unshift(envelope);
        messageStore.set(id, message);

        setTimeout(() => {
          const updated = messageStore.get(id);
          if (!updated) return;
          updated.envelope = { ...updated.envelope, folder: 'inbox', status: 'read' };
          updated.reports = reports;
          envelopeState[0] = {
            ...updated.envelope,
            createdAt: updated.envelope.createdAt,
            updatedAt: updated.envelope.updatedAt,
          };
        }, 150);

        await route.fulfill({
          json: {
            message_id: id,
            queue_reference: `queue://outbox/${id}`,
            status: 'queued',
            strategy: 1,
          },
        });
        return;
      }

      if (request.method() === 'GET' && url.pathname === '/trace/bundle') {
        await route.fulfill({
          json: { entries: [{ event: 'message.submit', payload: { status: 'delivered' } }] },
        });
        return;
      }

      await route.fallback();
    });

    await waitForHealth(page, healthUrl, healthTimeoutMs, healthIntervalMs);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /client modernization/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /inbox/i })).toBeVisible();
    await injectAxe(page);
    await checkA11y(page, 'body', { detailedReport: true });
    await expect(page.getByRole('button', { name: /mocked welcome message/i })).toBeVisible();

    await page.getByRole('button', { name: /mocked welcome message/i }).click();
    await expect(page.getByRole('heading', { name: /mocked welcome message/i })).toBeVisible();

    await page.getByRole('button', { name: /compose/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Subject').fill('Playwright modern message');
    await page.getByLabel('Body').fill('This is the message body.');
    await page.getByRole('button', { name: /send/i }).click();

    await expect(page.getByRole('button', { name: /playwright modern message/i })).toBeVisible();

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+R' : 'Control+R');

    await expect(page.getByRole('heading', { name: /playwright modern message/i })).toBeVisible();
    await expect(page.getByText(/Read/i)).toBeVisible();
    await expect(page.getByText(/delivery/i)).toBeVisible();
  });
});
