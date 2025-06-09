import {
  ClientElement,
  ClientObject,
  withSkia_useCanvasStore,
} from "@/state/with-skia";
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

const MIN_DIMENSION_SIZE = 50;
const DIMENSION_ADJUSTMENT = 20;

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
  "worklet";
  const pathDimensions = currentPathDimensions.value;

  let width = Math.abs(pathDimensions.xup - pathDimensions.xdown);
  let height = Math.abs(pathDimensions.yup - pathDimensions.ydown);

  if (width < MIN_DIMENSION_SIZE) {
    pathDimensions.xup += DIMENSION_ADJUSTMENT;
    pathDimensions.xdown -= DIMENSION_ADJUSTMENT;
    width = Math.abs(pathDimensions.xup - pathDimensions.xdown);
  }

  if (height < MIN_DIMENSION_SIZE) {
    pathDimensions.yup += DIMENSION_ADJUSTMENT;
    pathDimensions.ydown -= DIMENSION_ADJUSTMENT;
    height = Math.abs(pathDimensions.yup - pathDimensions.ydown);
  }

  const x = Math.min(pathDimensions.xup, pathDimensions.xdown);
  const y = Math.min(pathDimensions.yup, pathDimensions.ydown);

  const focalX = x + width / 2;
  const focalY = y + height / 2;

  const transformedMatrix = makeMutable(
    multiply4(
      matrix.value,
      translate(-canvasMatrix.value[3], -canvasMatrix.value[7], 0)
    )
  );

  return {
    path: currentPath.value.copy(),
    x,
    y,
    focalX,
    focalY,
    width,
    height,
    matrix: transformedMatrix,
    stretchable: false,
  };
}

export default function useDrawingGesture({
  sendLocalState,
}: DrawingGestureProps): {
  drawingGesture: PanGesture;
  currentPath: SharedValue<SkPath>;
} {
  const { canvasMatrix, addElement } = withSkia_useCanvasStore(
    (state) => state
  );

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
