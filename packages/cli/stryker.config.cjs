/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
module.exports = {
  packageManager: 'pnpm',
  reporters: ['progress', 'clear-text', 'html'],
  testRunner: 'command',
  coverageAnalysis: 'off',
  mutate: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/**/*.test.ts', '!src/**/*.property.test.ts'],
  commandRunner: {
    command: 'pnpm vitest run',
  },
  thresholds: {
    high: 90,
    low: 85,
    break: 80,
  },
};
