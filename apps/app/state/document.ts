import {
  DocumentStateUpdate,
  DrawingMode,
  MessageType,
  WSMessage,
} from "@native-hono-cf/shared";
import { create } from "zustand";

// TODO: Helpers and more elegent logic
// TODO: Immer

type State = {
  documentId: string | null;
  drawingMode: DrawingMode;

  globalTextMessageQueue: WSMessage[];
  globalCanvasMessageQueue: WSMessage[];

  textContent: string;
  textHeading: string;
};

type Actions = {
  setDocumentId: (id: string | null) => void;
  setDrawingMode: (mode: DrawingMode) => void;
  pushMessageToQueue: (message: WSMessage) => void;
  popMessageFromQueue: (type: "text" | "canvas") => WSMessage | undefined;

  flushState: () => void;
};

// Split text actions to keep the store organized?
type TextActions = {
  setTextContent: (content: string) => void;
  setTextHeading: (heading: string) => void;
};

export const useDocumentStore = create<State & Actions & TextActions>(
  (set, get) => ({
    documentId: "289d4f3c-3617-45cb-a696-15ed24386388",
    drawingMode: "draw",
    textContent: "",
    textHeading: "",
    globalTextMessageQueue: [],
    globalCanvasMessageQueue: [],

    // Determine type here?
    pushMessageToQueue: (message) => {
      const { globalTextMessageQueue, globalCanvasMessageQueue } = get();
      if (message.type === MessageType.TEXT_STATE) {
        set({
          globalTextMessageQueue: [...globalTextMessageQueue, message],
        });
      } else {
        set({
          globalCanvasMessageQueue: [...globalCanvasMessageQueue, message],
        });
      }
    },
    popMessageFromQueue: (type) => {
      const { globalTextMessageQueue, globalCanvasMessageQueue } = get();
      if (type === "text") {
        if (globalTextMessageQueue.length > 0) {
          return globalTextMessageQueue.pop();
        }
      } else {
        if (globalCanvasMessageQueue.length > 0) {
          return globalCanvasMessageQueue.pop();
        }
      }
    },

    setTextContent: (content) => null,
    setTextHeading: (heading) => null,

    setDocumentId: (id) => set({ documentId: id }),
    setDrawingMode: (mode) => set({ drawingMode: mode }),
    flushState: () => {
      set({
        drawingMode: "draw",
        textContent: "",
        textHeading: "",
      });
    },
  })
);
