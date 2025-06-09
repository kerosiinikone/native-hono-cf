import { DrawingMode } from "@native-hono-cf/shared";
import { create } from "zustand";

// TODO: Helpers and more elegent logic
// TODO: Immer

type State = {
  documentId: string | null;
  drawingMode: DrawingMode;

  textContent: string;
  textHeading: string;
};

type Actions = {
  setDocumentId: (id: string | null) => void;
  setDrawingMode: (mode: DrawingMode) => void;

  flushState: () => void;
};

type TextActions = {
  setTextContent: (content: string) => void;
  setTextHeading: (heading: string) => void;
};

export const useDocumentStore = create<State & Actions & TextActions>(
  (set) => ({
    documentId: "289d4f3c-3617-45cb-a696-15ed24386388",
    drawingMode: "draw",

    textContent: "",
    textHeading: "",

    setTextContent: (content) => set({ textContent: content }),
    setTextHeading: (heading) => set({ textHeading: heading }),

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
