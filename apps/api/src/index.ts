import { Hono } from "hono";
import { cors } from "hono/cors";
import { validator } from "hono/validator";
import { z } from "zod";

type Bindings = {
  DB: D1Database;
  DURABLE_OBJECT: any;
};

const app = new Hono<{ Bindings: Bindings }>();

const documentSchema = z.object({
  state: z.string(),
  id: z.string().optional(),
});

app.use("/*", cors());

app.get("/documents/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  return await db
    .prepare("SELECT * FROM documents WHERE id = ?")
    .bind(id)
    .first()
    .then((row) => {
      if (!row) {
        return c.notFound();
      }
      return c.json(row);
    });
});

app.post(
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

app.get("/api/ws/:documentId");

export default app;
