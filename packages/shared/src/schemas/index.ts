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

// TODO: lean this up later -> nore stricter type checking
// Etc. -> MessageType.SETUP -> command has to be MessageCommand.INFO and payload is null!
export const canvasWebSocketMessageSchema = z.object({
  type: z.enum(["setup", "state", "error"]),
  command: z.enum(["update", "delete", "add", "info", "snapshot"]),
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
]);

export type DocumentSchema = z.infer<typeof documentSchema>;
export type WebSocketMessageSchema = z.infer<typeof webSocketMessageSchema>;
