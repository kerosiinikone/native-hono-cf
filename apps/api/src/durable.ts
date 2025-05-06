import { DurableObject } from "cloudflare:workers";
import {
  DocumentState,
  DocumentStateUpdate,
  MessageType,
  WSMessage,
} from "@native-hono-cf/shared";

export class WebSocketServer extends DurableObject {
  state: DocumentState = {
    elements: [],
  };
  db: D1Database | null = null;

  // clients: Record<string, WebSocket> = {}; // Sync status?

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.db = env.DB;
      this.ctx = ctx;

      const savedState = (await ctx.storage.get("state")) as string | null;

      if (savedState) {
        this.state = JSON.parse(savedState) as DocumentState;
      }
    });
  }

  // TODO: Ping / pong to keep the connection alive
  // TODO: Zod schemas for messages and state updates

  async fetch(req: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    if (!client || !server) {
      return new Response("Fail", { status: 500 });
    }

    const url = new URL(req.url);
    const id = (url.pathname.split("/").pop() || "") as string;

    this._getPersistedState(id);

    this.ctx.acceptWebSocket(server);

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

    const parsedMessage = JSON.parse(msg) as WSMessage;

    switch (parsedMessage.type) {
      case MessageType.SETUP:
        ws.send(
          JSON.stringify({
            type: MessageType.STATE,
            payload: this.state,
          } as WSMessage)
        );
        return;
      case MessageType.STATE:
        const stateUpdate = parsedMessage.payload as DocumentStateUpdate;
        if (!stateUpdate.elements?.length) return;

        this.broadcastStateChanges(stateUpdate);

        // Couple these
        this.state.elements = stateUpdate.elements;
        await this.ctx.storage.put("state", JSON.stringify(this.state));
        await this._persistState(this.state);

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

  // Parse and stringify for no reason?
  async broadcastStateChanges(stateUpdate: DocumentStateUpdate) {
    for (const client of this.ctx.getWebSockets()) {
      // TODO: Ignore the client that sent the message
      client.send(
        JSON.stringify({
          type: MessageType.STATE,
          payload: stateUpdate,
        } as WSMessage)
      );
    }
  }

  async _persistState(_: DocumentState) {}

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
