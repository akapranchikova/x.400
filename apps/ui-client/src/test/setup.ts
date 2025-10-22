import '@testing-library/jest-dom/vitest';

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Чистим DOM после каждого теста
afterEach(() => {
  cleanup();
});
