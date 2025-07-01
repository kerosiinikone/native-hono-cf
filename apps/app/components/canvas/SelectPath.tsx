import useTransformGestures, {
  multiply,
} from "@/features/hooks/useTransformGestures";
import { CElement } from "@/state/c_canvas";
import { withSkia_useCanvasStore } from "@/state/with_skia";
import { memo, useMemo } from "react";
import {
  convertToAffineMatrix,
  convertToColumnMajor,
  Matrix4,
} from "@shopify/react-native-skia";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { translate } from "react-native-redash";

interface SelectPathProps {
  canvasMatrix: SharedValue<Matrix4>;
  elementRef: CElement;
  // x: number;
  // y: number;
  // focalX: number;
  // focalY: number;
  // stretchable: boolean;
  // width: number;
  // matrix: SharedValue<Matrix4>;
  // type: ElementType;
  // height: number;
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

export default memo(function SelectPath({
  elementRef,
  canvasMatrix,
}: SelectPathProps) {
  const hasChanged = withSkia_useCanvasStore((state) => state.hasChanged);
  const hasChangedView = useSharedValue(hasChanged ? 1 : 0);

  useEffect(() => {
    hasChangedView.value = hasChanged ? 1 : 0;
  }, [hasChanged, hasChangedView]);

  const gesture = useTransformGestures({ element: elementRef });

  const { x, y, focalX, focalY, width, height, matrix } = elementRef;

  // TODO: Make this better!!!
  const style = useMemo(
    () => {
      return useAnimatedStyle(() => {
        const _ = hasChangedView.value;
        return {
          ...trivStyles.path,
          left: x.value - (elementRef.isCircle() ? width.value / 2 : 0),
          top: y.value - (elementRef.isCircle() ? height.value / 2 : 0),
          width: width.value,
          height: height.value,
          transform: [
            {
              matrix: computeFinalTransformMatrix(
                canvasMatrix,
                matrix.value,
                focalX.value,
                focalY.value
              ),
            },
          ],
        };
      });
    },
    // Path deps, not the select path deps!
    [
      x.value,
      y.value,
      focalX.value,
      focalY.value,
      width.value,
      height.value,
      matrix.value,
      canvasMatrix,
    ]
  );

  return (
    <>
      <GestureDetector gesture={gesture}>
        <Animated.View style={style} />
      </GestureDetector>
    </>
  );
});

const trivStyles = StyleSheet.create({
  path: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
});
