import { z } from 'zod';

export const directoryEntrySchema = z.object({
  id: z.string(),
  displayName: z.string(),
  rfc822: z.string().email(),
  orAddress: z.string(),
  attributes: z.record(z.string()).default({}),
});

export const directorySearchResponseSchema = z.object({
  query: z.string(),
  entries: z.array(directoryEntrySchema),
});

export const distributionListSchema = z.object({
  id: z.string(),
  name: z.string(),
  members: z.array(z.string()),
});

export type DirectoryEntry = z.infer<typeof directoryEntrySchema>;
export type DistributionList = z.infer<typeof distributionListSchema>;
