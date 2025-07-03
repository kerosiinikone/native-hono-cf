import useTransformGestures, {
  multiply,
} from "@/features/hooks/useTransformGestures";
import { CElement } from "@/state/c_canvas";
import { withSkia_useCanvasStore } from "@/state/with_skia";
import {
  convertToAffineMatrix,
  convertToColumnMajor,
  Matrix4,
} from "@shopify/react-native-skia";
import { memo, useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { translate } from "react-native-redash";

interface SelectPathProps {
  elementRef: CElement;
  deleteElement: (el: CElement) => void;
}

const DELETION_THRESHOLD = 50;

export function isAtBottomLeft(
  x: number,
  y: number,
  windowHeight: number
): boolean {
  return x <= DELETION_THRESHOLD && y >= windowHeight - DELETION_THRESHOLD;
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

export default memo(function ({ elementRef, deleteElement }: SelectPathProps) {
  const { x, y, focalX, focalY, width, height, matrix } = elementRef;
  const { height: windowH } = useWindowDimensions();
  const { hasChanged, elementBeingDragged } = withSkia_useCanvasStore(
    (state) => state
  );
  const canvasMatrix = withSkia_useCanvasStore((state) => state.canvasMatrix);
  const hasChangedView = useSharedValue(hasChanged ? 1 : 0);
  const pointerPos = useSharedValue({
    x: 0,
    y: 0,
  });
  const gesture = useTransformGestures({
    element: elementRef,
    deleteElement,
    pointerPos,
  });

  useEffect(() => {
    hasChangedView.value = hasChanged ? 1 : 0;
  }, [hasChanged, hasChangedView]);

  const style = useAnimatedStyle(() => {
    const isBeingDeleted =
      isAtBottomLeft(pointerPos.value.x, pointerPos.value.y, windowH) &&
      elementRef === elementBeingDragged;
    // To trigger a rerender (sharedvalue change)
    const _ = hasChangedView.value;
    return {
      ...trivStyles.path,
      backgroundColor: isBeingDeleted
        ? "rgba(150, 0, 0, 0.5)"
        : "rgba(0, 0, 0, 0.5)",
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
  }, [
    x.value,
    y.value,
    focalX.value,
    focalY.value,
    width.value,
    height.value,
    matrix.value,
    canvasMatrix,
  ]);

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
