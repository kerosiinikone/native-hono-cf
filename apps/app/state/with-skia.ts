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
  canvasMatrix: SharedValue<Matrix4>;
};

type Actions = {
  bindStore: (instance: CanvasDoc, f: (instance: CanvasDoc) => void) => void;
};

export const withSkia_useCanvasStore = create<
  State &
    Actions & {
      doc: CanvasDoc | null;
    }
>((set) => ({
  doc: null,
  uncommitedChanges: new Uint8Array(),
  canvasMatrix: makeMutable(Matrix4()),

  bindStore: (instance: CanvasDoc, f: (instance: CanvasDoc) => void) => {
    set({ doc: instance });
    f(instance);
  },
}));
