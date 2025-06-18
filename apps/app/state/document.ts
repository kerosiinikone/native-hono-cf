import { base64ToUint8Array } from "@/utils/binary";
import { AbstractDoc, CVar, DocOptions } from "@collabs/collabs";
import { DrawingMode, MessageType, WSMessage } from "@native-hono-cf/shared";
import { create } from "zustand";

type State = {
  documentId: string | null;
  drawingMode: DrawingMode;
  globalCanvasMessageQueue: WSMessage[];
};

type Actions = {
  setDocumentId: (id: string | null) => void;
  setDrawingMode: (mode: DrawingMode) => void;
  pushMessageToQueue: (message: WSMessage) => void;
  popMessageFromCanvasQueue: () => WSMessage | undefined;
  receiveRemoteMessage: (message: WSMessage) => void;
  flushState: () => void;
  bindStore: (instance: TextDoc) => void;
};

export class TextDoc extends AbstractDoc {
  readonly heading: CVar<string>;
  readonly content: CVar<string>;

  constructor(options?: DocOptions) {
    super(options);
    this.heading = this.runtime.registerCollab(
      "heading",
      (init) => new CVar(init, "")
    );
    this.content = this.runtime.registerCollab(
      "content",
      (init) => new CVar(init, "")
    );
  }

  updateContent(text: string) {
    this.content.set(text);
  }

  updateHeading(text: string) {
    this.heading.set(text);
  }
}

export const useDocumentStore = create<
  State &
    Actions & {
      doc: TextDoc | null;
    }
>((set, get) => ({
  documentId: "289d4f3c-3617-45cb-a696-15ed24386388",
  drawingMode: "draw",
  globalTextMessageQueue: [],
  globalCanvasMessageQueue: [],
  doc: null,

  bindStore: (instance: TextDoc) => {
    set({ doc: instance });
  },
  receiveRemoteMessage: (message) => {
    switch (message.type) {
      case MessageType.TEXT_STATE:
        const doc = get().doc;
        if (!message.payload || !doc) return;
        const base64 = message.payload;
        doc.receive(base64ToUint8Array(base64));
        break;
      default:
        get().pushMessageToQueue(message);
        break;
    }
  },
  pushMessageToQueue: (message) => {
    const { globalCanvasMessageQueue } = get();
    set({
      globalCanvasMessageQueue: [...globalCanvasMessageQueue, message],
    });
  },
  popMessageFromCanvasQueue: () => get().globalCanvasMessageQueue.pop(),

  setDocumentId: (id) => set({ documentId: id }),
  setDrawingMode: (mode) => set({ drawingMode: mode }),
  flushState: () => {
    set({
      drawingMode: "draw",
    });
  },
}));
