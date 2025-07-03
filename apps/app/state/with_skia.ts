import { Matrix4, SkPath } from "@shopify/react-native-skia";
import { makeMutable, SharedValue } from "react-native-reanimated";
import { create } from "zustand";
import { CanvasDoc, CElement } from "./c_canvas";

// Has to be a separate slice
// since it is used in the Skia
// canvas component (under the Skia WASM context)

// Keeps track of the canvas messages
// and the current state of the canvas

export type ClientObject = {
  path: SkPath;
  x: number;
  y: number;
  focalX: number;
  focalY: number;
  width: number;
  height: number;
  matrix: Matrix4;
};

type State = {
  // Wrapper for accessing and modifying the underlying matrix?
  canvasMatrix: SharedValue<Matrix4>;
  savedState: Uint8Array;
  hasChanged: boolean;
  elementBeingDragged: CElement | null;
};

type Actions = {
  loadSavedState: (instance: CanvasDoc) => void;
  setSavedState: (state: Uint8Array) => void;
  notifyLocalChange: () => void;
  setElementBeingDragged: (element: CElement) => void;
  unsetElementBeingDragged: () => void;
};

export const withSkia_useCanvasStore = create<State & Actions>((set, get) => ({
  // Might not be necessary to have this in the store
  // -> passed as a ref
  elementBeingDragged: null,
  hasChanged: false,
  savedState: new Uint8Array(),
  uncommitedChanges: new Uint8Array(),
  canvasMatrix: makeMutable(Matrix4()),

  notifyLocalChange: () => {
    const { hasChanged } = get();
    set({ hasChanged: !hasChanged });
  },

  loadSavedState: (instance: CanvasDoc) => {
    const { savedState, setSavedState } = get();
    if (savedState.length > 0) {
      instance.load(savedState);
      setSavedState(new Uint8Array());
    }
  },

  setSavedState: (state: Uint8Array) => set({ savedState: state }),

  setElementBeingDragged: (element: CElement) =>
    set({ elementBeingDragged: element }),

  unsetElementBeingDragged: () => set({ elementBeingDragged: null }),
}));
