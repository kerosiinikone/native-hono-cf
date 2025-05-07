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

export const webSocketMessageSchema = z.object({
  type: z.enum(["setup", "state", "error"]),
  senderId: z.string().optional(),
  payload: z.union([z.string(), documentStateSchema]).optional(),
});

export type DocumentSchema = z.infer<typeof documentSchema>;
export type DocumentStateSchema = z.infer<typeof documentStateSchema>;
export type WebSocketMessageSchema = z.infer<typeof webSocketMessageSchema>;
