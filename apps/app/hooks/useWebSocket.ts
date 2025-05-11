import { SERVER_URL } from "@/constants/server";
import {
  DocumentStateUpdate,
  Element,
  MessageCommand,
  MessageType,
  WSMessage,
} from "@native-hono-cf/shared";
import { useCallback, useEffect, useRef } from "react";

const BUFFER_INTERVAL = 250;

interface UseWebSocketOptions {
  documentId: string | null;
  onStateReceived: (
    state:
      | DocumentStateUpdate
      | {
          elementIds: string[];
        },
    command: MessageCommand
  ) => void;
  onError?: (error: Event) => void;
}

// TODO: Make sure this logic runs on the JS side
// and does not interfere with the Skia thread to minize
// performance issues when there are many messa
// and path elements

export function useWebSocket({
  documentId,
  onStateReceived,
  onError,
}: UseWebSocketOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const bufferedMessages = useRef<WSMessage[]>([]);
  const sendBufferIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const sendBufferedMessages = useCallback(() => {
    if (
      socketRef.current?.readyState === WebSocket.OPEN &&
      bufferedMessages.current.length > 0
    ) {
      const messageToSend = bufferedMessages.current.pop();
      if (messageToSend) {
        try {
          socketRef.current.send(JSON.stringify(messageToSend));
        } catch (e) {
          console.error("Error sending buffered message:", e, messageToSend);
        }
      }
      if (
        bufferedMessages.current.length === 0 &&
        sendBufferIntervalRef.current
      ) {
        clearInterval(sendBufferIntervalRef.current);
        sendBufferIntervalRef.current = null;
      }
      bufferedMessages.current = [];
    }
  }, [documentId]);

  useEffect(() => {
    const ws = new WebSocket(`ws://${SERVER_URL}/api/ws/${documentId}`);
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: MessageType.SETUP,
          command: MessageCommand.INFO,
        } as WSMessage)
      );

      sendBufferIntervalRef.current = setInterval(
        sendBufferedMessages,
        BUFFER_INTERVAL
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as WSMessage;

        if (data.type === MessageType.STATE && data.payload) {
          // Relay for now
          onStateReceived(data.payload, data.command);
        }
      } catch (e) {
        console.warn("Error processing WebSocket message:", e);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      if (onError) onError(error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      if (socketRef.current === ws) {
        socketRef.current = null;
      }
      if (sendBufferIntervalRef.current) {
        clearInterval(sendBufferIntervalRef.current);
        sendBufferIntervalRef.current = null;
      }
    };

    return () => {
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
      if (sendBufferIntervalRef.current) {
        clearInterval(sendBufferIntervalRef.current);
        sendBufferIntervalRef.current = null;
      }
    };
  }, [documentId]);

  return {
    bufferMessage: useCallback(
      (msg: WSMessage) => {
        if (sendBufferIntervalRef.current == null) {
          sendBufferIntervalRef.current = setInterval(
            sendBufferedMessages,
            BUFFER_INTERVAL
          );
        }
        bufferedMessages.current.push(msg);
      },
      [documentId]
    ),
  };
}
