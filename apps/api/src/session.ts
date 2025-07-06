import { mergeMessages } from "@collabs/collabs";
import {
  base64ToUint8Array,
  ErrorMessage,
  MessageCommand,
  MessageType,
  StateUpdateMessage,
  uint8ArrayToBase64,
  webSocketMessageSchema,
  WebSocketMessageSchema,
  WSMessage,
} from "@native-hono-cf/shared";
import { D1Storage, DocumentObjectModel, DocumentStorage } from "./persistence";
import { debounce } from "./util";

const DEBOUNCE = 5000;

export class DocumentSession {
  // Kept for state since Collabs docs cannot be used in this runtime environment
  private textDocBufferState: Uint8Array<ArrayBufferLike> = new Uint8Array();
  private latestCanvasSnapshot: Uint8Array<ArrayBufferLike> = new Uint8Array();

  private clientMap: Map<WebSocket, string> = new Map();
  private durableObjectStorage: DocumentStorage;
  private d1Storage?: D1Storage;
  private debouncedStore: () => void;

  constructor(
    durableObjectStorage: DocumentStorage,
    d1Persistence?: D1Storage,
    private persistenceDebounceTime: number = DEBOUNCE
  ) {
    this.durableObjectStorage = durableObjectStorage;
    this.d1Storage = d1Persistence;

    this.debouncedStore = debounce(
      this.forceStore.bind(this),
      this.persistenceDebounceTime
    );
  }

  async initialize(initialD1State?: DocumentObjectModel | null): Promise<void> {
    let loadedState = await this.durableObjectStorage.getState();
    if (!loadedState && initialD1State) {
      loadedState = initialD1State;
    }

    if (loadedState?.textDocLogBuffer) {
      const bytes = base64ToUint8Array(loadedState.textDocLogBuffer);
      this.textDocBufferState =
        bytes.length > 0 ? bytes : this.textDocBufferState;
    }
    if (loadedState?.latestCanvasSnapshot) {
      const bytes = base64ToUint8Array(loadedState.latestCanvasSnapshot);
      this.latestCanvasSnapshot =
        bytes.length > 0 ? bytes : this.latestCanvasSnapshot;
    }

    await this.storeState();
  }

  addClient(ws: WebSocket): string {
    const clientId = crypto.randomUUID();
    this.clientMap.set(ws, clientId);
    return clientId;
  }

  removeClient(ws: WebSocket): void {
    const clientId = this.clientMap.get(ws);
    if (clientId) {
      this.clientMap.delete(ws);
    }
  }

  handleMessage(ws: WebSocket, message: ArrayBuffer | string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (message instanceof ArrayBuffer) return;

    try {
      const parsedMessage = JSON.parse(message as string);
      const wsMessageValidation =
        webSocketMessageSchema.safeParse(parsedMessage);
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
      const { type, command } =
        wsMessageValidation.data as WebSocketMessageSchema;
      // TEXT_STATE can keep merging the messages -> simple serialization
      // Canvas UPDATEs can only be boradcasted, unless the client sends a
      // MessageType.SNAPSHOT command
      switch (type) {
        case MessageType.SETUP:
          ws.send(
            JSON.stringify({
              type: MessageType.SETUP,
              command: MessageCommand.SNAPSHOT,
              payload:
                this.latestCanvasSnapshot.length > 0
                  ? uint8ArrayToBase64(this.latestCanvasSnapshot)
                  : undefined,
            })
          );
          ws.send(
            JSON.stringify({
              type: MessageType.TEXT_STATE,
              command: MessageCommand.UPDATE,
              payload:
                this.textDocBufferState.length > 0
                  ? uint8ArrayToBase64(this.textDocBufferState)
                  : undefined,
            })
          );
          break;
        case MessageType.TEXT_STATE:
          switch (command) {
            case MessageCommand.UPDATE:
              const buffer = (wsMessageValidation.data as WSMessage)
                .payload as string;
              const bytes = base64ToUint8Array(buffer);
              this.textDocBufferState = this.mergeDocMessages(bytes);
              break;
            default:
              ws.send(
                JSON.stringify({
                  type: MessageType.ERROR,
                  command: MessageCommand.INFO,
                  payload: {
                    message: `Unknown method for TEXT_STATE update: ${command}`,
                  },
                } as WSMessage)
              );
              return;
          }
          this.broadcast(message as string, this.clientMap.get(ws));
          this.storeState();
          break;
        case MessageType.STATE:
          const messageData = wsMessageValidation.data as StateUpdateMessage;
          switch (command) {
            case MessageCommand.UPDATE:
              // Between clients
              this.broadcast(message as string, this.clientMap.get(ws));
              break;
            case MessageCommand.SNAPSHOT:
              // Validate the payload?
              // TODO: Check the version numbers of the saved state?
              // -> use senderCounter!!!
              this.latestCanvasSnapshot = base64ToUint8Array(
                messageData.payload
              );
              this.storeState();
              break;
            default:
              ws.send(
                JSON.stringify({
                  type: MessageType.ERROR,
                  command: MessageCommand.INFO,
                  payload: {
                    message: `Unknown method for STATE update: ${command}`,
                  },
                } as WSMessage)
              );
              return;
          }
          break;
        case MessageType.ERROR:
          // Error message handling
          // (log for now -> indicates internal proto fault)
          if (command !== MessageCommand.INFO) return;
          console.error(
            "WebSocket error message received:",
            wsMessageValidation.data
          );
          break;
        default:
          ws.send(
            JSON.stringify({
              type: MessageType.ERROR,
              command: MessageCommand.INFO,
              payload: {
                message: `Unknown message type: ${type}`,
              },
            } as WSMessage)
          );
      }
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: MessageType.ERROR,
          command: MessageCommand.INFO,
          payload: {
            message: "Error processing message",
          },
        } as WSMessage)
      );
    }
  }

  private mergeDocMessages(
    messages: Uint8Array<ArrayBufferLike>
  ): Uint8Array<ArrayBufferLike> {
    if (!this.textDocBufferState.length) return messages;
    if (!messages.length) return this.textDocBufferState;
    return mergeMessages([this.textDocBufferState, messages]);
  }

  private broadcast(msg: string, senderId?: string): void {
    this.clientMap.forEach((clientId, ws) => {
      if (ws.readyState === WebSocket.OPEN && clientId !== senderId) {
        try {
          ws.send(msg);
        } catch (e) {
          this.removeClient(ws);
          ws.close(1000, "Client disconnected or error sending message.");
        }
      }
    });
  }

  private async forceStore(): Promise<void> {
    if (this.d1Storage) {
      await this.d1Storage.storeState({
        textDocLogBuffer:
          this.textDocBufferState.length > 0
            ? uint8ArrayToBase64(this.textDocBufferState)
            : undefined,
        latestCanvasSnapshot:
          this.latestCanvasSnapshot.length > 0
            ? uint8ArrayToBase64(this.latestCanvasSnapshot)
            : undefined,
      });
    }
  }

  async storeState(): Promise<void> {
    await this.durableObjectStorage.putState({
      textDocLogBuffer:
        this.textDocBufferState.length > 0
          ? uint8ArrayToBase64(this.textDocBufferState)
          : undefined,
      latestCanvasSnapshot:
        this.latestCanvasSnapshot.length > 0
          ? uint8ArrayToBase64(this.latestCanvasSnapshot)
          : undefined,
    });
    if (this.d1Storage) {
      this.debouncedStore();
    }
  }
}
