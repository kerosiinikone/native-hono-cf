import { DurableObject } from "cloudflare:workers";
import { DocumentState } from "@native-hono-cf/shared";

export interface Env {
  WEBSOCKET_SERVER: DurableObjectNamespace<WebSocketServer>;
}

export class WebSocketServer extends DurableObject {
  state: DocumentState = {
    elements: [],
  };

  async fetch(_: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    if (!client || !server) {
      return new Response("WebSocket creation failed", { status: 500 });
    }

    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    ws.send(
      `[Durable Object] message: ${message}, connections: ${
        this.ctx.getWebSockets().length
      }`
    );
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    ws.close(code);
  }
}
