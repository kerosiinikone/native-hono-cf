import { PROTO } from "@/constants";
import { useDocumentStore } from "@/state/document";
import {
  ErrorMessage,
  MessageCommand,
  MessageType,
  webSocketMessageSchema,
  WSMessage,
} from "@native-hono-cf/shared";
import { useCallback, useEffect, useRef } from "react";

interface UseWebSocketOptions {
  documentId: string | null;
  onError?: (error: Event) => void;
}

// Since the two sides employ different buffering logics, the WS hook is kept
// "simple" and does not buffer messages
export function useWebSocket({ documentId, onError }: UseWebSocketOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const receiveRemoteMessage = useDocumentStore(
    (state) => state.receiveRemoteMessage
  );

  const sendWithoutBuffer = useCallback(
    (msg: WSMessage) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(JSON.stringify(msg));
        } catch (e) {
          console.error("Error sending message without buffer:", e, msg);
        }
      }
    },
    [documentId]
  );

  useEffect(() => {
    const ws = new WebSocket(`ws://${PROTO.SERVER_URL}/api/ws/${documentId}`);
    socketRef.current = ws;

    ws.onopen = () => {
      // Establish the connection and request a snapshot
      ws.send(
        JSON.stringify({
          type: MessageType.SETUP,
          command: MessageCommand.INFO,
        } as WSMessage)
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WSMessage;
        const wsMessageValidation = webSocketMessageSchema.safeParse(msg);
        if (!wsMessageValidation.success) {
          console.error(
            "Invalid message schema:",
            wsMessageValidation.error.flatten()
          );
          ws.send(
            JSON.stringify({
              type: MessageType.ERROR,
              command: MessageCommand.INFO,
              payload: {
                message: "Invalid message schema",
              },
            } as ErrorMessage)
          );
          return;
        }
        if (msg.type === MessageType.ERROR) {
          console.error(
            "WebSocket error message received:",
            msg.payload.message
          );
          return;
        }
        receiveRemoteMessage(msg);
      } catch (e) {
        console.warn("Error processing WebSocket message:", e);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      if (onError) onError(error);
    };

    ws.onclose = () => {
      if (socketRef.current === ws) {
        socketRef.current = null;
      }
    };

    return () => {
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
    };
  }, [documentId]);

  return {
    sendWithoutBuffer,
  };
}
