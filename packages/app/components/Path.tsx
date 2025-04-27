import {
  convertToAffineMatrix,
  convertToColumnMajor,
  Matrix4,
  rotateZ,
  scale,
} from "@shopify/react-native-skia";
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
}: {
  matrix: SharedValue<Matrix4>;
  x: number;
  y: number;
  width: number;
  height: number;
}) => {
  const savedMatrix = useSharedValue(Matrix4());
  const origin = useSharedValue({ x: 0, y: 0 });

  const pan = Gesture.Pan().onChange((e) => {
    matrix.value = multiply4(translate(e.changeX, e.changeY, 0), matrix.value);
  });

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
    });

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
    });

  const gesture = Gesture.Simultaneous(pan, pinch, rotate);

  const style = useAnimatedStyle(() => {
    const m = multiply4(translate(x, y, 0), matrix.value);
    const m4 = convertToColumnMajor(m);
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
