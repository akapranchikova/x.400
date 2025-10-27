import { describe, it, expect } from 'vitest';

import { ZipBuilder } from '../zip';

describe('ZipBuilder', () => {
  it('stores files provided as strings', () => {
    const builder = new ZipBuilder();
    builder.addFile('greeting.txt', 'hello world');
    const buffer = builder.build();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
