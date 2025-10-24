import { createTransport } from '@x400/sdk-wrapper';

type MetaEnv = {
  [key: string]: string | boolean | undefined;
};

const metaEnv: MetaEnv = ((import.meta as unknown as { env?: MetaEnv }).env ?? {}) as MetaEnv;

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

let transportInstance = createTransport({ baseUrl: resolveIpcBaseUrl() });

export const getTransport = () => transportInstance;

export const reconnectTransport = async () => {
  transportInstance = createTransport({ baseUrl: resolveIpcBaseUrl() });
  await transportInstance.connect();
  return transportInstance;
};
