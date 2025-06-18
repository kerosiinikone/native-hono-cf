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
};

type Actions = {
  setDocumentId: (id: string | null) => void;
  setDrawingMode: (mode: DrawingMode) => void;
  pushMessageToQueue: (message: WSMessage) => void;
  popMessageFromTextQueue: () => WSMessage | undefined;
  popMessageFromCanvasQueue: () => WSMessage | undefined;
  flushState: () => void;
};

export const useDocumentStore = create<State & Actions>((set, get) => ({
  documentId: "289d4f3c-3617-45cb-a696-15ed24386388",
  drawingMode: "draw",
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
  popMessageFromTextQueue: () => get().globalTextMessageQueue.pop(),
  popMessageFromCanvasQueue: () => get().globalCanvasMessageQueue.pop(),

  setDocumentId: (id) => set({ documentId: id }),
  setDrawingMode: (mode) => set({ drawingMode: mode }),
  flushState: () => {
    set({
      drawingMode: "draw",
    });
  },
}));
