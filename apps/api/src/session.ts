import {
  DocumentState,
  DocumentStateUpdate,
  MessageType,
  webSocketMessageSchema,
  WebSocketMessageSchema,
  WSMessage,
} from "@native-hono-cf/shared";
import { D1Persistence, DocumentStorage } from "./persistence";

const DEBOUNCE = 5000;

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timeoutId: any | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export class DocumentSession {
  private clientMap: Map<WebSocket, string> = new Map();
  public state: DocumentState = { elements: [] };
  private durableObjectStorage: DocumentStorage;
  private d1Persistence?: D1Persistence;

  private debouncedPersistToD1: () => void;

  constructor(
    durableObjectStorage: DocumentStorage,
    d1Persistence?: D1Persistence,
    private persistenceDebounceTime: number = DEBOUNCE
  ) {
    this.durableObjectStorage = durableObjectStorage;
    this.d1Persistence = d1Persistence;

    this.debouncedPersistToD1 = debounce(
      this._persistToD1Now.bind(this),
      this.persistenceDebounceTime
    );
  }

  async initialize(initialD1State?: DocumentState | null): Promise<void> {
    let loadedState = await this.durableObjectStorage._getState();

    if (!loadedState && initialD1State) {
      loadedState = initialD1State;
    }
    this.state = loadedState || { elements: [] };

    await this.durableObjectStorage._putState(this.state);
  }

  addClient(ws: WebSocket): string {
    const clientId = crypto.randomUUID();
    this.clientMap.set(ws, crypto.randomUUID());
    console.log(
      `[DocumentSession] Client ${clientId} connected. Total clients: ${this.clientMap.size}`
    );
    return clientId;
  }

  removeClient(ws: WebSocket): void {
    const clientId = this.clientMap.get(ws);
    if (clientId) {
      this.clientMap.delete(ws);
      console.log(
        `[DocumentSession] Client ${clientId} disconnected. Total clients: ${this.clientMap.size}`
      );
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
          "[DocumentSession] Invalid message schema:",
          wsMessageValidation.error.flatten()
        );
        ws.send(
          JSON.stringify({
            type: MessageType.ERROR,
            payload: { message: "Invalid message format." },
          } as WSMessage)
        );
        return;
      }

      const { type, payload } =
        wsMessageValidation.data as WebSocketMessageSchema;

      switch (type) {
        case MessageType.SETUP:
          ws.send(
            JSON.stringify({
              type: MessageType.STATE,
              payload: this.state,
            } as WSMessage)
          );
          break;
        case MessageType.STATE:
          // Granularity in the future?
          const stateUpdate = payload as DocumentStateUpdate;
          if (stateUpdate.elements) {
            this.state = { ...this.state, elements: stateUpdate.elements };
          } else {
            console.warn(
              "[DocumentSession] Received STATE update without elements."
            );
            this.state = Object.assign(this.state, stateUpdate);
          }

          this.broadcast(message, this.clientMap.get(ws));
          this.persistState();
          break;
        default:
          console.warn(`[DocumentSession] Misc: ${type}`);
          ws.send(
            JSON.stringify({
              type: MessageType.ERROR,
              payload: { message: `Received: ${type}` },
            } as WSMessage)
          );
      }
    } catch (error) {
      console.error("[DocumentSession] Error processing message:", error);
      ws.send(
        JSON.stringify({
          type: MessageType.ERROR,
          payload: { message: "Error processing message." },
        } as WSMessage)
      );
    }
  }

  private broadcast(message: string, senderId?: string): void {
    this.clientMap.forEach((clientId, ws) => {
      if (ws.readyState === WebSocket.OPEN && clientId !== senderId) {
        try {
          ws.send(message);
        } catch (e) {
          console.error(
            `[DocumentSession] Error sending message to ${clientId}:`,
            e
          );
          this.removeClient(ws);
          ws.close(1000, "Client disconnected or error sending message.");
        }
      }
    });
  }

  private async _persistToD1Now(): Promise<void> {
    if (this.d1Persistence) {
      await this.d1Persistence.persistState(this.state);
    }
  }

  async persistState(): Promise<void> {
    // Local storage
    await this.durableObjectStorage._putState(this.state);
    if (this.d1Persistence) {
      this.debouncedPersistToD1();
    }
  }

  async flush(): Promise<void> {
    if (this.d1Persistence) {
      console.log(
        `[DocumentSession] Flushing state to D1 immediately for document...`
      );
      await this.d1Persistence.persistState(this.state);
    }
  }
}
