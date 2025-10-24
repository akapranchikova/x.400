import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import userEvent from '@testing-library/user-event';
import { act, render, screen, within, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const fixturesDir = path.resolve(__dirname, '../../../../test/fixtures');
const folderFixtures = JSON.parse(readFileSync(path.join(fixturesDir, 'folders.json'), 'utf-8'));
const messageFixtures = JSON.parse(readFileSync(path.join(fixturesDir, 'messages.json'), 'utf-8'));
const reportFixtures = JSON.parse(readFileSync(path.join(fixturesDir, 'reports.json'), 'utf-8'));

let messageStore: Map<string, any>;
let envelopeState: any[];

const resetState = () => {
  messageStore = new Map<string, any>();
  envelopeState = messageFixtures.map((entry: any) => {
    messageStore.set(entry.envelope.id, entry);
    return entry.envelope;
  });
};

resetState();

function createTransport() {
  return {
    async connect() {
      return {
        sessionId: randomUUID(),
        connectedAt: new Date().toISOString(),
        peer: 'offline://mocked',
      };
    },
    folders: {
      async listFolders() {
        return folderFixtures;
      },
    },
    messages: {
      async listMessages(folderId: string) {
        return envelopeState.filter((entry) => entry.folder === folderId);
      },
      async getMessage(messageId: string) {
        const record = messageStore.get(messageId);
        if (!record) {
          throw Object.assign(new Error('Message not found'), { status: 404 });
        }
        return record;
      },
    },
    trace: {
      async bundle() {
        return { entries: [{ event: 'message.submit', payload: { status: 'delivered' } }] };
      },
    },
    async compose(payload: {
      subject: string;
      body: string;
      sender: string;
      recipients: string[];
    }) {
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

      const record = {
        envelope,
        content: { text: payload.body, attachments: [] },
        reports: [],
      };

      envelopeState = [envelope, ...envelopeState];
      messageStore.set(id, record);

      setTimeout(() => {
        const current = messageStore.get(id);
        if (!current) return;
        current.envelope = { ...current.envelope, folder: 'inbox', status: 'read' };
        current.reports = reportFixtures;
        envelopeState = envelopeState.map((entry) =>
          entry.id === id
            ? { ...current.envelope, createdAt: entry.createdAt, updatedAt: entry.updatedAt }
            : entry,
        );
      }, 150);

      return {
        message_id: id,
        queue_reference: `queue://outbox/${id}`,
        status: 'queued',
        strategy: 1,
      };
    },
  };
}

vi.mock('@x400/sdk-wrapper', async () => {
  const actual = await vi.importActual<typeof import('@x400/sdk-wrapper')>('@x400/sdk-wrapper');
  return {
    ...actual,
    createMockTransport: () => createTransport(),
  };
});

import App from '../../src/App';
import { reconnectTransport } from '../../src/lib/transport';

describe('Send and Receive flow (offline fallback)', () => {
  beforeEach(async () => {
    resetState();
    await reconnectTransport();
  });

  test('lists, reads, composes and verifies delivery reports', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: /x\.400 client modernization/i });
    await screen.findByRole('button', { name: /compose/i });

    expect(await screen.findByRole('button', { name: /mocked welcome message/i })).toBeVisible();

    await user.click(screen.getByRole('button', { name: /mocked welcome message/i }));
    await screen.findByRole('heading', { level: 1, name: /mocked welcome message/i });

    await user.click(screen.getByRole('button', { name: /compose/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /compose message/i })).toBeVisible();

    await user.clear(within(dialog).getByLabelText('Subject'));
    await user.type(within(dialog).getByLabelText('Subject'), 'Playwright modern message');
    await user.clear(within(dialog).getByLabelText('Body'));
    await user.type(within(dialog).getByLabelText('Body'), 'This is the message body.');
    await user.click(within(dialog).getByRole('button', { name: /send/i }));

    await screen.findByRole('button', { name: /playwright modern message/i });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'r',
          ctrlKey: process.platform !== 'darwin',
          metaKey: process.platform === 'darwin',
        }),
      );
    });

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: /playwright modern message/i }),
      ).toBeVisible(),
    );

    const detail = await screen.findByRole('article', { name: /message details/i });
    await waitFor(() =>
      expect(
        within(detail).getByText(
          (content, element) =>
            element?.tagName.toLowerCase() === 'p' && content.trim().toLowerCase() === 'read',
        ),
      ).toBeVisible(),
    );
    await within(detail).findByText(/^delivery/i);
  });
});
