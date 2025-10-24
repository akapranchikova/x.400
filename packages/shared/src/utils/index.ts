import { createHash } from 'crypto';

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60 * 1000);

export const assertUnreachable = (_value: never, message = 'Reached unreachable code'): never => {
  throw new Error(message);
};

export const calculateSha256 = (payload: string | Buffer): string => {
  const buffer = typeof payload === 'string' ? Buffer.from(payload) : payload;
  return createHash('sha256').update(buffer).digest('hex');
};

export const normalizeFsPath = (input: string): string =>
  input.replace(/\\+/g, '/').replace(/\/{2,}/g, '/');
