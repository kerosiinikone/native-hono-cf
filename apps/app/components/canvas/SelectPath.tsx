import useTransformGestures, {
  multiply,
} from "@/features/hooks/useTransformGestures";
import {
  convertToAffineMatrix,
  convertToColumnMajor,
  Matrix4,
  SkPath,
} from "@shopify/react-native-skia";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { translate } from "react-native-redash";

function computeFinalTransformMatrix(
  canvasMatrix: SharedValue<Matrix4>,
  matrix: SharedValue<Matrix4>,
  focalX: number,
  focalY: number
) {
  const finalMatrix = multiply(canvasMatrix.value, matrix.value);

  const localCenterX = focalX;
  const localCenterY = focalY;

  const transformMatrix = multiply(
    translate(-localCenterX, -localCenterY, 0),
    finalMatrix,
    translate(localCenterX, localCenterY, 0)
  );

  const finalTransformMatrixForStyle = convertToColumnMajor(transformMatrix);
  return convertToAffineMatrix(finalTransformMatrixForStyle);
}

export default function SelectPath({
  matrix,
  x,
  y,
  stretchable,
  width,
  focalX,
  focalY,
  id,
  height,
  canvasMatrix,
  updatePath,
}: {
  matrix: SharedValue<Matrix4>;
  canvasMatrix: SharedValue<Matrix4>;
  x: number;
  y: number;
  focalX: number;
  id: string;
  focalY: number;
  stretchable: boolean;
  width: number;
  height: number;
  updatePath: (params: Matrix4) => void;
}) {
  const gesture = useTransformGestures({
    updatePath, // useCallback?
    matrix,
    focalX,
    width,
    x,
    y,
    id,
    height,
    stretchable,
    focalY,
  });

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    left: x,
    top: y,
    width: width,
    height: height,
    transform: [
      {
        matrix: computeFinalTransformMatrix(
          canvasMatrix,
          matrix,
          focalX,
          focalY
        ),
      },
    ],
  }));

  return (
    <>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[style]} />
      </GestureDetector>
    </>
  );
}
