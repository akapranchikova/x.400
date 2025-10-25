import { createMockTransport } from './mock';

import type { IX400Transport, TransportFactory, TransportOptions } from './interfaces';

const DEFAULT_RETRIES = 2;
const DEFAULT_DELAY_MS = 250;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(
  factory: () => Promise<T>,
  retries: number,
  delayMs: number,
): Promise<T> => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      return await factory();
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      await sleep(delayMs * Math.max(1, attempt + 1));
      attempt += 1;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('SDK transport failed after retries');
};

const wrap = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  retries: number,
  delayMs: number,
) => {
  return (...args: TArgs) => withRetry(() => fn(...args), retries, delayMs);
};

export const createSdkTransport: TransportFactory = (options: TransportOptions = {}) => {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const delayMs = DEFAULT_DELAY_MS;
  const base = createMockTransport({ ...options, timeoutMs: options.timeoutMs ?? 15_000 });

  const wrapped: IX400Transport = {
    connect: async () => {
      const session = await base.connect();
      return {
        ...session,
        peer: `${session.peer} (sdk)`,
      };
    },
    folders: {
      listFolders: wrap(base.folders.listFolders, retries, delayMs),
    },
    messages: {
      listMessages: wrap(base.messages.listMessages, retries, delayMs),
      getMessage: wrap(base.messages.getMessage, retries, delayMs),
      submitMessage: wrap(base.messages.submitMessage, retries, delayMs),
      deleteMessage: wrap(base.messages.deleteMessage, retries, delayMs),
      moveMessage: wrap(base.messages.moveMessage, retries, delayMs),
      archiveMessage: wrap(base.messages.archiveMessage, retries, delayMs),
    },
    trace: {
      bundle: wrap(base.trace.bundle, retries, delayMs),
    },
    migration: {
      import: wrap(base.migration.import, retries, delayMs),
      progress: wrap(base.migration.progress, retries, delayMs),
      report: wrap(base.migration.report, retries, delayMs),
    },
    gateway: {
      send: wrap(base.gateway.send, retries, delayMs),
      peekInbound: wrap(base.gateway.peekInbound, retries, delayMs),
      acknowledge: wrap(base.gateway.acknowledge, retries, delayMs),
      preview: wrap(base.gateway.preview, retries, delayMs),
    },
    directory: {
      search: wrap(base.directory.search, retries, delayMs),
      getEntry: wrap(base.directory.getEntry, retries, delayMs),
      getDistributionList: wrap(base.directory.getDistributionList, retries, delayMs),
    },
    compose: wrap(base.compose, retries, delayMs),
    status: wrap(base.status, retries, delayMs),
  };

  return wrapped;
};

export type SdkTransport = ReturnType<typeof createSdkTransport>;
