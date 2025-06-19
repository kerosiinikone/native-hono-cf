import { AbstractDoc, CVar, DocOptions } from "@collabs/collabs";
import {
  base64ToUint8Array,
  DrawingMode,
  MessageType,
  WSMessage,
} from "@native-hono-cf/shared";
import { create } from "zustand";

type State = {
  documentId: string | null;
  drawingMode: DrawingMode;
  globalCanvasMessageQueue: WSMessage[];
  uncommitedChanges: Uint8Array<ArrayBufferLike>;
};

type Actions = {
  setDocumentId: (id: string | null) => void;
  setDrawingMode: (mode: DrawingMode) => void;
  pushMessageToQueue: (message: WSMessage) => void;
  popMessageFromCanvasQueue: () => WSMessage | undefined;
  receiveRemoteMessage: (message: WSMessage) => void;
  bindStore: (instance: TextDoc) => void;

  flushState: () => void;
};

const TEST_DOCUMENT_ID = "289d4f3c-3617-45cb-a696-15ed24386388";

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
  documentId: TEST_DOCUMENT_ID,
  drawingMode: "draw",
  globalTextMessageQueue: [],
  globalCanvasMessageQueue: [],
  doc: null,
  uncommitedChanges: new Uint8Array(),

  bindStore: (instance: TextDoc) => {
    const uncommitedChanges = get().uncommitedChanges;
    if (uncommitedChanges.length > 0) {
      instance.receive(uncommitedChanges);
    }
    set({ doc: instance });
  },
  receiveRemoteMessage: (message) => {
    switch (message.type) {
      case MessageType.TEXT_STATE:
        const doc = get().doc;
        if (!message.payload) return;
        const base64 = message.payload;
        const buff = base64ToUint8Array(base64);
        if (buff.length === 0) return;
        if (doc) doc.receive(buff);
        else get().uncommitedChanges = buff;
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
