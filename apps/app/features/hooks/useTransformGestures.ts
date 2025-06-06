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

// TODO: Optimize the resizing animation and
// make more generic for future shapes !!!

const SPEED_FACTOR = 2;
const MIN_WIDTH = 1;
const MIN_HEIGHT = 1;
const DEFAULT_AREA_OF_INTERACTION = 30;
const THROTTLE_AMOUNT = 10;

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
  const clock = useSharedValue(0);

  const dragDir = useSharedValue<DragDirection>(DragDirection.NONE);

  const performWidthUpdate = (args: any) => {
    if (!args) return;
    editRectWidth(args.id, Math.max(MIN_WIDTH, args.newWidth), args.x);
  };

  const performHeightUpdate = (args: any) => {
    if (!args) return;
    editRectHeight(args.id, Math.max(MIN_HEIGHT, args.newHeight), args.y);
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
        if (Math.abs(width - e.x) < DEFAULT_AREA_OF_INTERACTION) {
          dragDir.value = DragDirection.RIGHT;
        } else if (Math.abs(height - e.y) < DEFAULT_AREA_OF_INTERACTION) {
          dragDir.value = DragDirection.DOWN;
        } else if (e.x < DEFAULT_AREA_OF_INTERACTION) {
          dragDir.value = DragDirection.LEFT;
        } else if (
          Math.abs(height - e.y) >
          Math.abs(height - DEFAULT_AREA_OF_INTERACTION)
        ) {
          dragDir.value = DragDirection.UP;
        }
      }
    })
    .onChange((e) => {
      "worklet";

      clock.value += 1; // Simple throttling

      switch (dragDir.value) {
        case DragDirection.NONE:
          matrix.value = multiply4(
            translate(e.changeX, e.changeY, 0),
            matrix.value
          );
          updateOnEnd();
          break;
        case DragDirection.RIGHT:
          if (clock.value % THROTTLE_AMOUNT === 0) {
            performWidthUpdate({
              id,
              newWidth: width + e.changeX * SPEED_FACTOR,
            });
          }
          break;
        case DragDirection.LEFT:
          if (clock.value % THROTTLE_AMOUNT === 0) {
            performWidthUpdate({
              id,
              newWidth: width - e.changeX * SPEED_FACTOR,
              x: x + e.changeX * SPEED_FACTOR,
            });
          }
          break;
        case DragDirection.UP:
          if (clock.value % THROTTLE_AMOUNT === 0) {
            performHeightUpdate({
              id,
              newHeight: height - e.changeY * SPEED_FACTOR,
              y: y + e.changeY * SPEED_FACTOR,
            });
          }
          break;
        case DragDirection.DOWN:
          if (clock.value % THROTTLE_AMOUNT === 0) {
            performHeightUpdate({
              id,
              newHeight: height + e.changeY * SPEED_FACTOR,
            });
          }
          break;
        default:
          console.warn("Unknown drag direction", dragDir);
          break;
      }
    })
    .onEnd(() => {
      "worklet";
      if (dragDir.value !== DragDirection.NONE) {
        dragDir.value = DragDirection.NONE;
        updateOnEnd();
      }
    });

  // Matrix rotation causes edge dragging issues -> deal with it later
  // One option is the deapply the rotation to the matrix and the apply it back after
  // the edge dragging is done ???

  Gesture.Rotation()
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

  return Gesture.Simultaneous(pan, pinch);
}
