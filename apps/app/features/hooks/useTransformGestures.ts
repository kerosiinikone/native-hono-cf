import { Matrix4, rotateZ, scale } from "@shopify/react-native-skia";
import { useCallback } from "react";
import { Gesture, SimultaneousGesture } from "react-native-gesture-handler";
import { SharedValue, useSharedValue } from "react-native-reanimated";
import { multiply4, translate } from "react-native-redash";

interface TransformGesturesProps {
  matrix: SharedValue<Matrix4>;
  focalX: number;
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
  focalX,
  focalY,
}: TransformGesturesProps): SimultaneousGesture {
  const savedMatrix = useSharedValue(Matrix4());
  const origin = useSharedValue({ x: 0, y: 0 });

  const updateOnEnd = useCallback(() => {
    "worklet";
    updatePath(matrix.value);
  }, [savedMatrix, matrix, updatePath]);

  const pan = Gesture.Pan().onChange((e) => {
    "worklet";
    matrix.value = multiply4(translate(e.changeX, e.changeY, 0), matrix.value);

    // Add buffering here to avoid too many updates?
    updateOnEnd();
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
