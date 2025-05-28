import { useDocumentStore } from "@/state/store";
import { Matrix4, rotateZ, scale } from "@shopify/react-native-skia";
import { useCallback, useState } from "react";
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
  height,
  id,
  focalX,
  stretchable,
  focalY,
}: TransformGesturesProps): SimultaneousGesture {
  const { editRectWidth, editRectHeight } = useDocumentStore((state) => state);

  const savedMatrix = useSharedValue(Matrix4());
  const origin = useSharedValue({ x: 0, y: 0 });

  const [dragDir, setDragDir] = useState<DragDirection>(DragDirection.NONE);

  const updateOnEnd = useCallback(() => {
    "worklet";
    updatePath(matrix.value);
  }, [savedMatrix, matrix, updatePath]);

  // Better stretch logic with boolean checks = pressed on start, etc
  const pan = Gesture.Pan()
    .averageTouches(true)
    .maxPointers(1)
    .onBegin((e) => {
      "worklet";
      if (stretchable) {
        if (Math.abs(width / 2 - (e.x - focalX)) < 50) {
          runOnJS(setDragDir)(DragDirection.RIGHT);
        } else if (Math.abs(-height / 2 + (e.y - focalY)) < 50) {
          runOnJS(setDragDir)(DragDirection.DOWN);
        } else if (Math.abs(width / 2 - (focalX - e.x)) < 50) {
          runOnJS(setDragDir)(DragDirection.LEFT);
        } else if (Math.abs(height / 2 - (focalY - e.y)) < 50) {
          runOnJS(setDragDir)(DragDirection.UP);
        }
      }
    })
    .onChange((e) => {
      "worklet";

      // Debounce the updates
      // Update speeds?

      switch (dragDir) {
        case DragDirection.NONE:
          matrix.value = multiply4(
            translate(e.changeX, e.changeY, 0),
            matrix.value
          );
          updateOnEnd();
          break;
        case DragDirection.RIGHT:
          editRectWidth(id, width + e.changeX);
          break;
        case DragDirection.LEFT:
          editRectWidth(id, width - e.changeX, e.changeX);
          break;
        case DragDirection.UP:
          editRectHeight(id, height - e.changeY, e.changeY);
          break;
        case DragDirection.DOWN:
          editRectHeight(id, height + e.changeY);
          break;
        default:
          console.warn("Unknown drag direction:", dragDir);
          break;
      }
    })
    .onEnd(() => {
      "worklet";
      if (dragDir !== DragDirection.NONE) {
        runOnJS(setDragDir)(DragDirection.NONE);
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
