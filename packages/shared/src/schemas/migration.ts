import { z } from 'zod';

export const migrationModeSchema = z.enum(['auto', 'fwm', 'fwz']);

export const migrationRequestSchema = z.object({
  path: z.string().min(1, 'path is required'),
  mode: migrationModeSchema.default('auto'),
  dryRun: z.boolean().default(false),
  resume: z.string().uuid().optional(),
  limit: z.number().int().positive().optional(),
  since: z.string().datetime().optional(),
  quarantine: z.string().optional(),
});

export const migrationProgressSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  total: z.number().int().nonnegative(),
  processed: z.number().int().nonnegative(),
  imported: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  dryRun: z.boolean(),
  checksumOk: z.boolean(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  currentPath: z.string().optional(),
  notes: z.array(z.string()).default([]),
});

export const migrationErrorRecordSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const migrationReportSchema = z.object({
  jobId: z.string().uuid(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  total: z.number().int().nonnegative(),
  imported: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  dryRun: z.boolean(),
  checksumOk: z.boolean(),
  notes: z.array(z.string()).default([]),
  errors: z.array(migrationErrorRecordSchema).default([]),
});

export type MigrationMode = z.infer<typeof migrationModeSchema>;
export type MigrationRequest = z.infer<typeof migrationRequestSchema>;
export type MigrationProgress = z.infer<typeof migrationProgressSchema>;
export type MigrationReport = z.infer<typeof migrationReportSchema>;
export type MigrationErrorRecord = z.infer<typeof migrationErrorRecordSchema>;
