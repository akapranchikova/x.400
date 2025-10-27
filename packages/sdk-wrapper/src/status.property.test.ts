import nock from 'nock';
import { afterEach, describe, it, expect } from 'vitest';

import { createMockTransport } from './mock';

const BASE_URL = 'http://property-core';

describe('createMockTransport status normalization (property-based)', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('normalizes arbitrary TLS payloads safely', async () => {
    const choices = <T>(values: T[]): T => values[Math.floor(Math.random() * values.length)];

    for (let run = 0; run < 100; run += 1) {
      const payload: Record<string, unknown> = {
        transport_mode: Math.random() < 0.5 ? choices(['sdk', 'mock', 'hybrid']) : undefined,
        smime_enabled: Math.random() < 0.5 ? Math.random() < 0.5 : undefined,
      };

      if (Math.random() < 0.9) {
        payload.tls = {
          enabled: Math.random() < 0.5 ? Math.random() < 0.5 : undefined,
          min_version: Math.random() < 0.5 ? 'TLS1_2' : undefined,
          fingerprint: Math.random().toString(16).slice(2),
          fingerprint_matches: Math.random() < 0.5,
          fingerprintMatches: Math.random() < 0.5,
          expires_at: new Date().toISOString(),
          warnings: Math.random() < 0.5 ? ['cert-warning'] : [],
        };
      }

      nock(BASE_URL).get('/status').reply(200, payload);

      const transport = createMockTransport({ baseUrl: BASE_URL });
      const status = await transport.status();

      expect(['sdk', 'mock']).toContain(status.transportMode);
      expect(typeof status.tls.enabled).toBe('boolean');
      expect(Array.isArray(status.tls.warnings)).toBe(true);
      nock.cleanAll();
    }
  });
});
