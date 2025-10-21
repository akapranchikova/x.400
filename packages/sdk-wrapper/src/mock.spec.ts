import { describe, expect, it } from 'vitest';
import { createMockTransport } from './mock';

// These tests rely on the mock core-service returning deterministic data during development.
describe('createMockTransport', () => {
  it('creates a transport that can generate a session locally', async () => {
    const transport = createMockTransport({ baseUrl: 'http://localhost:7878' });
    const session = await transport.connect();

    expect(session.sessionId).toBeDefined();
    expect(session.peer).toContain('http://localhost:7878');
  });
});
