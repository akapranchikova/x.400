import { describe, it, expect } from 'vitest';

import { __testing } from './transport';

describe('transport environment utilities (property-based)', () => {
  it('recognizes common boolean synonyms', () => {
    const truthy = ['1', 'true', 'TRUE', 'Yes', 'ON', true];
    const falsy = ['0', 'false', 'False', 'no', 'OFF', false];

    for (const value of truthy) {
      expect(__testing.parseBoolean(value)).toBe(true);
    }

    for (const value of falsy) {
      expect(__testing.parseBoolean(value)).toBe(false);
    }
  });

  it('returns null for unrecognized values', () => {
    const disallowed = new Set(['1', '0', 'true', 'false', 'yes', 'no', 'on', 'off']);
    for (let index = 0; index < 100; index += 1) {
      const value = Math.random().toString(36).slice(2, 10);
      if (disallowed.has(value.toLowerCase())) {
        continue;
      }
      expect(__testing.parseBoolean(value)).toBeNull();
    }
  });
});
