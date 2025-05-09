import { useWebSocket } from "@/hooks/useWebSocket";
import {
  ClientPathElement,
  DrawingMode,
  transferClientPathToServer,
  useDocumentStore,
} from "@/state/store";
import { MessageCommand, MessageType } from "@native-hono-cf/shared";
import {
  Canvas,
  Group,
  Matrix4,
  notifyChange,
  Path,
  Skia,
} from "@shopify/react-native-skia";
import { useCallback, useState } from "react";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import {
  makeMutable,
  SharedValue,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { multiply4, translate } from "react-native-redash";
import PathObject from "./Path";
import { CanvasPointerMode } from "./ui/CanvasPointerMode";
import Toolbar from "./ui/Toolbar";

export default function SkiaComponent() {
  // InitPaths()

  const {
    documentId,
    setLocalFromServerState,
    canvasMatrix,
    elements,
    addElement,
    updateElementMatrix,
    removeElement,
  } = useDocumentStore((state) => state);

  // Central state lib later
  const setDocumentState = useCallback(setLocalFromServerState, [documentId]);

  const ws = useWebSocket({
    documentId: documentId,
    onStateReceived: setDocumentState,
  });

  const path = Skia.Path.Make();
  const currentPath = useSharedValue(path);
  const matrix = useSharedValue(Matrix4());
  const currentPathDimensions = useSharedValue({
    xup: 0,
    xdown: 0,
    yup: 0,
    ydown: 0,
  });

  const [drawingMode, setDrawingMode] = useState<DrawingMode>("draw");

  const resetCanvasVariables = () => {
    currentPath.value = Skia.Path.Make();
    matrix.value = Matrix4();
  };

  const draw = Gesture.Pan()
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

      const newElement = addElement({
        ...newPath,
        matrix: newPath.matrix,
      });

      ws.bufferMessage({
        type: MessageType.STATE,
        method: MessageCommand.ADD,
        payload: transferClientPathToServer(newElement),
      });

      resetCanvasVariables();
    })
    .enabled(drawingMode === "draw");

  const move = Gesture.Pan()
    .averageTouches(true)
    .maxPointers(1)
    .onChange((e) => {
      "worklet";
      canvasMatrix.value = multiply4(
        translate(e.changeX, e.changeY, 0),
        canvasMatrix.value
      );
    });

  const combined = Gesture.Simultaneous(move);

  const transform = useDerivedValue(() => {
    return [{ matrix: canvasMatrix.value }];
  });

  const undo = () => {
    // TODO: Only pop the updates that the client has made itself
    if (!elements.length) return;

    const lastElement = removeElement(
      (elements[elements.length - 1] as ClientPathElement).id
    );

    if (!lastElement) return;

    ws.bufferMessage({
      type: MessageType.STATE,
      method: MessageCommand.DELETE,
      payload: transferClientPathToServer(lastElement),
    });

    resetCanvasVariables();
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={drawingMode === "draw" ? draw : combined}>
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
            x={el.properties.x}
            y={el.properties.y}
            focalX={el.properties.focalX}
            focalY={el.properties.focalY}
            width={el.properties.width}
            canvasMatrix={canvasMatrix}
            height={el.properties.height}
            matrix={el.properties.matrix}
            updatePath={(params: Matrix4) => {
              updateElementMatrix(el.id, params);

              // Laggy?
              ws.bufferMessage({
                type: MessageType.STATE,
                method: MessageCommand.UPDATE,
                payload: transferClientPathToServer(el),
              });
            }}
          />
        ))}
      <CanvasPointerMode
        setModeDraw={() => setDrawingMode("draw")}
        setModeMove={() => setDrawingMode("move")}
        setModeSelect={() => setDrawingMode("select")}
      />
      <Toolbar undo={undo} />
    </GestureHandlerRootView>
  );
}
