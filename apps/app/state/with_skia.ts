import { Matrix4, SkPath } from "@shopify/react-native-skia";
import { makeMutable, SharedValue } from "react-native-reanimated";
import { create } from "zustand";
import { CanvasDoc } from "./c_canvas";

// TODO: What needs to be in this store?

export type ClientObject = {
  path: SkPath;
  x: number;
  y: number;
  focalX: number;
  focalY: number;
  width: number;
  height: number;
  matrix: Matrix4;
  stretchable: boolean;
};

type State = {
  // Wrapper for accessing and modifying the underlying matrix?
  canvasMatrix: SharedValue<Matrix4>;
  savedState: Uint8Array;
};

type Actions = {
  bindStore: (instance: CanvasDoc) => void;
  setSavedState: (state: Uint8Array) => void;
};

export const withSkia_useCanvasStore = create<
  State &
    Actions & {
      doc: CanvasDoc | null;
    }
>((set, get) => ({
  // Might not be necessary to have this in the store
  // -> passed as a ref
  doc: null,
  savedState: new Uint8Array(),
  uncommitedChanges: new Uint8Array(),
  canvasMatrix: makeMutable(Matrix4()),

  bindStore: (instance: CanvasDoc) => {
    const { savedState, setSavedState } = get();
    set({ doc: instance });
    if (savedState.length > 0) {
      instance.load(savedState);
      setSavedState(new Uint8Array());
    }
  },

  // TODO: Remove or make work
  setSavedState: (state: Uint8Array) => set({ savedState: state }),
}));
