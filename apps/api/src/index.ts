import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "hono/types";
import routes from "./routes";

export { WebSocketServer } from "./durable";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());
app.route("/api", routes);
app.onError((err, c) => {
  console.error("Unhandled API Error:", err);
  return c.json(
    { error: "An unexpected error occurred", message: err.message },
    500
  );
});

export default app;
