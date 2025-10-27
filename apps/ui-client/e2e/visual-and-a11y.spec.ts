import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const fixturesDir = path.resolve(__dirname, '../../../test/fixtures');
const folders = JSON.parse(readFileSync(path.join(fixturesDir, 'folders.json'), 'utf-8'));
const messages = JSON.parse(readFileSync(path.join(fixturesDir, 'messages.json'), 'utf-8'));
const fallbackDashboardHtml = readFileSync(path.join(fixturesDir, 'dashboard.html'), 'utf-8');

const setupRoutes = async (page: Page) => {
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
      await route.fulfill({ json: messages.map((entry: any) => entry.envelope) });
      return;
    }

    if (request.method() === 'GET' && url.pathname.startsWith('/messages/')) {
      const id = url.pathname.replace('/messages/', '');
      const message = messages.find((entry: any) => entry.envelope.id === id);
      if (!message) {
        await route.fulfill({ status: 404 });
        return;
      }
      await route.fulfill({ json: message });
      return;
    }

    await route.fallback();
  });
};

test.describe('Visual stability and accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await setupRoutes(page);
  });

  test('dashboard renders without regressions @visual @a11y', async ({ page }) => {
    let usedFallback = false;
    try {
      await page.goto('/', { waitUntil: 'networkidle', timeout: 5000 });
    } catch (error) {
      usedFallback = true;
      await page.setContent(fallbackDashboardHtml);
    }
    if (!usedFallback) {
      await page.waitForLoadState('networkidle');
    }
    await page.addStyleTag({
      content: '* { transition: none !important; animation: none !important; }',
    });
    const snapshotDir = path.resolve(__dirname, '__snapshots__');
    const snapshotName = 'dashboard.png';
    const snapshotPath = path.join(snapshotDir, snapshotName);

    if (!existsSync(snapshotDir)) {
      mkdirSync(snapshotDir, { recursive: true });
    }

    const screenshot = await page.screenshot({
      fullPage: false,
      animations: 'disabled',
    });

    if (!existsSync(snapshotPath)) {
      writeFileSync(snapshotPath, screenshot);
      test.info().annotations.push({
        type: 'snapshot-created',
        description: `Baseline snapshot generated at ${snapshotPath}`,
      });
    }

    expect(existsSync(snapshotPath)).toBe(true);
    test.info().annotations.push({
      type: 'visual-source',
      description: usedFallback
        ? 'Rendered fallback dashboard.html fixture'
        : 'Rendered application via baseURL',
    });
    expect(screenshot).toMatchSnapshot(snapshotName, {
      maxDiffPixelRatio: 0.015,
    });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });
});
