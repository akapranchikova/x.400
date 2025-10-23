import { describe, expect, it } from 'vitest';

import { ENV } from '../src/env';

describe('ENV helper', () => {
  it('provides defaults when env vars are missing', () => {
    expect(ENV.NODE_ENV).toBeDefined();
    expect(ENV.IPC_PORT).toBeGreaterThan(0);
    expect(ENV.X400_MODE === 'mock' || ENV.X400_MODE === 'sdk').toBe(true);
    expect(ENV.IPC_URL).toContain('://');
  });
});
