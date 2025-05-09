import { z } from "zod";

export const documentSchema = z.object({
  state: z.string(),
  id: z.string().optional(),
});

export const documentStateSchema = z.object({
  elements: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      properties: z.record(z.any()),
      children: z.array(z.any()).optional(),
    })
  ),
});

// TODO: instead of z.record(z.any()), make sure to define the properties of the elements (path, shape, etc.)
export const webSocketMessageSchema = z.object({
  type: z.enum(["setup", "state", "error"]),
  method: z.enum(["update", "delete", "add", "info"]),
  payload: z
    .union([
      z.string(),
      z.object({
        id: z.string(),
        type: z.string(),
        properties: z.record(z.any()),
        children: z.array(z.any()).optional(),
      }),
    ])
    .optional(),
});

export type DocumentSchema = z.infer<typeof documentSchema>;
export type DocumentStateSchema = z.infer<typeof documentStateSchema>;
export type WebSocketMessageSchema = z.infer<typeof webSocketMessageSchema>;
