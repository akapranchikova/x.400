import { makeMessage, makeEnvelope } from '@x400/shared/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { buildProgram } from '../program';

const createTransportMock = () => {
  const message = makeMessage();

  const transport = {
    connect: vi
      .fn()
      .mockResolvedValue({
        sessionId: 'test',
        connectedAt: new Date().toISOString(),
        peer: 'mock',
      }),
    folders: {
      listFolders: vi.fn().mockResolvedValue([
        { id: 'inbox', name: 'Inbox', unreadCount: 1 },
        { id: 'outbox', name: 'Outbox', unreadCount: 0 },
      ]),
    },
    messages: {
      listMessages: vi.fn().mockResolvedValue([message.envelope]),
      getMessage: vi.fn().mockResolvedValue(message),
      submitMessage: vi.fn().mockResolvedValue({
        messageId: message.envelope.id,
        queueReference: `queue://outbox/${message.envelope.id}`,
        status: 'queued',
      }),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
      moveMessage: vi.fn().mockResolvedValue(undefined),
      archiveMessage: vi.fn().mockResolvedValue(undefined),
    },
    trace: {
      bundle: vi.fn().mockResolvedValue({ entries: [] }),
    },
    compose: vi.fn().mockResolvedValue({
      messageId: message.envelope.id,
      queueReference: `queue://outbox/${message.envelope.id}`,
      status: 'queued',
    }),
  };

  return { transport, message } as const;
};

describe('CLI program', () => {
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    consoleSpy.mockClear();
  });

  it('lists folders when invoked with --folders', async () => {
    const { transport } = createTransportMock();
    const program = buildProgram({ createTransport: () => transport });
    program.exitOverride();

    await program.parseAsync(['node', 'cli', 'list', '--folders'], { from: 'user' });

    expect(transport.folders.listFolders).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Inbox'));
  });

  it('retrieves a message summary via the message command', async () => {
    const { transport, message } = createTransportMock();
    const program = buildProgram({ createTransport: () => transport });
    program.exitOverride();

    await program.parseAsync(['node', 'cli', 'message', '--id', message.envelope.id], {
      from: 'user',
    });

    expect(transport.messages.getMessage).toHaveBeenCalledWith(message.envelope.id);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(message.envelope.subject));
  });

  it('parses addresses for create command and forwards to compose', async () => {
    const { transport } = createTransportMock();
    const program = buildProgram({ createTransport: () => transport });
    program.exitOverride();

    await program.parseAsync(
      [
        'node',
        'cli',
        'create',
        '--from',
        'C=DE;O=Modern;S=Operator',
        '--to',
        'C=DE;O=Unit;S=One',
        '--subject',
        'CLI Test',
      ],
      { from: 'user' },
    );

    expect(transport.compose).toHaveBeenCalled();
    const payload = transport.compose.mock.calls[0][0];
    expect(payload.recipients).toHaveLength(1);
    expect(payload.subject).toBe('CLI Test');
  });

  it('wait command polls until the queue is empty', async () => {
    const { transport } = createTransportMock();
    const program = buildProgram({ createTransport: () => transport });
    program.exitOverride();

    transport.messages.listMessages
      .mockResolvedValueOnce([makeEnvelope({ folder: 'outbox', status: 'queued' })])
      .mockResolvedValueOnce([]);

    vi.useFakeTimers();
    const execution = program.parseAsync(['node', 'cli', 'wait', '--timeout', '1'], {
      from: 'user',
    });
    await vi.advanceTimersByTimeAsync(2000);
    await execution;
    vi.useRealTimers();

    expect(transport.messages.listMessages).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Outbox is empty'));
  });
});
