import { afterEach, describe, expect, it, vi } from 'vitest';

const createMockTransport = vi.fn(() => ({
  connect: vi.fn().mockResolvedValue({ connected: true }),
}));

vi.mock(
  '@x400/sdk-wrapper',
  () => ({
    createMockTransport,
    createTransport: vi.fn((options) => createMockTransport(options)),
  }),
  { virtual: true },
);

type EnvSnapshot = Partial<Record<string, string | undefined>>;

const keys: (keyof EnvSnapshot)[] = ['CORE_IPC_HOST', 'CORE_IPC_PORT', 'CORE_IPC_SCHEME'];

const captureEnv = (): EnvSnapshot => {
  const snapshot: EnvSnapshot = {};
  for (const key of keys) {
    snapshot[key] = process.env[key];
  }
  return snapshot;
};

const restoreEnv = (snapshot: EnvSnapshot) => {
  for (const key of keys) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

describe('resolveIpcBaseUrl', () => {
  const snapshot = captureEnv();

  afterEach(() => {
    restoreEnv(snapshot);
    vi.resetModules();
  });

  it('falls back to defaults when env variables are absent', async () => {
    for (const key of keys) {
      delete process.env[key];
    }

    vi.resetModules();
    const module = await import('./transport');
    expect(module.resolveIpcBaseUrl()).toBe('http://127.0.0.1:3333');
  });

  it('honors process env overrides', async () => {
    process.env.CORE_IPC_HOST = '0.0.0.0';
    process.env.CORE_IPC_PORT = '4510';
    process.env.CORE_IPC_SCHEME = 'https';

    vi.resetModules();
    const module = await import('./transport');
    expect(module.resolveIpcBaseUrl()).toBe('https://0.0.0.0:4510');
  });
});
