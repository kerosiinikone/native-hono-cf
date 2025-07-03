import { z } from "zod";

export const documentSchema = z.object({
  state: z.string(),
  id: z.string().optional(),
});

export const base64Uint8ArrayString = z.string().refine((value) => {
  try {
    const decoded = atob(value);
    return new Uint8Array(decoded.length).every(
      (_, i) => decoded.charCodeAt(i) >= 0
    );
  } catch {
    return false;
  }
});

export const setupMessageSchema = z.object({
  type: z.enum(["setup"]),
  command: z.enum(["info"]),
  payload: z.union([z.null(), z.undefined()]),
});

export const canvasWebSocketMessageSchema = z.object({
  type: z.enum(["state", "error", "setup"]),
  command: z.enum(["update", "delete", "add", "snapshot"]),
  payload: z
    .union([
      z.object({
        message: z.string(),
      }),
      base64Uint8ArrayString, // For state updates
    ])
    .optional(),
});

export const textWebSocketMessageSchema = z.object({
  type: z.enum(["text_state", "error"]),
  command: z.enum(["update", "delete", "add", "info"]),
  // Uint8Array -> base64 string
  payload: z
    .union([
      z.object({
        message: z.string(),
      }),
      base64Uint8ArrayString, // For state updates
    ])
    .optional(),
});

export const webSocketMessageSchema = z.union([
  canvasWebSocketMessageSchema,
  textWebSocketMessageSchema,
  setupMessageSchema,
]);

export type DocumentSchema = z.infer<typeof documentSchema>;
export type WebSocketMessageSchema = z.infer<typeof webSocketMessageSchema>;
export type SetupMessageSchema = z.infer<typeof setupMessageSchema>;
export type CanvasWebSocketMessageSchema = z.infer<
  typeof canvasWebSocketMessageSchema
>;
