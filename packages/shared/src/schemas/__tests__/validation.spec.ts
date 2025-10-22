import { describe, expect, it } from 'vitest';
import { messageSchema, reportSchema, x400AddressSchema } from '..';
import { makeAddress, makeMessage, makeReport } from '../../testing';

describe('shared schema validation', () => {
  it('accepts a generated message from the factory', () => {
    const message = makeMessage();
    const parsed = messageSchema.parse(message);

    expect(parsed.envelope.subject).toContain('Modernization');
    expect(parsed.reports.length).toBeGreaterThan(0);
  });

  it('rejects a message without recipients', () => {
    expect(() =>
      messageSchema.parse({
        ...makeMessage(),
        envelope: {
          ...makeMessage().envelope,
          to: []
        }
      })
    ).toThrowError(/Array must contain at least 1 element/);
  });

  it('validates report transitions (delivery then read)', () => {
    const delivery = makeReport({ type: 'delivery' });
    const read = makeReport({
      type: 'read',
      timestamp: new Date(Date.parse(delivery.timestamp) + 60_000).toISOString()
    });

    const parsed = reportSchema.array().parse([delivery, read]);
    expect(parsed[1].type).toBe('read');
  });

  it('rejects reports with unknown type', () => {
    expect(() =>
      reportSchema.parse({
        ...makeReport(),
        type: 'bounce'
      } as any)
    ).toThrowError(/Invalid enum value/);
  });

  it('rejects O/R addresses without country', () => {
    expect(() =>
      x400AddressSchema.parse({
        ...makeAddress(),
        orName: {
          ...makeAddress().orName,
          c: ''
        }
      })
    ).toThrowError(/String must contain at least/);
  });
});
