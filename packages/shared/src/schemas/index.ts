import { z } from "zod";

export const documentSchema = z.object({
  state: z.string(),
  id: z.string().optional(),
});

// TODO: instead of z.record(z.any()), make sure to define the properties of the elements (path, shape, etc.)
export const documentStateSchema = z.object({
  id: z.string(),
  type: z.string(),
  properties: z.record(z.any()),
});

export const webSocketMessageSchema = z.object({
  type: z.enum(["setup", "state", "error"]),
  command: z.enum(["update", "delete", "add", "info"]),
  payload: z
    .union([
      z.object({
        message: z.string(),
      }),
      z.union([z.array(documentStateSchema), documentStateSchema]),
      z.object({
        elementIds: z.array(z.string()),
      }),
    ])
    .optional(),
});

export type DocumentSchema = z.infer<typeof documentSchema>;
export type DocumentStateSchema = z.infer<typeof documentStateSchema>;
export type WebSocketMessageSchema = z.infer<typeof webSocketMessageSchema>;
