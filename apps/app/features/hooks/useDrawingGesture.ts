import { ClientElement, ClientObject, useDocumentStore } from "@/state/store";
import { MessageCommand, StateMessageCommands } from "@native-hono-cf/shared";
import {
  Matrix4,
  notifyChange,
  Skia,
  SkPath,
} from "@shopify/react-native-skia";
import { Gesture, PanGesture } from "react-native-gesture-handler";
import {
  makeMutable,
  SharedValue,
  useSharedValue,
} from "react-native-reanimated";
import { multiply4, translate } from "react-native-redash";

interface DrawingGestureProps {
  sendLocalState: <T extends ClientElement>(
    type: StateMessageCommands,
    payload: T
  ) => void;
}

function generateNewPath(
  currentPath: SharedValue<SkPath>,
  currentPathDimensions: SharedValue<{
    xup: number;
    xdown: number;
    yup: number;
    ydown: number;
  }>,
  matrix: SharedValue<Matrix4>,
  canvasMatrix: SharedValue<Matrix4>
): ClientObject {
  let width = Math.abs(
    currentPathDimensions.value.xup - currentPathDimensions.value.xdown
  );
  let height = Math.abs(
    currentPathDimensions.value.yup - currentPathDimensions.value.ydown
  );

  if (width < 50) {
    currentPathDimensions.value.xup += 20;
    currentPathDimensions.value.xdown -= 20;

    width = Math.abs(
      currentPathDimensions.value.xup - currentPathDimensions.value.xdown
    );
  }

  if (height < 50) {
    currentPathDimensions.value.yup += 20;
    currentPathDimensions.value.ydown -= 20;

    height = Math.abs(
      currentPathDimensions.value.yup - currentPathDimensions.value.ydown
    );
  }

  return {
    path: currentPath.value.copy(),
    x: Math.min(
      currentPathDimensions.value.xup,
      currentPathDimensions.value.xdown
    ),
    y: Math.min(
      currentPathDimensions.value.yup,
      currentPathDimensions.value.ydown
    ),
    focalX:
      Math.min(
        currentPathDimensions.value.xup,
        currentPathDimensions.value.xdown
      ) +
      width / 2,
    focalY:
      Math.min(
        currentPathDimensions.value.yup,
        currentPathDimensions.value.ydown
      ) +
      height / 2,
    width,
    height,
    matrix: makeMutable(
      multiply4(
        matrix.value,
        translate(-canvasMatrix.value[3], -canvasMatrix.value[7], 0)
      )
    ),
    stretchable: false,
  };
}

export default function useDrawingGesture({
  sendLocalState,
}: DrawingGestureProps): {
  drawingGesture: PanGesture;
  currentPath: SharedValue<SkPath>;
} {
  const { canvasMatrix, addElement } = useDocumentStore((state) => state);

  const path = Skia.Path.Make();
  const currentPath = useSharedValue(path);
  const matrix = useSharedValue(Matrix4());
  const currentPathDimensions = useSharedValue({
    xup: 0,
    xdown: 0,
    yup: 0,
    ydown: 0,
  });

  const resetCanvasVariables = () => {
    currentPath.value = Skia.Path.Make();
    matrix.value = Matrix4();
  };

  const drawingGesture = Gesture.Pan()
    .averageTouches(true)
    .maxPointers(1)
    .onBegin((e) => {
      "worklet";
      currentPath.value.moveTo(e.x, e.y);
      currentPath.value.lineTo(e.x, e.y);

      currentPathDimensions.value.xup = e.x;
      currentPathDimensions.value.xdown = e.x;
      currentPathDimensions.value.yup = e.y;
      currentPathDimensions.value.ydown = e.y;

      notifyChange(currentPath as SharedValue<unknown>);
    })
    .onChange((e) => {
      "worklet";
      if (e.y > currentPathDimensions.value.yup) {
        currentPathDimensions.value.yup = e.y;
      } else if (e.y < currentPathDimensions.value.ydown) {
        currentPathDimensions.value.ydown = e.y;
      }

      if (e.x > currentPathDimensions.value.xup) {
        currentPathDimensions.value.xup = e.x;
      } else if (e.x < currentPathDimensions.value.xdown) {
        currentPathDimensions.value.xdown = e.x;
      }

      currentPath.value.lineTo(e.x, e.y);
      notifyChange(currentPath as SharedValue<unknown>);
    })
    .onEnd(async () => {
      "worklet";
      const newPath = generateNewPath(
        currentPath,
        currentPathDimensions,
        matrix,
        canvasMatrix
      );

      sendLocalState(MessageCommand.ADD, addElement(newPath));

      resetCanvasVariables();
    });

  return { drawingGesture, currentPath };
}
