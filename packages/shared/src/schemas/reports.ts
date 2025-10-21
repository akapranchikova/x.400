import { z } from 'zod';
import { x400AddressSchema } from './addresses';

export const reportTypeSchema = z.enum(['delivery', 'nonDelivery', 'read']);

export const reportSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  type: reportTypeSchema,
  timestamp: z.string(),
  recipient: x400AddressSchema,
  diagnosticCode: z.string().optional(),
  supplementalInfo: z.string().optional()
});

export type ReportType = z.infer<typeof reportTypeSchema>;
export type Report = z.infer<typeof reportSchema>;
