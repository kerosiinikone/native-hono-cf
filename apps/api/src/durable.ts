import { DurableObject } from "cloudflare:workers";
import {
  DocumentState,
  DocumentStateUpdate,
  MessageType,
  webSocketMessageSchema,
  WebSocketMessageSchema,
  WSMessage,
} from "@native-hono-cf/shared";

export class WebSocketServer extends DurableObject {
  private clients: Map<WebSocket, string> = new Map();
  private id: string | null = null;

  state: DocumentState = {
    elements: [],
  };
  db: D1Database | null = null;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.db = env.DB;
      this.ctx = ctx;

      const savedState = (await ctx.storage.get("state")) as string | null;

      this.id = (await ctx.storage.get("id")) as string | null;

      if (savedState) {
        this.state = JSON.parse(savedState) as DocumentState;
      }
    });
  }

  // TODO: Zod schemas for messages and state updates
  // TODO: Ping / pong to keep the connection alive

  async fetch(req: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    if (!client || !server) {
      return new Response("Fail", { status: 500 });
    }

    const clientId = crypto.randomUUID();
    this.clients.set(server, clientId);

    this.ctx.acceptWebSocket(server);

    const url = new URL(req.url);
    const id = (url.pathname.split("/").pop() || "") as string;

    if (!this.id) {
      this.id = id;
      await this.ctx.storage.put("id", id);
    }

    this._getPersistedState(id);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, msg: ArrayBuffer | string) {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }
    if (msg instanceof ArrayBuffer) {
      return;
    }

    const parsedMessage = JSON.parse(msg);
    const wsMessage = webSocketMessageSchema.safeParse(parsedMessage);

    if (!wsMessage.success) {
      console.error("Invalid message", wsMessage.error);
      return;
    }

    const { type, payload } = wsMessage.data as WebSocketMessageSchema;

    switch (type) {
      case MessageType.SETUP:
        ws.send(
          JSON.stringify({
            type: MessageType.STATE,
            payload: this.state,
          } as WSMessage)
        );
        return;
      case MessageType.STATE:
        const stateUpdate = payload as DocumentStateUpdate;
        if (!stateUpdate.elements?.length) return;

        const senderClientId = this.clients.get(ws);
        this.broadcastStateChanges(msg, senderClientId);

        // Couple these
        this.state.elements = stateUpdate.elements;
        await this.ctx.storage.put("state", JSON.stringify(this.state));
        await this._persistState();

        return;
      default:
        ws.send(
          `[Durable Object] State length: ${
            this.state.elements.length
          }, connections: ${this.ctx.getWebSockets().length}`
        );
    }
  }

  async webSocketClose(ws: WebSocket, code: number, _: string, __: boolean) {
    ws.close(code);
  }

  async broadcastStateChanges(stateUpdateMsg: string, senderId?: string) {
    for (const [client, clientId] of this.clients.entries()) {
      if (clientId !== senderId) {
        client.send(stateUpdateMsg);
      }
    }
  }

  async _persistState() {
    const db = this.db;

    if (!db) {
      console.error("Database not initialized");
      return;
    }

    if (!this.state) {
      console.error("No state to persist");
      return;
    }

    await db
      .prepare(
        "INSERT INTO documents (document_id, state) VALUES (?, ?) ON CONFLICT(document_id) DO UPDATE SET state = ?"
      )
      .bind(this.ctx.id, JSON.stringify(this.state), JSON.stringify(this.state))
      .run()
      .catch((err) => {
        console.error("Error persisting state", err);
      });
  }

  async _getPersistedState(param: string) {
    const db = this.db;

    if (!db) {
      console.error("Database not initialized");
      return;
    }
    if (!param) {
      console.error("No document ID provided");
      return;
    }

    const persistedState = (await db
      .prepare("SELECT state FROM documents WHERE document_id = ?")
      .bind(param)
      .first()
      .then((row) => {
        if (!row) {
          return null;
        }
        return row;
      })
      .catch(() => {
        return null;
      })) as {
      state: string;
    };

    if (!persistedState) {
      this.state = { elements: [] };
    } else {
      await this.ctx.storage.put("state", persistedState.state);
      this.state = JSON.parse(persistedState.state) as DocumentState;
    }
  }
}
