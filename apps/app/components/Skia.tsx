import { SERVER_URL } from "@/constants/server";
import {
  DocumentState,
  MessageType,
  PathElement,
  WSMessage,
} from "@native-hono-cf/shared";
import {
  Canvas,
  Group,
  Matrix4,
  notifyChange,
  Path,
  Skia,
  SkPath,
} from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import { Button, View } from "react-native";
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

type DrawingMode = "draw" | "select" | "move";

type Path = {
  path: SkPath;
  x: number;
  y: number;
  focalX: number;
  focalY: number;
  width: number;
  height: number;
  matrix: SharedValue<Matrix4>;
};

const BUFFER_INTERVAL = 100;

function copyMatrix4(m: Matrix4): Matrix4 {
  return [
    m[0],
    m[1],
    m[2],
    m[3],
    m[4],
    m[5],
    m[6],
    m[7],
    m[8],
    m[9],
    m[10],
    m[11],
    m[12],
    m[13],
    m[14],
    m[15],
  ];
}

export default function SkiaComponent() {
  // InitPaths()

  const socketRef = useRef<WebSocket | null>(null);
  const documentId = useRef<string>("289d4f3c-3617-45cb-a696-15ed24386388"); // Test value
  const bufferedEvents = useRef<WSMessage[]>([]);

  const path = Skia.Path.Make();

  const currentPath = useSharedValue(path);
  const matrix = useSharedValue(Matrix4());
  const canvasMatrix = useSharedValue(Matrix4());
  const currentPathDimensions = useSharedValue({
    xup: 0,
    xdown: 0,
    yup: 0,
    ydown: 0,
  });

  const [appState, setAppState] = useState<DocumentState>({ elements: [] });
  const [paths, setPaths] = useState<Path[]>([]);
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

      setPaths([...paths, newPath]);

      const newPathElement = {
        id: crypto.randomUUID(),
        type: "path",
        properties: {
          ...newPath,
          path: newPath.path.toSVGString(),
          matrix: newPath.matrix.value,
        },
      } as PathElement;

      const newAppState = {
        elements: appState.elements.concat([newPathElement]),
      } as DocumentState;

      setAppState(newAppState);

      bufferedEvents.current.push({
        type: MessageType.STATE,
        payload: newAppState,
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

  useEffect(() => {
    socketRef.current = new WebSocket(
      `ws://${SERVER_URL}/api/ws/${documentId.current}`
    );

    const socket = socketRef.current;

    if (socket) {
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data) as WSMessage;

        switch (data.type) {
          case MessageType.STATE:
            if (data.payload && typeof data.payload !== "string") {
              const newPaths = data.payload?.elements
                ?.filter((el: any) => el.type === "path")
                .map((el: any) => {
                  const pathElement = el as PathElement;
                  return {
                    ...pathElement.properties,
                    path: Skia.Path.MakeFromSVGString(
                      pathElement.properties.path
                    ),
                    matrix: makeMutable(
                      copyMatrix4(pathElement.properties.matrix)
                    ),
                  };
                })
                .filter(Boolean) as Path[];

              setAppState(data.payload as DocumentState);
              setPaths(newPaths);
            }
        }
      };
      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            type: MessageType.SETUP,
          })
        );
      };
    }

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, []);

  // Buffer
  useEffect(() => {
    const interval = setInterval(() => {
      if (bufferedEvents.current.length > 0) {
        const event = bufferedEvents.current.pop();
        if (event) {
          socketRef.current?.send(JSON.stringify(event));
        }
        bufferedEvents.current = [];
      }
    }, BUFFER_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={drawingMode === "draw" ? draw : combined}>
        <Canvas style={{ height: "100%" }}>
          <Group transform={transform}>
            {paths.map((path, i) => (
              <Path
                key={i}
                path={path.path}
                matrix={path.matrix}
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
        paths.map((path, i) => (
          <PathObject
            key={i}
            x={path.x}
            y={path.y}
            focalX={path.focalX}
            focalY={path.focalY}
            width={path.width}
            canvasMatrix={canvasMatrix}
            height={path.height}
            matrix={path.matrix}
            updatePath={(params: Matrix4) => {
              const newAppState = {
                elements: appState.elements.map((el, j) => {
                  if (j === i) {
                    return {
                      ...el,
                      properties: {
                        ...el.properties,
                        matrix: params,
                      },
                    };
                  }
                  return el;
                }),
              } as DocumentState;

              setAppState(newAppState);

              bufferedEvents.current.push({
                type: MessageType.STATE,
                payload: newAppState,
              });
            }}
          />
        ))}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
          backgroundColor: "rgba(200, 200, 200, 0.8)",
          paddingVertical: 8,
          paddingHorizontal: 10,
          zIndex: 1,
          top: 0,
          borderBottomWidth: 1,
          borderBottomColor: "#ccc",
        }}
      >
        <Button title="Draw" onPress={() => setDrawingMode("draw")} />
        <Button title="Move" onPress={() => setDrawingMode("move")} />
        <Button title="Select" onPress={() => setDrawingMode("select")} />
      </View>
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
          backgroundColor: "rgba(200, 200, 200, 0.8)",
          paddingVertical: 8,
          paddingHorizontal: 10,
          zIndex: 1,
          bottom: 0,
          borderTopWidth: 1,
          borderTopColor: "#ccc",
        }}
      >
        <Button
          title="Undo"
          onPress={() => {
            // TODO: Only pop the updates that the client has made itself
            setPaths(paths.slice(0, paths.length - 1));
            const newAppState = {
              elements: appState.elements.slice(
                0,
                appState.elements.length - 1
              ),
            };

            setAppState(newAppState);

            bufferedEvents.current.push({
              type: MessageType.STATE,
              payload: newAppState,
            });

            resetCanvasVariables();
          }}
        />
      </View>
    </GestureHandlerRootView>
  );
}
