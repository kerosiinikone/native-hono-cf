import { SELECT, TRANSFORM } from "@/constants";
import { CElement } from "@/state/c_canvas";
import { withSkia_useCanvasStore } from "@/state/with_skia";
import { Matrix4, rotateZ, scale } from "@shopify/react-native-skia";
import { useCallback } from "react";
import { useWindowDimensions } from "react-native";
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

export function isAtBottomLeft(
  x: number,
  y: number,
  windowHeight: number
): boolean {
  "worklet";
  return (
    x <= SELECT.DELETION_THRESHOLD &&
    y >= windowHeight - SELECT.DELETION_THRESHOLD
  );
}

export function multiply(...matrices: Matrix4[]) {
  "worklet";
  return matrices.reduce((acc, matrix) => multiply4(acc, matrix), Matrix4());
}

export default function useTransformGestures({
  element,
  deleteElement,
  pointerPos,
}: {
  element: CElement;
  pointerPos: SharedValue<{ x: number; y: number }>;
  deleteElement: (el: CElement) => void;
}): SimultaneousGesture {
  const {
    setElementBeingDragged,
    unsetElementBeingDragged,
    elementBeingDragged,
    appendToRedoBuffer,
    notifyLocalChange,
  } = withSkia_useCanvasStore((state) => state);

  const savedMatrix = useSharedValue(Matrix4());
  const origin = useSharedValue({ x: 0, y: 0 });
  const clock = useSharedValue(0);
  const dragDir = useSharedValue<DragDirection>(DragDirection.NONE);

  const {
    DEFAULT_AREA_OF_INTERACTION,
    MIN_HEIGHT,
    MIN_WIDTH,
    SPEED_FACTOR,
    THROTTLE_AMOUNT,
  } = TRANSFORM;

  const { x, y, focalX, focalY, width, height, matrix } = element;
  const { height: heightW } = useWindowDimensions();

  const performWidthUpdate = (args: { newWidth: number; x?: number }) => {
    "worklet";
    if (!args) return;
    element.editRectWidth(Math.max(MIN_WIDTH, args.newWidth), args.x);
    notifyLocalChange();
  };

  const performHeightUpdate = (args: { newHeight: number; y?: number }) => {
    "worklet";
    if (!args) return;
    element.editRectHeight(Math.max(MIN_HEIGHT, args.newHeight), args.y);
    notifyLocalChange();
  };

  const updateOnEnd = useCallback(() => {
    "worklet";
    element.setMatrix(matrix.value.value);
    notifyLocalChange();
  }, [matrix, element]);

  const pan = Gesture.Pan()
    .averageTouches(true)
    .maxPointers(1)
    .onBegin((e) => {
      "worklet";
      if (element.isStretchable()) {
        if (Math.abs(width.value - e.x) < DEFAULT_AREA_OF_INTERACTION) {
          dragDir.value = DragDirection.RIGHT;
        } else if (Math.abs(height.value - e.y) < DEFAULT_AREA_OF_INTERACTION) {
          dragDir.value = DragDirection.DOWN;
        } else if (e.x < DEFAULT_AREA_OF_INTERACTION) {
          dragDir.value = DragDirection.LEFT;
        } else if (
          Math.abs(height.value - e.y) >
          Math.abs(height.value - DEFAULT_AREA_OF_INTERACTION)
        ) {
          dragDir.value = DragDirection.UP;
        }
      }
      if (dragDir.value === DragDirection.NONE) setElementBeingDragged(element);
    })
    .onChange((e) => {
      "worklet";
      // Simple throttling
      clock.value += 1;
      switch (dragDir.value) {
        case DragDirection.NONE:
          matrix.value.value = multiply4(
            translate(e.changeX, e.changeY, 0),
            matrix.value.value
          );
          pointerPos.value = {
            x: e.absoluteX,
            y: e.absoluteY,
          };
          updateOnEnd();
          break;
        case DragDirection.RIGHT:
          if (clock.value % THROTTLE_AMOUNT === 0) {
            performWidthUpdate({
              newWidth: width.value + e.changeX * SPEED_FACTOR,
            });
          }
          break;
        case DragDirection.LEFT:
          if (clock.value % THROTTLE_AMOUNT === 0) {
            performWidthUpdate({
              newWidth: width.value - e.changeX * SPEED_FACTOR,
              x: x.value + e.changeX * SPEED_FACTOR,
            });
          }
          break;
        case DragDirection.UP:
          if (clock.value % THROTTLE_AMOUNT === 0) {
            performHeightUpdate({
              newHeight: height.value - e.changeY * SPEED_FACTOR,
              y: y.value + e.changeY * SPEED_FACTOR,
            });
          }
          break;
        case DragDirection.DOWN:
          if (clock.value % THROTTLE_AMOUNT === 0) {
            performHeightUpdate({
              newHeight: height.value + e.changeY * SPEED_FACTOR,
            });
          }
          break;
      }
    })
    .onEnd((e) => {
      "worklet";
      if (dragDir.value !== DragDirection.NONE) {
        dragDir.value = DragDirection.NONE;
        updateOnEnd();
      }
      if (
        element === elementBeingDragged &&
        isAtBottomLeft(e.absoluteX, e.absoluteY, heightW)
      ) {
        appendToRedoBuffer({
          type: "add",
          element: element,
        });
        deleteElement(element);
      }
      unsetElementBeingDragged();
    });

  // Matrix rotation causes edge dragging issues -> deal with it later
  // One option is the deapply the rotation to the matrix and the apply it back after
  // the edge dragging is done ???

  Gesture.Rotation()
    .onBegin(() => {
      "worklet";
      origin.value = {
        x: focalX.value,
        y: focalY.value,
      };
      savedMatrix.value = matrix.value.value;
    })
    .onChange((e) => {
      "worklet";
      matrix.value.value = multiply4(
        savedMatrix.value,
        rotateZ(e.rotation, origin.value)
      );

      updateOnEnd();
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      "worklet";
      origin.value = {
        x: focalX.value,
        y: focalY.value,
      };
      savedMatrix.value = matrix.value.value;
    })
    .onChange((e) => {
      "worklet";
      matrix.value.value = multiply4(
        savedMatrix.value,
        scale(e.scale, e.scale, 1, origin.value)
      );
      updateOnEnd();
    });

  return Gesture.Simultaneous(pan, pinch);
}
