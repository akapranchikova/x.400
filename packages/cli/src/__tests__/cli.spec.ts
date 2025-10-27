import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest';

let sharedModule: Awaited<ReturnType<typeof importShared>>;

async function importShared() {
  return import('@x400/shared');
}

/**
 * Creates a mock transport with predictable responses.
 * Each test gets a fresh instance to avoid cross-test interference.
 */
const createTransportMock = () => {
  const { makeMessage } = sharedModule;
  const message = makeMessage();

  const transport = {
    connect: vi.fn().mockResolvedValue({
      sessionId: 'test',
      connectedAt: new Date().toISOString(),
      peer: 'mock',
    }),
    gateway: {
      send: vi.fn().mockImplementation(async (payload: { to: string[] }) => ({
        messageId: message.envelope.id,
        accepted: true,
        recipients: payload.to,
        warnings: [],
      })),
      peekInbound: vi.fn().mockResolvedValue({
        messages: [
          {
            uid: 'gateway-1',
            subject: 'Mock gateway message',
            from: 'C=DE;O=Gateway;S=Mock',
          },
        ],
      }),
      acknowledge: vi.fn().mockImplementation(async (ids: string[]) => ({
        acknowledged: ids.length,
      })),
      preview: vi.fn().mockResolvedValue({
        mapped: 'C=DE;O=Gateway;S=Preview',
        warnings: [],
      }),
    },
    directory: {
      search: vi.fn().mockResolvedValue([
        {
          id: 'entry-1',
          displayName: 'Mock Directory Entry',
          rfc822: 'mock@example.com',
          orAddress: 'C=DE;O=Directory;S=Mock',
          attributes: {},
        },
      ]),
      getEntry: vi.fn().mockResolvedValue({
        id: 'entry-1',
        displayName: 'Mock Directory Entry',
        rfc822: 'mock@example.com',
        orAddress: 'C=DE;O=Directory;S=Mock',
        attributes: {},
      }),
      getDistributionList: vi.fn().mockResolvedValue({
        id: 'dl-1',
        name: 'Mock Distribution List',
        members: ['C=DE;O=Directory;S=Member'],
      }),
    },
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
    migration: {
      import: vi.fn().mockResolvedValue({ jobId: 'job-123' }),
      progress: vi.fn().mockResolvedValue({
        jobId: 'job-123',
        status: 'completed',
        total: 1,
        processed: 1,
        imported: 1,
        failed: 0,
        duplicates: 0,
        dryRun: false,
        checksumOk: true,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        currentPath: '/legacy/message.fwm',
        notes: [],
      }),
      report: vi.fn().mockResolvedValue({
        jobId: 'job-123',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        total: 1,
        imported: 1,
        failed: 0,
        duplicates: 0,
        dryRun: false,
        checksumOk: true,
        notes: ['ok'],
        errors: [],
      }),
    },
    compose: vi.fn().mockResolvedValue({
      messageId: message.envelope.id,
      queueReference: `queue://outbox/${message.envelope.id}`,
      status: 'queued',
    }),
    status: vi.fn().mockResolvedValue({
      transportMode: 'mock' as const,
      tls: {
        enabled: false,
        minVersion: 'TLS1_3',
        fingerprintMatches: true,
        ocspResponderConfigured: false,
        revocationChecked: false,
        warnings: [],
      },
      smimeEnabled: false,
    }),
  };

  return { transport, message } as const;
};

describe('CLI program', () => {
  // Capture console output; restore after the suite.
  let consoleSpy: any;
  let consoleErrorSpy: any;

  beforeAll(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  beforeEach(async () => {
    consoleSpy.mockClear();
    consoleErrorSpy.mockClear();
    vi.resetModules();
    vi.doMock('@x400/shared', async () => {
      const actual = await vi.importActual<typeof import('../../../shared/src')>(
        '../../../shared/src/index.ts',
      );
      return actual;
    });
    vi.doMock('@x400/sdk-wrapper', async () => {
      const actual = await vi.importActual<typeof import('../../../sdk-wrapper/src')>(
        '../../../sdk-wrapper/src/index.ts',
      );
      return actual;
    });
    sharedModule = await importShared();
  });

  it('lists folders when invoked with --folders', async () => {
    const { transport } = createTransportMock();
    const { buildProgram } = await import('../program');
    const program = buildProgram({ createTransport: () => transport }).exitOverride();

    // For { from: 'user' }, pass only user args (no "node", no script name).
    await program.parseAsync(['list', '--folders'], { from: 'user' });

    expect(transport.folders.listFolders).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Inbox'));
  });

  it('retrieves a message summary via the message command', async () => {
    const { transport, message } = createTransportMock();
    const { buildProgram } = await import('../program');
    const program = buildProgram({ createTransport: () => transport }).exitOverride();

    await program.parseAsync(['message', '--id', String(message.envelope.id)], { from: 'user' });

    expect(transport.messages.getMessage).toHaveBeenCalledWith(message.envelope.id);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(message.envelope.subject));
  });

  it('parses addresses for create command and forwards to compose', async () => {
    const { transport } = createTransportMock();
    const { buildProgram } = await import('../program');
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
    const { buildProgram } = await import('../program');
    const program = buildProgram({ createTransport: () => transport }).exitOverride();

    // First call returns one queued message in outbox; second call returns empty.
    transport.messages.listMessages
      .mockResolvedValueOnce([sharedModule.makeEnvelope({ folder: 'outbox', status: 'queued' })])
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

  it('prints environment details as JSON when requested', async () => {
    const originalHost = process.env.CORE_IPC_HOST;
    const originalPort = process.env.CORE_IPC_PORT;
    const originalProfile = process.env.CLI_DEFAULT_PROFILE;
    const originalMode = process.env.X400_MODE;

    process.env.CORE_IPC_HOST = '192.168.0.10';
    process.env.CORE_IPC_PORT = '4500';
    process.env.CLI_DEFAULT_PROFILE = 'ci-profile';
    process.env.X400_MODE = 'sdk';

    try {
      vi.resetModules();
      vi.doMock('@x400/shared', async () => {
        const actual = await vi.importActual<typeof import('../../../shared/src')>(
          '../../../shared/src/index.ts',
        );
        return actual;
      });
      vi.doMock('@x400/sdk-wrapper', async () => {
        const actual = await vi.importActual<typeof import('../../../sdk-wrapper/src')>(
          '../../../sdk-wrapper/src/index.ts',
        );
        return actual;
      });
      sharedModule = await importShared();
      const { transport } = createTransportMock();
      const { buildProgram } = await import('../program');
      const program = buildProgram({ createTransport: () => transport }).exitOverride();

      await program.parseAsync(['env', '--json'], { from: 'user' });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"mode": "sdk"'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"ipc": "http://192.168.0.10:4500"'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"profile": "ci-profile"'));
    } finally {
      if (originalHost === undefined) {
        delete process.env.CORE_IPC_HOST;
      } else {
        process.env.CORE_IPC_HOST = originalHost;
      }

      if (originalPort === undefined) {
        delete process.env.CORE_IPC_PORT;
      } else {
        process.env.CORE_IPC_PORT = originalPort;
      }

      if (originalProfile === undefined) {
        delete process.env.CLI_DEFAULT_PROFILE;
      } else {
        process.env.CLI_DEFAULT_PROFILE = originalProfile;
      }

      if (originalMode === undefined) {
        delete process.env.X400_MODE;
      } else {
        process.env.X400_MODE = originalMode;
      }
    }
  });

  it('creates diagnostics bundle via support trace command', async () => {
    const { transport } = createTransportMock();
    transport.trace.bundle.mockResolvedValue({
      entries: [
        {
          flow: 'gateway.outbound',
          latency_ms: 12,
          success: true,
          timestamp: Date.now(),
        },
      ],
    });
    const written: string[] = [];

    vi.doMock('node:fs', async () => {
      const { PassThrough } = await import('node:stream');
      return {
        promises: {
          access: vi.fn().mockRejectedValue(new Error('missing')),
          mkdir: vi.fn().mockResolvedValue(undefined),
          readFile: vi.fn().mockResolvedValue(Buffer.alloc(0)),
        },
        createWriteStream: vi.fn(() => {
          const stream = new PassThrough();
          stream.on('data', (chunk: Buffer) => written.push(chunk.toString()));
          return stream;
        }),
      };
    });

    vi.doMock('node:stream/promises', () => ({
      pipeline: vi.fn(async (readable: NodeJS.ReadableStream, writable: NodeJS.WritableStream) => {
        await new Promise<void>((resolve, reject) => {
          readable.pipe(writable);
          writable.on('finish', resolve);
          writable.on('error', reject);
        });
      }),
    }));

    vi.doMock('yazl', async () => {
      const { PassThrough } = await import('node:stream');
      return {
        ZipFile: class {
          outputStream = new PassThrough();
          addBuffer(buffer: Buffer, name: string) {
            this.outputStream.write(Buffer.from(`${name}:${buffer.length};`));
          }
          addFile(filePath: string, name: string) {
            this.outputStream.write(Buffer.from(`${name}:${filePath};`));
          }
          end() {
            this.outputStream.end();
          }
        },
      };
    });

    const { buildProgram } = await import('../program');
    const program = buildProgram({ createTransport: () => transport }).exitOverride();

    await program.parseAsync(['support', 'trace', '--output', 'support/bundle.zip'], {
      from: 'user',
    });

    expect(written.join('')).toContain('metadata.json');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Diagnostics bundle written'));

    vi.doUnmock('node:fs');
    vi.doUnmock('node:stream/promises');
    vi.doUnmock('yazl');
  });

  it('performs bind-test and reports status', async () => {
    const { transport } = createTransportMock();
    const { buildProgram } = await import('../program');
    const program = buildProgram({ createTransport: () => transport }).exitOverride();

    await program.parseAsync(['bind-test'], { from: 'user' });

    expect(transport.status).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"status"'));
  });

  it('runs migration command and prints summary', async () => {
    const { transport } = createTransportMock();
    const { buildProgram } = await import('../program');
    const program = buildProgram({ createTransport: () => transport }).exitOverride();

    await program.parseAsync(['migrate', '--path', '/legacy', '--type', 'fwz'], { from: 'user' });

    expect(transport.migration.import).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/legacy', mode: 'fwz' }),
    );
    expect(transport.migration.report).toHaveBeenCalledWith('job-123');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Migration completed'));
  });
});
