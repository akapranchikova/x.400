import { createTransport } from '@x400/sdk-wrapper';

type MetaEnv = {
  [key: string]: string | boolean | undefined;
};

const metaEnv: MetaEnv = ((import.meta as unknown as { env?: MetaEnv }).env ?? {}) as MetaEnv;

const parseBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return null;
};

const readEnvValue = (browserKey: string, processKey: string, fallback: string) => {
  const browserValue = metaEnv[browserKey];
  if (typeof browserValue === 'string' && browserValue.trim().length > 0) {
    return browserValue;
  }

  if (typeof process !== 'undefined') {
    const processValue = process.env?.[processKey];
    if (processValue && processValue.trim().length > 0) {
      return processValue;
    }
  }

  return fallback;
};

export const resolveIpcBaseUrl = () => {
  const scheme = readEnvValue('VITE_CORE_IPC_SCHEME', 'CORE_IPC_SCHEME', 'http');
  const host = readEnvValue('VITE_CORE_IPC_HOST', 'CORE_IPC_HOST', '127.0.0.1');
  const port = readEnvValue('VITE_CORE_IPC_PORT', 'CORE_IPC_PORT', '3333');
  return `${scheme}://${host}:${port}`;
};

export const resolveInlineExecution = () => {
  const candidates: (string | boolean | undefined)[] = [
    metaEnv.VITE_INLINE_EXECUTION,
    typeof process !== 'undefined' ? process.env?.VITE_INLINE_EXECUTION : undefined,
    typeof process !== 'undefined' ? process.env?.INLINE_EXECUTION : undefined,
  ];

  for (const candidate of candidates) {
    const parsed = parseBoolean(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return true;
};

const buildTransport = () =>
  createTransport({
    baseUrl: resolveIpcBaseUrl(),
    inlineExecution: resolveInlineExecution(),
  });

let transportInstance = buildTransport();

export const getTransport = () => transportInstance;

export const reconnectTransport = async () => {
  transportInstance = buildTransport();
  await transportInstance.connect();
  return transportInstance;
};

export const __testing = {
  parseBoolean,
  readEnvValue,
};
