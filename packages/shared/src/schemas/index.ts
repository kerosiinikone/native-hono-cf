import { z } from "zod";

export const documentSchema = z.object({
  state: z.string(),
  id: z.string().optional(),
});

export type DocumentSchema = z.infer<typeof documentSchema>;
