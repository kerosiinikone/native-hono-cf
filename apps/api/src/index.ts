import { Hono } from "hono";
import { cors } from "hono/cors";
import { Bindings } from "hono/types";
import routes from "./routes";
import { AbstractDoc, CVar, DocOptions } from "@collabs/collabs";
import { TextDocumentState } from "@native-hono-cf/shared";

export { WebSocketServer } from "./durable";

// export class TextDoc extends AbstractDoc {
//   readonly heading: CVar<string>;
//   readonly content: CVar<string>;

//   constructor(options?: DocOptions) {
//     super(options);
//     this.heading = this.runtime.registerCollab(
//       "heading",
//       (init) => new CVar(init, "")
//     );
//     this.content = this.runtime.registerCollab(
//       "content",
//       (init) => new CVar(init, "")
//     );
//   }

//   loadState(textState: TextDocumentState) {
//     if (textState.heading) {
//       this.heading.set(textState.heading);
//     }
//     if (textState.text) {
//       this.content.set(textState.text);
//     }
//   }

//   updateContent(text: string) {
//     this.content.set(text);
//   }

//   updateHeading(text: string) {
//     this.heading.set(text);
//   }
// }

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
