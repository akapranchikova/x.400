import { describe, expect, it } from 'vitest';

import { calculateSha256, normalizeFsPath } from '../src/utils';

describe('shared utils', () => {
  it('calculates sha256 checksums deterministically', () => {
    expect(calculateSha256('legacy')).toBe(
      'c49fea7425fa7f8699897a97c159c6690267d9003bb78c53fafa8fc15c325d84',
    );
  });

  it('normalizes filesystem paths across platforms', () => {
    expect(normalizeFsPath('var\\data\\legacy')).toBe('var/data/legacy');
    expect(normalizeFsPath('var/data/legacy')).toBe('var/data/legacy');
  });
});
