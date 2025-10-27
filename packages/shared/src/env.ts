const processEnv: NodeJS.ProcessEnv =
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? process.env
    : ({} as NodeJS.ProcessEnv);

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const sanitizeMode = (value: string | undefined): 'mock' | 'sdk' => {
  const normalized = (value ?? 'mock').toLowerCase();
  return normalized === 'sdk' ? 'sdk' : 'mock';
};

const IPC_HOST = processEnv.CORE_IPC_HOST ?? '127.0.0.1';
const IPC_PORT = parseNumber(processEnv.CORE_IPC_PORT, 3333);
const IPC_SCHEME = processEnv.CORE_IPC_SCHEME ?? 'http';

export const ENV = {
  NODE_ENV: processEnv.NODE_ENV ?? 'development',
  IPC_HOST,
  IPC_PORT,
  IPC_SCHEME,
  IPC_URL: `${IPC_SCHEME}://${IPC_HOST}:${IPC_PORT}`,
  CORE_DB_PATH: processEnv.CORE_DB_PATH ?? './data/x400.sqlite',
  X400_MODE: sanitizeMode(processEnv.X400_MODE),
  X400_PROFILE: processEnv.X400_PROFILE ?? 'default',
  CLI_DEFAULT_PROFILE: processEnv.CLI_DEFAULT_PROFILE ?? processEnv.X400_PROFILE ?? 'default',
} as const;

export type EnvConfig = typeof ENV;
