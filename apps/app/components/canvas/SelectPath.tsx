import useTransformGestures, {
  multiply,
} from "@/features/hooks/useTransformGestures";
import { ElementType } from "@native-hono-cf/shared";
import {
  convertToAffineMatrix,
  convertToColumnMajor,
  Matrix4,
} from "@shopify/react-native-skia";
import { StyleSheet } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { translate } from "react-native-redash";

interface SelectPathProps {
  matrix: SharedValue<Matrix4>;
  canvasMatrix: SharedValue<Matrix4>;
  x: number;
  y: number;
  focalX: number;
  id: string;
  pathType: ElementType;
  focalY: number;
  stretchable: boolean;
  width: number;
  height: number;

  updatePath: (params: Matrix4) => void;
}

function computeFinalTransformMatrix(
  canvasMatrix: SharedValue<Matrix4>,
  matrix: SharedValue<Matrix4>,
  focalX: number,
  focalY: number
): number[] {
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

function isCircle(type: ElementType): boolean {
  return type === ElementType.Circle;
}

export default function SelectPath({
  matrix,
  x,
  y,
  stretchable,
  width,
  focalX,
  pathType,
  focalY,
  id,
  height,
  canvasMatrix,
  updatePath,
}: SelectPathProps) {
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
    ...trivStyles.path,
    left: x - (isCircle(pathType) ? width / 2 : 0),
    top: y - (isCircle(pathType) ? height / 2 : 0),
    width,
    height,
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

const trivStyles = StyleSheet.create({
  path: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
});
