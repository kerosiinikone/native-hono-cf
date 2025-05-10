import {
  Canvas,
  Group,
  Matrix4,
  notifyChange,
  Path,
  Skia,
} from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import PathObject from "../Path";
import { ClientPathElement, useDocumentStore } from "@/state/store";
import {
  makeMutable,
  SharedValue,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { multiply4, translate } from "react-native-redash";
import { MessageCommand } from "@native-hono-cf/shared";

interface SkiaCnProps {
  sendLocalState: <T extends ClientPathElement>(
    type: MessageCommand,
    payload: T
  ) => void;
}

export default function SkiaCn({ sendLocalState }: SkiaCnProps) {
  const {
    canvasMatrix,
    drawingMode,
    elements,
    updateElementMatrix,
    addElement,
  } = useDocumentStore((state) => state);

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
      const width = Math.abs(
        currentPathDimensions.value.xup - currentPathDimensions.value.xdown
      );
      const height = Math.abs(
        currentPathDimensions.value.yup - currentPathDimensions.value.ydown
      );

      const newPath = {
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
      };

      sendLocalState(
        MessageCommand.ADD,
        addElement({
          ...newPath,
          matrix: newPath.matrix,
        })
      );

      resetCanvasVariables();
    })
    .enabled(drawingMode === "draw");

  const canvasPanGesture = Gesture.Pan()
    .averageTouches(true)
    .maxPointers(1)
    .onChange((e) => {
      "worklet";
      canvasMatrix.value = multiply4(
        translate(e.changeX, e.changeY, 0),
        canvasMatrix.value
      );
    });

  const transform = useDerivedValue(() => {
    return [{ matrix: canvasMatrix.value }];
  });

  const gesture = drawingMode === "draw" ? drawingGesture : canvasPanGesture;

  return (
    <>
      <GestureDetector gesture={gesture}>
        <Canvas style={{ height: "100%" }}>
          <Group transform={transform}>
            {elements.map((el, i) => (
              <Path
                key={i}
                path={el.properties.path}
                matrix={el.properties.matrix}
                style="stroke"
                strokeWidth={5}
                strokeCap="round"
                strokeJoin="round"
              />
            ))}
          </Group>
          <Path
            path={currentPath}
            style="stroke"
            strokeWidth={5}
            strokeCap="round"
            strokeJoin="round"
          ></Path>
        </Canvas>
      </GestureDetector>
      {drawingMode === "select" &&
        elements.map((el, i) => (
          <PathObject
            key={i}
            {...el.properties}
            canvasMatrix={canvasMatrix}
            updatePath={(params: Matrix4) => {
              updateElementMatrix(el.id, params);
              sendLocalState(MessageCommand.UPDATE, el);
            }}
          />
        ))}
    </>
  );
}
