#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { bold, green, red, yellow } from 'kleur/colors';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

type BundleReport = {
  metadata: unknown;
  telemetry?: {
    messagesSent?: number;
    errors?: number;
    queueDepth?: number;
    averageLatencyMs?: number;
  };
  issues: string[];
};

const readJson = async <T>(zip: JSZip, file: string): Promise<T | null> => {
  const entry = zip.file(file);
  if (!entry) return null;
  const content = await entry.async('string');
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    console.warn(`Unable to parse ${file}:`, error);
    return null;
  }
};

const analyzeBundle = async (bundlePath: string): Promise<BundleReport> => {
  const contents = await fs.readFile(bundlePath);
  const zip = await JSZip.loadAsync(contents);
  const metadata = (await readJson<Record<string, unknown>>(zip, 'metadata.json')) ?? {};
  const snapshot = await readJson<{
    metrics: { messages_sent: number; error_count: number; queue_depth: number };
    average_latency_ms: number;
    last_errors?: string[];
    events?: unknown[];
  }>(zip, 'snapshot.json');
  const trace = await readJson<unknown>(zip, 'trace.json');
  const issues: string[] = [];

  if (!snapshot) {
    issues.push('Snapshot missing from bundle.');
  } else {
    const recentErrors = snapshot.last_errors ?? [];
    const leaking = recentErrors.filter((entry) => EMAIL_PATTERN.test(entry));
    if (leaking.length > 0) {
      issues.push(`Telemetry errors may contain unredacted PII (${leaking.length} entries)`);
    }
  }

  if (trace) {
    const raw = JSON.stringify(trace);
    const matches = raw.match(EMAIL_PATTERN);
    if (matches && matches.length > 0) {
      issues.push(`Trace data contains potential email addresses (${matches.length})`);
    }
  }

  return {
    metadata,
    telemetry: snapshot
      ? {
          messagesSent: snapshot.metrics?.messages_sent ?? 0,
          errors: snapshot.metrics?.error_count ?? 0,
          queueDepth: snapshot.metrics?.queue_depth ?? 0,
          averageLatencyMs: snapshot.average_latency_ms,
        }
      : undefined,
    issues,
  };
};

const formatReport = (report: BundleReport) => {
  console.log(bold('Bundle summary'));
  console.log(JSON.stringify(report.metadata ?? {}, null, 2));

  if (report.telemetry) {
    console.log('\nTelemetry metrics');
    console.log(
      `Messages sent: ${report.telemetry.messagesSent}\nErrors: ${report.telemetry.errors}\nQueue depth: ${report.telemetry.queueDepth}\nAverage latency: ${report.telemetry.averageLatencyMs?.toFixed(2)} ms`,
    );
  }

  if (report.issues.length === 0) {
    console.log(green('\nNo PII issues detected.'));
  } else {
    console.log(red('\nPotential issues detected:'));
    report.issues.forEach((issue) => console.log(` - ${issue}`));
  }
};

yargs(hideBin(process.argv))
  .scriptName('x400-support')
  .command(
    'inspect <bundle>',
    'Inspect a support trace bundle and report potential issues',
    (command) =>
      command
        .positional('bundle', {
          describe: 'Path to the trace bundle (.zip)',
          type: 'string',
        })
        .option('json', {
          describe: 'Output machine-readable JSON',
          type: 'boolean',
          default: false,
        }),
    async (argv) => {
      try {
        const bundlePath = path.resolve(String(argv.bundle));
        const report = await analyzeBundle(bundlePath);
        if (argv.json) {
          console.log(JSON.stringify(report, null, 2));
          return;
        }
        formatReport(report);
        if (report.issues.length > 0) {
          console.log(yellow('\nConsider redacting sensitive fields before sharing externally.'));
        }
      } catch (error) {
        console.error(red(`Failed to analyze bundle: ${(error as Error).message}`));
        process.exitCode = 1;
      }
    },
  )
  .demandCommand(1)
  .help()
  .parse();
