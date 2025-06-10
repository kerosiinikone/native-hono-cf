import { SERVER_URL } from "@/constants/server";
import { useDocumentStore } from "@/state/document";
import { MessageCommand, MessageType, WSMessage } from "@native-hono-cf/shared";
import { useCallback, useEffect, useRef, useState } from "react";

const BUFFER_INTERVAL = 250;

interface UseWebSocketOptions {
  documentId: string | null;
  onError?: (error: Event) => void;
}

// TODO: Make sure this logic runs on the JS side
// and does not interfere with the Skia thread to minize
// performance issues when there are many messa
// and path elements

export function useWebSocket({ documentId, onError }: UseWebSocketOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const queuedWSMessages = useRef<WSMessage[]>([]);
  const pushMessageToQueue = useDocumentStore(
    (state) => state.pushMessageToQueue
  );
  const sendBufferIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const sendBufferedMessages = useCallback(() => {
    if (
      socketRef.current?.readyState === WebSocket.OPEN &&
      queuedWSMessages.current.length > 0
    ) {
      const messageToSend = queuedWSMessages.current.pop();
      if (messageToSend) {
        try {
          socketRef.current.send(JSON.stringify(messageToSend));
        } catch (e) {
          console.error("Error sending buffered message:", e, messageToSend);
        }
      }
      if (
        queuedWSMessages.current.length === 0 &&
        sendBufferIntervalRef.current
      ) {
        clearInterval(sendBufferIntervalRef.current);
        sendBufferIntervalRef.current = null;
      }
      queuedWSMessages.current = [];
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
        pushMessageToQueue(JSON.parse(event.data as string));
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
        console.log("Closing WebSocket connection");
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
        queuedWSMessages.current.push(msg);
      },
      [documentId]
    ),
  };
}
