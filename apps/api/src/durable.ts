import { DurableObject } from "cloudflare:workers";
import { DocumentState } from "@native-hono-cf/shared";

export class WebSocketServer extends DurableObject {
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

      if (savedState) {
        this.state = JSON.parse(savedState) as DocumentState;
      }
    });
  }

  async fetch(req: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    const url = new URL(req.url);
    const id = (url.pathname.split("/").pop() || "") as string;

    this._getInitialState(id);

    if (!client || !server) {
      return new Response("Fail", { status: 500 });
    }

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

    if (msg === "setup") {
      ws.send(
        JSON.stringify({
          type: "state",
          state: this.state,
        })
      );
      return;
    }

    ws.send(
      `[Durable Object] State length: ${
        this.state.elements.length
      }, connections: ${this.ctx.getWebSockets().length}`
    );
  }

  async webSocketClose(ws: WebSocket, code: number, _: string, __: boolean) {
    ws.close(code);
  }

  async _getInitialState(param: string) {
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
