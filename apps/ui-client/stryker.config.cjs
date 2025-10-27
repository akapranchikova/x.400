/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
module.exports = {
  packageManager: 'pnpm',
  reporters: ['progress', 'clear-text', 'html'],
  testRunner: 'command',
  coverageAnalysis: 'off',
  mutate: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.spec.ts?(x)',
    '!src/**/*.test.ts?(x)',
    '!src/**/*.property.test.ts?(x)',
  ],
  commandRunner: {
    command: 'pnpm vitest run',
  },
  thresholds: {
    high: 85,
    low: 75,
    break: 70,
  },
};
