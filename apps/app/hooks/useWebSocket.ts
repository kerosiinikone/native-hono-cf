import { SERVER_URL } from "@/constants/server";
import { useDocumentStore } from "@/state/document";
import {
  MessageCommand,
  MessageType,
  TextDocumentStateUpdate,
  WSMessage,
} from "@native-hono-cf/shared";
import { useCallback, useEffect, useRef } from "react";

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

  const bufferMessage = useCallback(
    (msg: WSMessage) => {
      if (sendBufferIntervalRef.current == null) {
        sendBufferIntervalRef.current = setInterval(
          sendBufferedMessages,
          BUFFER_INTERVAL
        );
      }

      // TODO: Improve this logic later
      const lastMsg =
        queuedWSMessages.current[queuedWSMessages.current.length - 1];
      const isBatchable =
        lastMsg?.type === MessageType.TEXT_STATE &&
        msg.type === MessageType.TEXT_STATE &&
        lastMsg.command === MessageCommand.ADD &&
        msg.command === MessageCommand.ADD;

      if (isBatchable) {
        // merge the new message

        // these types...
        const lastMessage = queuedWSMessages.current.pop();
        if (lastMessage) {
          const pl = lastMessage.payload as { state: TextDocumentStateUpdate };
          (lastMessage.payload as { state: TextDocumentStateUpdate }) = {
            ...lastMessage.payload,
            state: {
              ...(msg.payload as { state: TextDocumentStateUpdate }).state,
              heading:
                pl.state.heading +
                ((msg.payload as { state: TextDocumentStateUpdate }).state
                  .heading || ""),
              text:
                pl.state.text +
                ((msg.payload as { state: TextDocumentStateUpdate }).state
                  .text || ""),
            },
          };
          msg = lastMessage; // Use the merged message
        }
      }
      queuedWSMessages.current.push(msg);
    },
    [documentId]
  );

  return {
    bufferMessage,
  };
}
