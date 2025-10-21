import { z } from 'zod';

export const orNameSchema = z.object({
  c: z.string().min(1, 'Country is required'),
  admd: z.string().optional(),
  prmd: z.string().optional(),
  o: z.string().optional(),
  ou: z.array(z.string()).default([]),
  surname: z.string().optional(),
  givenName: z.string().optional(),
  initials: z.string().optional(),
  generationQualifier: z.string().optional()
});

export const x400AddressSchema = z.object({
  orName: orNameSchema,
  dda: z
    .array(
      z.object({
        type: z.string(),
        value: z.string()
      })
    )
    .default([]),
  routingHints: z.array(z.string()).default([])
});

export type OrName = z.infer<typeof orNameSchema>;
export type X400Address = z.infer<typeof x400AddressSchema>;
