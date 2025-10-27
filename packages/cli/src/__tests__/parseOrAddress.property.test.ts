import { describe, it, expect } from 'vitest';

import { arb } from '@x400/shared/testing';
import type { X400Address } from '@x400/shared';
import { parseOrAddress } from '../utils';

const toOrString = (address: X400Address) => {
  const { orName } = address;
  const parts: string[] = [];
  const push = (key: string, value?: string) => {
    if (!value) return;
    parts.push(`${key}=${value}`);
  };

  push('C', orName.c);
  push('ADMD', orName.admd);
  push('PRMD', orName.prmd);
  push('O', orName.o);
  orName.ou.forEach((value, index) => push(`OU${index + 1}`, value));
  push('S', orName.surname);
  push('G', orName.givenName);

  return parts.join(';');
};

describe('parseOrAddress property-based invariants', () => {
  it('preserves populated components from arbitrary addresses', () => {
    const generator = arb.createAddressGenerator(77);
    for (let run = 0; run < 150; run += 1) {
      const address = generator.nextAddress();
      const raw = toOrString(address);
      const parsed = parseOrAddress(raw);
      expect(parsed.orName.c).toBe(address.orName.c ?? 'XX');
      expect(parsed.orName.surname).toBe(address.orName.surname);
      expect(parsed.orName.givenName).toBe(address.orName.givenName);
      expect(parsed.orName.ou).toStrictEqual(address.orName.ou);
    }
  });

  it('defaults missing country to XX and strips whitespace', () => {
    const generator = arb.createAddressGenerator(11);
    for (let run = 0; run < 150; run += 1) {
      const address = generator.nextAddress();
      const rawWithoutCountry = toOrString(address)
        .split(';')
        .filter((segment) => !segment.startsWith('C='))
        .join(';');
      const padded = rawWithoutCountry.replace(/=/g, '= ');
      const parsed = parseOrAddress(padded);
      expect(parsed.orName.c).toBe('XX');
      parsed.orName.ou.forEach((ou) => expect(ou).toBe(ou.trim()));
    }
  });
});
