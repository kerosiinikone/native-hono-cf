import { documentSchema } from "@native-hono-cf/shared";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { WebSocketServer } from "./durable";
import { z } from "zod";

// TODO: Authentication, authorization

type Bindings = {
  DB: D1Database;
  DURABLE_OBJECT: DurableObjectNamespace<WebSocketServer>;
};

const routes = new Hono<{ Bindings: Bindings }>();

routes.get("/documents/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  return await db
    .prepare("SELECT * FROM documents WHERE document_id = ?")
    .bind(id)
    .first()
    .then((row) => {
      if (!row) {
        return c.notFound();
      }
      return c.json(row);
    });
});

routes.post(
  "/documents",
  validator("json", (value, c) => {
    const parsed = documentSchema.safeParse(value);
    if (!parsed.success) {
      return c.text("Invalid!", 401);
    }
    return parsed.data;
  }),
  async (c) => {
    const db = c.env.DB;
    const body = (await c.req.json()) as unknown as z.infer<
      typeof documentSchema
    >;

    const { state, id } = body;

    if (!state) {
      return c.json({ error: "Missing required fields: state" }, 400);
    }

    const document_id = id ?? crypto.randomUUID();

    await db
      .prepare(
        "INSERT INTO documents (document_id, state) VALUES (?, ?) ON CONFLICT(document_id) DO UPDATE SET state = ?"
      )
      .bind(document_id, state, state)
      .run();

    return c.json({ id: document_id, state });
  }
);

// Main entry for business logic
routes.get("/ws/:id", (c) => {
  const documentId = c.req.param("id");

  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader?.toLowerCase() !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }

  try {
    const durableObjectId = c.env.DURABLE_OBJECT.idFromName(documentId);
    const stub = c.env.DURABLE_OBJECT.get(durableObjectId);
    return stub.fetch(c.req.raw);
  } catch (error) {
    console.error(`Error upgrading WebSocket for ${documentId}:`, error);
    return c.text("Failed to upgrade WebSocket connection", 500);
  }
});

export default routes;
