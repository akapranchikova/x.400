import { describe, expect, it } from 'vitest';

import { parseOrAddress } from './utils';

describe('parseOrAddress', () => {
  it('parses an address string into an O/R address object', () => {
    const address = parseOrAddress('C=DE;O=Modernization;S=Tester');
    expect(address.orName.c).toBe('DE');
    expect(address.orName.o).toBe('Modernization');
    expect(address.orName.surname).toBe('Tester');
  });
});
