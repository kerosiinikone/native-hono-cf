import {
  DocumentState,
  Element,
  ErrorMessage,
  MessageCommand,
  MessageType,
  StateDeleteMessage,
  StateUpdateMessage,
  webSocketMessageSchema,
  WebSocketMessageSchema,
  WSMessage,
} from "@native-hono-cf/shared";
import { D1Persistence, DocumentStorage } from "./persistence";
import { debounce } from "./util";

const DEBOUNCE = 5000;

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
    this.state = loadedState || this.state;

    await this.durableObjectStorage._putState(this.state);
  }

  addClient(ws: WebSocket): string {
    const clientId = crypto.randomUUID();
    this.clientMap.set(ws, clientId);
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

      switch (type) {
        case MessageType.SETUP:
          ws.send(
            JSON.stringify({
              type: MessageType.STATE,
              command: MessageCommand.ADD,
              payload: this.state.elements,
            } as WSMessage)
          );
          break;
        case MessageType.STATE:
          const stateUpdate = wsMessageValidation.data as
            | StateUpdateMessage
            | StateDeleteMessage;

          if (!stateUpdate || typeof stateUpdate === "string") {
            console.warn(
              "[DocumentSession] Received STATE update without state."
            );
            this.state = Object.assign(this.state, stateUpdate);
          }

          switch (command) {
            case MessageCommand.DELETE:
              const stateDelete =
                wsMessageValidation.data as StateDeleteMessage;
              stateDelete.payload.elementIds.forEach((did) => {
                this.state.elements = this.state.elements.filter(
                  (element) => element.id !== did
                );
              });
              break;
            case MessageCommand.UPDATE:
              const updatePayload = stateUpdate.payload as Element;
              const elementIdToUpdate = updatePayload.id;

              if (
                !this.state.elements.some((el) => el.id === elementIdToUpdate)
              ) {
                console.warn(
                  `[DocumentSession] Element with ID '${elementIdToUpdate}' not found. No update performed.`
                );
                return;
              }

              let found = false;
              this.state.elements = this.state.elements.map((element) => {
                if (element.id === elementIdToUpdate) {
                  found = true;
                  return {
                    ...element,
                    properties: {
                      ...element.properties,
                      ...updatePayload.properties,
                    },
                  };
                }
                return element;
              });

              if (!found) {
                console.warn(
                  `[DocumentSession] Element with ID '${elementIdToUpdate}' not found. No update performed on elements array.`
                );
              }
              break;
            case MessageCommand.ADD:
              const addPayload = stateUpdate.payload as Element[];
              this.state.elements = this.state.elements.concat(
                [addPayload].flat()
              );
              break;
            default:
              console.warn(
                "[DocumentSession] Unknown method for STATE update:",
                command
              );
              // TODO: separate functions for each command?
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

          this.broadcast(message as string, this.clientMap.get(ws));
          this.persistState();
          break;
        default:
          console.warn(`[DocumentSession] Misc: ${type}`);
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
      console.error("[DocumentSession] Error processing message:", error);
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

  private broadcast(msg: string, senderId?: string): void {
    this.clientMap.forEach((clientId, ws) => {
      if (ws.readyState === WebSocket.OPEN && clientId !== senderId) {
        try {
          ws.send(msg);
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
