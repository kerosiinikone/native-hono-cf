import { DurableObject } from "cloudflare:workers";
import { D1Persistence, DObjectStorage } from "./persistence";
import { DocumentSession } from "./session";

export class WebSocketServer extends DurableObject {
  private session!: DocumentSession;
  private documentId!: string;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);

    this.ctx.blockConcurrencyWhile(async () => {
      this.documentId = (await ctx.storage.get("id")) as string;

      const doStorage = new DObjectStorage(this.ctx.storage);
      const d1Persistence = new D1Persistence(env.DB, this.documentId);

      this.session = new DocumentSession(doStorage, d1Persistence);

      await this.session.initialize(await d1Persistence.loadState());
    });
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    if (!this.documentId) {
      const url = new URL(request.url);
      const id = (url.pathname.split("/").pop() || "") as string;
      this.documentId = id;

      await this.ctx.storage.put("id", id);
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    if (!server || !client) {
      return new Response("Failed to create WebSocket", { status: 500 });
    }

    this.ctx.acceptWebSocket(server);
    this.session.addClient(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    this.session.handleMessage(ws, message);
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    console.log(
      `[DO ${this.documentId}] WebSocket closed. Code: ${code}, Reason: ${reason}, Clean: ${wasClean}`
    );
    this.session.removeClient(ws);
  }

  async webSocketError(ws: WebSocket, error: any) {
    console.error(`[DO ${this.documentId}] WebSocket error:`, error);
    this.session.removeClient(ws);
  }
}
