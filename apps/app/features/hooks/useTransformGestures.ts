import { useDocumentStore } from "@/state/store";
import { Matrix4, rotateZ, scale } from "@shopify/react-native-skia";
import { useCallback } from "react";
import { Gesture, SimultaneousGesture } from "react-native-gesture-handler";
import { runOnJS, SharedValue, useSharedValue } from "react-native-reanimated";
import { multiply4, translate } from "react-native-redash";

enum DragDirection {
  NONE = "none",
  LEFT = "left",
  RIGHT = "right",
  UP = "up",
  DOWN = "down",
}

interface TransformGesturesProps {
  matrix: SharedValue<Matrix4>;
  focalX: number;
  stretchable: boolean;
  width: number;
  id: string;
  height: number;
  x: number;
  y: number;
  focalY: number;
  updatePath: (params: Matrix4) => void;
}

export function multiply(...matrices: Matrix4[]) {
  "worklet";
  return matrices.reduce((acc, matrix) => multiply4(acc, matrix), Matrix4());
}

export default function useTransformGestures({
  updatePath,
  matrix,
  width,
  x,
  y,
  height,
  id,
  focalX,
  stretchable,
  focalY,
}: TransformGesturesProps): SimultaneousGesture {
  const { editRectWidth, editRectHeight } = useDocumentStore((state) => state);

  const savedMatrix = useSharedValue(Matrix4());
  const origin = useSharedValue({ x: 0, y: 0 });

  const widthResizeTimeout = useSharedValue<number | null>(null);
  const heightResizeTimeout = useSharedValue<number | null>(null);

  const debouncedWidthUpdateArgs = useSharedValue<any>(null);
  const debouncedHeightUpdateArgs = useSharedValue<any>(null);

  const dragDir = useSharedValue<DragDirection>(DragDirection.NONE);

  const performWidthUpdate = (args: any) => {
    if (!args) return;
    editRectWidth(args.id, Math.max(1, args.newWidth), args.x);
  };

  const performHeightUpdate = (args: any) => {
    if (!args) return;
    editRectHeight(args.id, Math.max(1, args.newHeight), args.y);
  };

  const updateOnEnd = useCallback(() => {
    "worklet";
    updatePath(matrix.value);
  }, [savedMatrix, matrix, updatePath]);

  const pan = Gesture.Pan()
    .averageTouches(true)
    .maxPointers(1)
    .onBegin((e) => {
      "worklet";

      if (stretchable) {
        if (Math.abs(width / 2 - (e.x - focalX)) < 50) {
          dragDir.value = DragDirection.RIGHT;
        } else if (Math.abs(-height / 2 + (e.y - focalY)) < 50) {
          dragDir.value = DragDirection.DOWN;
        } else if (Math.abs(width / 2 - (focalX - e.x)) < 50) {
          dragDir.value = DragDirection.LEFT;
        } else if (Math.abs(height / 2 - (focalY - e.y)) < 50) {
          dragDir.value = DragDirection.UP;
        }
      }
    })
    .onChange((e) => {
      "worklet";

      switch (dragDir.value) {
        case DragDirection.NONE:
          matrix.value = multiply4(
            translate(e.changeX, e.changeY, 0),
            matrix.value
          );
          updateOnEnd(); // Throttle this
          break;
        case DragDirection.RIGHT:
          debouncedWidthUpdateArgs.value = {
            id,
            newWidth: width + e.changeX,
          };
          if (widthResizeTimeout.value !== null) {
            runOnJS(clearTimeout)(widthResizeTimeout.value);
          }
          widthResizeTimeout.value = runOnJS(setTimeout)(() => {
            runOnJS(performWidthUpdate)(debouncedWidthUpdateArgs.value);
            debouncedWidthUpdateArgs.value = null;
          }, 300) as any;

          break;
        case DragDirection.LEFT:
          debouncedWidthUpdateArgs.value = {
            id,
            newWidth: width - e.changeX,
            x: x + e.changeX,
          };
          if (widthResizeTimeout.value !== null) {
            runOnJS(clearTimeout)(widthResizeTimeout.value);
          }
          widthResizeTimeout.value = runOnJS(setTimeout)(() => {
            runOnJS(performWidthUpdate)(debouncedWidthUpdateArgs.value);
            debouncedWidthUpdateArgs.value = null;
          }, 300) as any;

          break;
        case DragDirection.UP:
          debouncedHeightUpdateArgs.value = {
            id,
            newHeight: height - e.changeY,
            y: y + e.changeY,
          };
          if (heightResizeTimeout.value !== null) {
            runOnJS(clearTimeout)(heightResizeTimeout.value);
          }
          heightResizeTimeout.value = runOnJS(setTimeout)(() => {
            runOnJS(performHeightUpdate)(debouncedHeightUpdateArgs.value);
            debouncedHeightUpdateArgs.value = null;
          }, 300) as any;

          break;
        case DragDirection.DOWN:
          debouncedHeightUpdateArgs.value = {
            id,
            newHeight: height + e.changeY,
          };
          if (heightResizeTimeout.value !== null) {
            runOnJS(clearTimeout)(heightResizeTimeout.value);
          }
          heightResizeTimeout.value = runOnJS(setTimeout)(() => {
            runOnJS(performHeightUpdate)(debouncedHeightUpdateArgs.value);
            debouncedHeightUpdateArgs.value = null;
          }, 300) as any;

          break;
        default:
          console.warn("Unknown drag direction", dragDir);
          break;
      }
    })
    .onEnd(() => {
      "worklet";

      if (widthResizeTimeout.value !== null) {
        runOnJS(clearTimeout)(widthResizeTimeout.value);
        widthResizeTimeout.value = null;
        if (debouncedWidthUpdateArgs.value) {
          runOnJS(performWidthUpdate)(debouncedWidthUpdateArgs.value);
          debouncedWidthUpdateArgs.value = null;
        }
      }
      if (heightResizeTimeout.value !== null) {
        runOnJS(clearTimeout)(heightResizeTimeout.value);
        heightResizeTimeout.value = null;
        if (debouncedHeightUpdateArgs.value) {
          runOnJS(performHeightUpdate)(debouncedHeightUpdateArgs.value);
          debouncedHeightUpdateArgs.value = null;
        }
      }

      if (dragDir.value !== DragDirection.NONE) {
        dragDir.value = DragDirection.NONE;
        updateOnEnd();
      }
    });

  const rotate = Gesture.Rotation()
    .onBegin(() => {
      "worklet";
      origin.value = {
        x: focalX,
        y: focalY,
      };
      savedMatrix.value = matrix.value;
    })
    .onChange((e) => {
      "worklet";
      matrix.value = multiply4(
        savedMatrix.value,
        rotateZ(e.rotation, origin.value)
      );

      updateOnEnd();
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      "worklet";
      origin.value = {
        x: focalX,
        y: focalY,
      };
      savedMatrix.value = matrix.value;
    })
    .onChange((e) => {
      "worklet";
      matrix.value = multiply4(
        savedMatrix.value,
        scale(e.scale, e.scale, 1, origin.value)
      );
      updateOnEnd();
    });

  return Gesture.Simultaneous(pan, pinch, rotate);
}
