import { describe, it, expect } from 'vitest';

import { arb } from '../../testing';
import { x400AddressSchema } from '../addresses';

const sanitize = (value: string | undefined) => value?.trim() ?? undefined;

describe('x400AddressSchema property invariants', () => {
  it('accepts arbitrary X.400 addresses generated from shared arbitraries', () => {
    const generator = arb.createAddressGenerator(42);
    for (let run = 0; run < 200; run += 1) {
      const address = generator.nextAddress();
      const parsed = x400AddressSchema.parse(address);
      expect(parsed).toEqual(address);
    }
  });

  it('round-trips O/R address strings through schema validation', () => {
    const generator = arb.createAddressGenerator(123);
    for (let run = 0; run < 200; run += 1) {
      const value = generator.nextOrAddressString();
      const tokens = value.split(';');
      const record: Record<string, string> = {};
      for (const token of tokens) {
        if (!token.includes('=')) continue;
        const [key, raw] = token.split('=');
        record[key.toUpperCase()] = raw.trim();
      }
      const parsed = x400AddressSchema.parse({
        orName: {
          c: sanitize(record.C) ?? 'XX',
          admd: sanitize(record.ADMD),
          prmd: sanitize(record.PRMD),
          o: sanitize(record.O),
          ou: Object.entries(record)
            .filter(([key]) => key.startsWith('OU'))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, val]) => val),
          surname: sanitize(record.S),
          givenName: sanitize(record.G),
        },
        dda: [],
        routingHints: [],
      });

      expect(parsed.orName.c).not.toHaveLength(0);
    }
  });
});
