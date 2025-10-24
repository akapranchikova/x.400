import { describe, expect, it } from 'vitest';

import { randomUUID } from 'crypto';

import {
  messageSchema,
  migrationProgressSchema,
  migrationReportSchema,
  migrationRequestSchema,
  reportSchema,
  x400AddressSchema,
} from '..';
import { makeAddress, makeMessage, makeReport } from '../../testing';

describe('shared schema validation', () => {
  it('accepts a generated message from the factory', () => {
    const message = makeMessage();
    const parsed = messageSchema.parse(message);

    expect(parsed.envelope.subject).toContain('Modernization');
    expect(parsed.reports.length).toBeGreaterThan(0);
  });

  it('rejects a message without recipients', () => {
    expect(() =>
      messageSchema.parse({
        ...makeMessage(),
        envelope: {
          ...makeMessage().envelope,
          to: [],
        },
      }),
    ).toThrowError(/At least one recipient is required/);
  });

  it('validates report transitions (delivery then read)', () => {
    const delivery = makeReport({ type: 'delivery' });
    const read = makeReport({
      type: 'read',
      timestamp: new Date(Date.parse(delivery.timestamp) + 60_000).toISOString(),
    });

    const parsed = reportSchema.array().parse([delivery, read]);
    expect(parsed[1].type).toBe('read');
  });

  it('rejects reports with unknown type', () => {
    expect(() =>
      reportSchema.parse({
        ...makeReport(),
        type: 'bounce',
      } as any),
    ).toThrowError(/Invalid enum value/);
  });

  it('rejects O/R addresses without country', () => {
    const result = x400AddressSchema.safeParse({
      ...makeAddress(),
      orName: {
        ...makeAddress().orName,
        c: '',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'too_small',
          path: ['orName', 'c'],
          message: expect.stringMatching(/Country is required/),
        }),
      ]),
    );
  });

  it('validates migration request and report payloads', () => {
    const request = migrationRequestSchema.parse({
      path: '/data/legacy',
      dryRun: true,
      limit: 10,
    });

    expect(request.mode).toBe('auto');
    expect(request.dryRun).toBe(true);

    const progress = migrationProgressSchema.parse({
      jobId: randomUUID(),
      status: 'running',
      total: 10,
      processed: 3,
      imported: 3,
      failed: 0,
      duplicates: 0,
      dryRun: true,
      checksumOk: true,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      notes: [],
    });

    expect(progress.processed).toBe(3);

    const report = migrationReportSchema.parse({
      jobId: progress.jobId,
      startedAt: progress.startedAt,
      finishedAt: new Date().toISOString(),
      total: progress.total,
      imported: progress.imported,
      failed: progress.failed,
      duplicates: progress.duplicates,
      dryRun: progress.dryRun,
      checksumOk: true,
      notes: ['dry-run'],
      errors: [],
    });

    expect(report.notes).toContain('dry-run');
  });
});
