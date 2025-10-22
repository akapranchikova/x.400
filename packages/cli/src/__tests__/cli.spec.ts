import { makeMessage, makeEnvelope } from '@x400/shared/testing';
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest';

import { buildProgram } from '../program';

/**
 * Creates a mock transport with predictable responses.
 * Each test gets a fresh instance to avoid cross-test interference.
 */
const createTransportMock = () => {
  const message = makeMessage();

  const transport = {
    connect: vi.fn().mockResolvedValue({
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
  // Capture console output; restore after the suite.
  let consoleSpy: any;

  beforeAll(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  beforeEach(() => {
    consoleSpy.mockClear();
  });

  it('lists folders when invoked with --folders', async () => {
    const { transport } = createTransportMock();
    const program = buildProgram({ createTransport: () => transport }).exitOverride();

    // For { from: 'user' }, pass only user args (no "node", no script name).
    await program.parseAsync(['list', '--folders'], { from: 'user' });

    expect(transport.folders.listFolders).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Inbox'));
  });

  it('retrieves a message summary via the message command', async () => {
    const { transport, message } = createTransportMock();
    const program = buildProgram({ createTransport: () => transport }).exitOverride();

    await program.parseAsync(['message', '--id', String(message.envelope.id)], { from: 'user' });

    expect(transport.messages.getMessage).toHaveBeenCalledWith(message.envelope.id);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(message.envelope.subject));
  });

  it('parses addresses for create command and forwards to compose', async () => {
    const { transport } = createTransportMock();
    const program = buildProgram({ createTransport: () => transport }).exitOverride();

    await program.parseAsync(
      [
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

    expect(transport.compose).toHaveBeenCalledTimes(1);
    const [payload] = transport.compose.mock.calls[0];
    expect(payload.recipients).toHaveLength(1);
    expect(payload.subject).toBe('CLI Test');
  });

  it('wait command polls until the queue is empty', async () => {
    const { transport } = createTransportMock();
    const program = buildProgram({ createTransport: () => transport }).exitOverride();

    // First call returns one queued message in outbox; second call returns empty.
    transport.messages.listMessages
      .mockResolvedValueOnce([makeEnvelope({ folder: 'outbox', status: 'queued' })])
      .mockResolvedValueOnce([]);

    // Use fake timers so we can deterministically progress the polling loop.
    vi.useFakeTimers();

    // Use a larger timeout to avoid expiring before we advance timers.
    const exec = program.parseAsync(['wait', '--timeout', '5'], { from: 'user' });

    // Step 1: trigger the first poll tick.
    await vi.advanceTimersByTimeAsync(1000);

    // Step 2: trigger the next poll tick where the queue is empty.
    await vi.advanceTimersByTimeAsync(1000);

    // Ensure the command completes successfully.
    await expect(exec).resolves.toBeDefined();

    vi.useRealTimers();

    expect(transport.messages.listMessages).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Outbox is empty'));
  });
});
