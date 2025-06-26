import { CElement } from "@/state/c_canvas";
import { withSkia_useCanvasStore } from "@/state/with_skia";
import { Matrix4, rotateZ, scale } from "@shopify/react-native-skia";
import { useCallback } from "react";
import { Gesture, SimultaneousGesture } from "react-native-gesture-handler";
import { SharedValue, useSharedValue } from "react-native-reanimated";
import { multiply4, translate } from "react-native-redash";

enum DragDirection {
  NONE = "none",
  LEFT = "left",
  RIGHT = "right",
  UP = "up",
  DOWN = "down",
}

interface TransformGesturesProps {
  element: CElement;
  matrix: SharedValue<Matrix4>;
  x: number;
  y: number;
  focalX: number;
  focalY: number;
  width: number;
  height: number;
  stretchable: boolean;
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
  element,
  matrix,
  x,
  y,
  focalX,
  focalY,
  width,
  height,
  stretchable,
}: TransformGesturesProps): SimultaneousGesture {
  const savedMatrix = useSharedValue(Matrix4());
  const origin = useSharedValue({ x: 0, y: 0 });
  const clock = useSharedValue(0);

  const dragDir = useSharedValue<DragDirection>(DragDirection.NONE);

  const performWidthUpdate = (args: any) => {
    if (!args) return;
    element.editRectWidth(Math.max(MIN_WIDTH, args.newWidth), args.x);
  };

  const performHeightUpdate = (args: any) => {
    if (!args) return;
    element.editRectHeight(Math.max(MIN_HEIGHT, args.newHeight), args.y);
  };

  const updateOnEnd = useCallback(() => {
    "worklet";
    updatePath(matrix.value);
  }, [matrix, updatePath]);

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
              newWidth: width + e.changeX * SPEED_FACTOR,
            });
          }
          break;
        case DragDirection.LEFT:
          if (clock.value % THROTTLE_AMOUNT === 0) {
            performWidthUpdate({
              newWidth: width - e.changeX * SPEED_FACTOR,
              x: x + e.changeX * SPEED_FACTOR,
            });
          }
          break;
        case DragDirection.UP:
          if (clock.value % THROTTLE_AMOUNT === 0) {
            performHeightUpdate({
              newHeight: height - e.changeY * SPEED_FACTOR,
              y: y + e.changeY * SPEED_FACTOR,
            });
          }
          break;
        case DragDirection.DOWN:
          if (clock.value % THROTTLE_AMOUNT === 0) {
            performHeightUpdate({
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
        x,
        y,
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
        x,
        y,
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
