import { describe, expect, it } from 'vitest';

// Basic smoke test to ensure the support-tool test suite executes under CI.
describe('support-tool test harness', () => {
  it('executes a trivial assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
