import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const targets = [
  {
    package: 'ui-client',
    displayName: 'apps/ui-client',
    command: ['pnpm', '--filter', 'ui-client', 'run', 'test'],
    threshold: 0.7,
    mutants: [
      {
        file: 'apps/ui-client/src/lib/transport.ts',
        description: 'parseBoolean truthy branch',
        search: "if (['1', 'true', 'yes', 'on'].includes(normalized)) {\n    return true;\n  }",
        replace: "if (['1', 'true', 'yes', 'on'].includes(normalized)) {\n    return false;\n  }",
      },
    ],
  },
  {
    package: '@x400/shared',
    displayName: 'packages/shared',
    command: ['pnpm', '--filter', '@x400/shared', 'run', 'test'],
    threshold: 0.8,
    mutants: [
      {
        file: 'packages/shared/src/utils/zip.ts',
        description: 'string input handling',
        search: "  if (typeof input === 'string') {\n    return textEncoder.encode(input);\n  }",
        replace: "  if (typeof input === 'string') {\n    return new Uint8Array();\n  }",
      },
    ],
  },
  {
    package: '@x400/cli',
    displayName: 'packages/cli',
    command: ['pnpm', '--filter', '@x400/cli', 'run', 'test'],
    threshold: 0.8,
    mutants: [
      {
        file: 'packages/cli/src/utils.ts',
        description: 'default country fallback',
        search: "      c: components.c ?? 'XX',",
        replace: "      c: components.c ?? 'ZZ',",
      },
    ],
  },
  {
    package: '@x400/sdk-wrapper',
    displayName: 'packages/sdk-wrapper',
    command: ['pnpm', '--filter', '@x400/sdk-wrapper', 'run', 'test'],
    threshold: 0.8,
    mutants: [
      {
        file: 'packages/sdk-wrapper/src/mock.ts',
        description: 'transport mode detection',
        search:
          "    (payload?.transport_mode ?? payload?.transportMode ?? 'mock') === 'sdk' ? 'sdk' : 'mock',",
        replace:
          "    (payload?.transport_mode ?? payload?.transportMode ?? 'mock') === 'sdk' ? 'mock' : 'mock',",
      },
    ],
  },
];

const results = [];

for (const target of targets) {
  let killed = 0;
  for (const mutant of target.mutants) {
    const filePath = path.resolve(root, mutant.file);
    const original = readFileSync(filePath, 'utf8');
    if (!original.includes(mutant.search)) {
      throw new Error(`Search string not found for mutant: ${mutant.description}`);
    }
    const mutated = original.replace(mutant.search, mutant.replace);
    if (mutated === original) {
      throw new Error(`Mutation did not change file: ${mutant.description}`);
    }
    writeFileSync(filePath, mutated, 'utf8');
    console.log(`→ Running mutant for ${target.displayName}: ${mutant.description}`);
    const run = spawnSync(target.command[0], target.command.slice(1), {
      stdio: 'inherit',
      cwd: root,
      env: { ...process.env, MUTATION_UNDER_TEST: mutant.description },
    });
    writeFileSync(filePath, original, 'utf8');
    if (run.status !== 0) {
      killed += 1;
      console.log(`✓ Mutant killed for ${target.displayName}`);
    } else {
      console.log(`✗ Mutant survived for ${target.displayName}`);
    }
  }
  const score = target.mutants.length === 0 ? 1 : killed / target.mutants.length;
  const passed = score >= target.threshold;
  results.push({
    name: target.displayName,
    killed,
    total: target.mutants.length,
    score,
    passed,
    threshold: target.threshold,
  });
}

let hasFailure = false;
for (const result of results) {
  const percent = (result.score * 100).toFixed(1);
  const status = result.passed ? 'PASS' : 'FAIL';
  if (!result.passed) {
    hasFailure = true;
  }
  console.log(
    `${status} ${result.name}: ${result.killed}/${result.total} mutants killed (${percent}% >= ${(result.threshold * 100).toFixed(0)}%)`,
  );
}

if (hasFailure) {
  process.exit(1);
}
