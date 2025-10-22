import { z } from 'zod';

import { x400AddressSchema } from './addresses';
import { folderIdSchema } from './folders';
import { reportSchema } from './reports';

export const messageStatusSchema = z.enum([
  'draft',
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
]);

export const attachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
});

export const messageEnvelopeSchema = z.object({
  id: z.string(),
  subject: z.string(),
  sender: x400AddressSchema,
  to: z.array(x400AddressSchema),
  cc: z.array(x400AddressSchema).default([]),
  bcc: z.array(x400AddressSchema).default([]),
  priority: z.enum(['normal', 'nonUrgent', 'urgent']).default('normal'),
  sensitivity: z.enum(['normal', 'personal', 'private', 'confidential']).default('normal'),
  folder: folderIdSchema,
  status: messageStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  messageId: z.string(),
});

export const messageContentSchema = z.object({
  text: z.string().default(''),
  attachments: z.array(attachmentSchema),
});

export const messageSchema = z.object({
  envelope: messageEnvelopeSchema,
  content: messageContentSchema,
  reports: z.array(reportSchema),
});

export type MessageStatus = z.infer<typeof messageStatusSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type MessageEnvelope = z.infer<typeof messageEnvelopeSchema>;
export type MessageContent = z.infer<typeof messageContentSchema>;
export type Message = z.infer<typeof messageSchema>;
