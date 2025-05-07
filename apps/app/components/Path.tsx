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

const multiply = (...matrices: Matrix4[]) => {
  "worklet";
  return matrices.reduce((acc, matrix) => multiply4(acc, matrix), Matrix4());
};

const PathObject = ({
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
}) => {
  const savedMatrix = useSharedValue(Matrix4());
  const origin = useSharedValue({ x: 0, y: 0 });

  const updateOnEnd = useCallback(() => {
    "worklet";
    updatePath(matrix.value);
  }, [savedMatrix, matrix, updatePath]);

  const pan = Gesture.Pan()
    .onChange((e) => {
      "worklet";
      matrix.value = multiply4(
        translate(e.changeX, e.changeY, 0),
        matrix.value
      );

      // Add buffering here to avoid too many updates
      updatePath(matrix.value);
    })
    .onEnd(updateOnEnd);

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
    })
    .onEnd(updateOnEnd);

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
    })
    .onEnd(updateOnEnd);

  const gesture = Gesture.Simultaneous(pan, pinch, rotate);

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
};

export default PathObject;
