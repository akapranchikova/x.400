import { z } from 'zod';

export const folderIdSchema = z.enum(['inbox', 'outbox', 'failed', 'archive', 'followUp']);

export const folderSchema = z.object({
  id: folderIdSchema,
  name: z.string(),
  unreadCount: z.number().int().nonnegative()
});

export const folderListSchema = z.array(folderSchema);

export type FolderId = z.infer<typeof folderIdSchema>;
export type Folder = z.infer<typeof folderSchema>;
