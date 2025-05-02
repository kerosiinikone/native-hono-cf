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

const PathObject = ({
  matrix,
  x,
  y,
  width,
  height,
  canvasMatrix,
  updatePath,
}: {
  matrix: SharedValue<Matrix4>;
  canvasMatrix: SharedValue<Matrix4>;
  x: number;
  y: number;
  width: number;
  height: number;
  updatePath: (params: Matrix4) => void;
}) => {
  const savedMatrix = useSharedValue(Matrix4());
  const origin = useSharedValue({ x: 0, y: 0 });

  const updateOnEnd = useCallback(() => {
    updatePath(matrix.value);
  }, [savedMatrix, matrix, updatePath]);

  const pan = Gesture.Pan()
    .onChange((e) => {
      matrix.value = multiply4(
        translate(e.changeX, e.changeY, 0),
        matrix.value
      );
    })
    .onEnd(updateOnEnd)
    .runOnJS(true);

  const rotate = Gesture.Rotation()
    .onBegin((e) => {
      origin.value = { x: e.anchorX, y: e.anchorY };
      savedMatrix.value = matrix.value;
    })
    .onChange((e) => {
      matrix.value = multiply4(
        savedMatrix.value,
        rotateZ(e.rotation, origin.value)
      );
    })
    .onEnd(updateOnEnd)
    .runOnJS(true);

  const pinch = Gesture.Pinch()
    .onBegin((e) => {
      origin.value = { x: e.focalX, y: e.focalY };
      savedMatrix.value = matrix.value;
    })
    .onChange((e) => {
      matrix.value = multiply4(
        savedMatrix.value,
        scale(e.scale, e.scale, 1, origin.value)
      );
    })
    .onEnd(updateOnEnd)
    .runOnJS(true);

  const gesture = Gesture.Simultaneous(pan, pinch, rotate);

  const style = useAnimatedStyle(() => {
    const m = multiply4(translate(x, y, 0), matrix.value);
    const shiftedM = multiply4(
      translate(canvasMatrix.value[3], canvasMatrix.value[7], 0),
      m
    );
    const m4 = convertToColumnMajor(shiftedM);

    return {
      position: "absolute",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      width: width,
      height: height,
      top: 0,
      left: 0,
      transform: [
        {
          matrix: convertToAffineMatrix(m4),
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
