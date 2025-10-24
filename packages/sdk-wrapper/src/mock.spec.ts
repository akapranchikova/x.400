import { makeMessage, makeEnvelope } from '@x400/shared/testing';
import nock from 'nock';
import { afterEach, describe, expect, it } from 'vitest';

import { createMockTransport } from './mock';

const BASE_URL = 'http://mocked-core';

describe('createMockTransport', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('creates a transport that can generate a session locally', async () => {
    const transport = createMockTransport({ baseUrl: BASE_URL });
    const session = await transport.connect();

    expect(session.sessionId).toBeDefined();
    expect(session.peer).toContain(BASE_URL);
  });

  it('fetches folders and messages with schema validation', async () => {
    const message = makeMessage();

    nock(BASE_URL)
      .get('/folders')
      .reply(200, [
        { id: 'inbox', name: 'Inbox', unreadCount: 1 },
        { id: 'outbox', name: 'Outbox', unreadCount: 0 },
      ])
      .get('/messages')
      .query({ folder: 'inbox' })
      .reply(200, [message.envelope])
      .get(`/messages/${message.envelope.id}`)
      .reply(200, message);

    const transport = createMockTransport({ baseUrl: BASE_URL });

    const folders = await transport.folders.listFolders();
    expect(folders).toHaveLength(2);

    const envelopes = await transport.messages.listMessages('inbox');
    expect(envelopes[0].subject).toBe(message.envelope.subject);

    const fetched = await transport.messages.getMessage(message.envelope.id);
    expect(fetched.content.text).toBe(message.content.text);
  });

  it('handles compose and submit responses correctly', async () => {
    const envelope = makeEnvelope();

    nock(BASE_URL)
      .post('/compose')
      .reply(200, {
        message_id: envelope.id,
        queue_reference: `queue://outbox/${envelope.id}`,
        status: 'queued',
        strategy: 1,
      })
      .post('/submit')
      .reply(200, {
        message_id: envelope.id,
        queue_reference: `queue://outbox/${envelope.id}`,
        status: 'queued',
        strategy: 2,
      });

    const transport = createMockTransport({ baseUrl: BASE_URL });
    const composeResult = await transport.compose({
      sender: envelope.sender,
      recipients: envelope.to,
      subject: envelope.subject,
      body: 'Composed via test harness',
    });

    expect(composeResult.status).toBe('queued');
    expect(composeResult.messageId).toBe(envelope.id);

    const submitResult = await transport.messages.submitMessage(envelope, 'payload');
    expect(submitResult.queueReference).toContain(envelope.id);
    expect(submitResult.messageId).toBe(envelope.id);
  });

  it('rejects when the upstream service times out', async () => {
    const envelope = makeEnvelope();

    nock(BASE_URL).post('/submit').delayConnection(50).reply(504, { message: 'Gateway timeout' });

    const transport = createMockTransport({ baseUrl: BASE_URL, timeoutMs: 10 });

    await expect(transport.messages.submitMessage(envelope, 'content')).rejects.toThrow();
  });

  it('exposes service status information', async () => {
    nock(BASE_URL)
      .get('/status')
      .reply(200, {
        transport_mode: 'sdk',
        smime_enabled: true,
        tls: {
          enabled: true,
          min_version: 'TLS1_3',
          fingerprint: 'AA:BB',
          fingerprint_matches: true,
        },
      });

    const transport = createMockTransport({ baseUrl: BASE_URL });
    const status = await transport.status();
    expect(status.transportMode).toBe('sdk');
    expect(status.tls.enabled).toBe(true);
    expect(status.smimeEnabled).toBe(true);
  });
});
