import { AbstractDoc, CVar, DocOptions, mergeMessages } from "@collabs/collabs";
import {
  base64ToUint8Array,
  DrawingMode,
  MessageCommand,
  MessageType,
  WSMessage,
} from "@native-hono-cf/shared";
import { create } from "zustand";

type State = {
  documentId: string | null;
  drawingMode: DrawingMode;
  savedState: Uint8Array;
  uncommitedChanges: Uint8Array<ArrayBufferLike>;
  uncommitedCanvasChanges: Uint8Array<ArrayBufferLike>;
  savedCanvasState: Uint8Array<ArrayBufferLike>;
};

type Actions = {
  setDocumentId: (id: string | null) => void;
  loadSavedState: () => void;
  setSavedState: (state: Uint8Array) => void;
  setDrawingMode: (mode: DrawingMode) => void;
  receiveRemoteMessage: (message: WSMessage) => void;
  bindStore: (instance: TextDoc) => void;
  setUncommitedCanvasChanges: (changes: Uint8Array<ArrayBufferLike>) => void;
  setSavedCanvasState: (state: Uint8Array<ArrayBufferLike>) => void;
};

const TEST_DOCUMENT_ID = "289d4f3c-3617-45cb-a696-15ed24386388";

export class TextDoc extends AbstractDoc {
  readonly heading: CVar<string>; // RichText?
  readonly content: CVar<string>; // RichText?

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
  doc: null,
  uncommitedChanges: new Uint8Array(),
  uncommitedCanvasChanges: new Uint8Array(),
  savedCanvasState: new Uint8Array(),
  savedState: new Uint8Array(),

  loadSavedState: () => {
    const { doc, savedState, setSavedCanvasState } = get();
    if (savedState.length > 0) {
      if (doc) doc.load(savedState);
      else get().uncommitedChanges = savedState;
      setSavedCanvasState(new Uint8Array());
    }
  },

  setSavedState: (state: Uint8Array) => {
    set({ savedState: state });
  },

  setDocumentId: (id) => set({ documentId: id }),

  setDrawingMode: (mode) => set({ drawingMode: mode }),

  bindStore: (instance: TextDoc) => {
    const { uncommitedChanges, savedState, setSavedState } = get();
    if (savedState.length > 0) {
      instance.load(savedState);
      setSavedState(new Uint8Array());
    }
    if (uncommitedChanges.length > 0) {
      instance.receive(uncommitedChanges);
    }
    set({ doc: instance });
  },

  receiveRemoteMessage: (message) => {
    if (!message.payload) return;
    const base64 = message.payload as string;
    const buff = base64ToUint8Array(base64);
    if (buff.length === 0) return;

    const {
      uncommitedCanvasChanges,
      setUncommitedCanvasChanges,
      setSavedCanvasState,
    } = get();

    switch (message.type) {
      case MessageType.TEXT_STATE:
        const { doc } = get();
        if (doc) doc.receive(buff);
        else get().uncommitedChanges = buff;
        break;
      case MessageType.STATE:
        if (uncommitedCanvasChanges.length > 0)
          // Could go wrong (matrix serialization doesn't go well with the mergeMessages)
          // -> maybe just a queue?
          setUncommitedCanvasChanges(
            mergeMessages([uncommitedCanvasChanges, buff])
          );
        else setUncommitedCanvasChanges(buff);
        break;
      case MessageType.SETUP:
        switch (message.command) {
          case MessageCommand.SNAPSHOT:
            setSavedCanvasState(buff);
            break;
        }
    }
  },

  setSavedCanvasState: (state: Uint8Array<ArrayBufferLike>) => {
    set({ savedCanvasState: state });
  },

  setUncommitedCanvasChanges: (changes: Uint8Array<ArrayBufferLike>) => {
    set({ uncommitedCanvasChanges: changes });
  },
}));
