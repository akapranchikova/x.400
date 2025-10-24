import { createMockTransport } from './mock';
import { createSdkTransport } from './sdk';

import type { TransportFactory, TransportOptions } from './interfaces';

export * from './interfaces';
export * from './mock';
export * from './sdk';

const normalizeMode = (value: string | undefined): 'mock' | 'sdk' => {
  return value?.toLowerCase() === 'sdk' ? 'sdk' : 'mock';
};

const resolveEnvMode = (): 'mock' | 'sdk' => {
  if (typeof process !== 'undefined' && process.env) {
    return normalizeMode(process.env.X400_MODE);
  }
  if (typeof window !== 'undefined') {
    const browserValue = (window as typeof window & { X400_MODE?: string }).X400_MODE;
    return normalizeMode(browserValue);
  }
  return 'mock';
};

export const createTransport: TransportFactory = (options: TransportOptions = {}) => {
  const mode = options.mode ?? resolveEnvMode();
  if (mode === 'sdk') {
    return createSdkTransport({ ...options, mode });
  }
  return createMockTransport({ ...options, mode: 'mock' });
};
