import useTransformGestures, {
  multiply,
} from "@/features/hooks/useTransformGestures";
import {
  convertToAffineMatrix,
  convertToColumnMajor,
  Matrix4,
  rotateZ,
  scale,
} from "@shopify/react-native-skia";
import { useCallback } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { multiply4, translate } from "react-native-redash";

export default function SelectPath({
  matrix,
  x,
  y,
  width,
  focalX,
  focalY,
  height,
  canvasMatrix,
  updatePath,
}: {
  matrix: SharedValue<Matrix4>;
  canvasMatrix: SharedValue<Matrix4>;
  x: number;
  y: number;
  focalX: number;
  focalY: number;
  width: number;
  height: number;
  updatePath: (params: Matrix4) => void;
}) {
  const gesture = useTransformGestures({
    updatePath, // useCallback?
    matrix,
    focalX,
    focalY,
  });

  const style = useAnimatedStyle(() => {
    const finalMatrix = multiply(canvasMatrix.value, matrix.value);

    const localCenterX = focalX;
    const localCenterY = focalY;

    const transformMatrix = multiply(
      translate(-localCenterX, -localCenterY, 0),
      finalMatrix,
      translate(localCenterX, localCenterY, 0)
    );

    const finalTransformMatrixForStyle = convertToColumnMajor(transformMatrix);

    return {
      position: "absolute",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      left: x,
      top: y,
      width: width,
      height: height,
      transform: [
        {
          matrix: convertToAffineMatrix(finalTransformMatrixForStyle),
        },
      ],
    };
  });

  return (
    <>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[style]} />
      </GestureDetector>
    </>
  );
}
