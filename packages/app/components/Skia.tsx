import {
  Canvas,
  Matrix4,
  notifyChange,
  Path,
  Skia,
  SkPath,
} from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { Button, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import {
  makeMutable,
  SharedValue,
  useSharedValue,
} from "react-native-reanimated";
import PathObject from "./Path";
import { DocumentState, PathElement } from "@/types/types";

type DrawingMode = "draw" | "select" | "move";

type Path = {
  path: SkPath;
  x: number;
  y: number;
  width: number;
  height: number;
  matrix: SharedValue<Matrix4>;
};

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

export default function HomeScreen() {
  // InitPaths()
  const path = Skia.Path.Make();
  const currentPath = useSharedValue(path);

  const [paths, setPaths] = useState<Path[]>([]);
  const matrix = useSharedValue(Matrix4());

  const [appState, setAppState] = useState<DocumentState>({ elements: [] });

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

  // For abstracting simple state updates with the undo button as well
  // const modifyState = () => {};

  const draw = Gesture.Pan()
    .averageTouches(true)
    .maxPointers(1)
    .onBegin((e) => {
      currentPath.value.moveTo(e.x, e.y);
      currentPath.value.lineTo(e.x, e.y);

      currentPathDimensions.value.xup = e.x;
      currentPathDimensions.value.xdown = e.x;
      currentPathDimensions.value.yup = e.y;
      currentPathDimensions.value.ydown = e.y;

      notifyChange(currentPath as SharedValue<unknown>);
    })
    .onChange((e) => {
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
    .onEnd(() => {
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
        width,
        height,
        matrix: makeMutable(copyMatrix4(matrix.value)),
      };

      setPaths([...paths, newPath]);

      const newPathElement = {
        id: `${crypto.randomUUID()}`,
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

      localStorage.setItem("appState", JSON.stringify(newAppState));

      resetCanvasVariables();
    })
    .enabled(drawingMode === "draw");

  // For testing
  useEffect(() => {
    const stateStr = localStorage.getItem("appState");

    if (stateStr) {
      const parsedData = JSON.parse(stateStr) as DocumentState;

      if (!parsedData.elements) return;

      const newPaths = parsedData.elements
        .filter((el) => el.type === "path")
        .map((el) => {
          const pathElement = el as PathElement;
          return {
            ...pathElement.properties,
            path: Skia.Path.MakeFromSVGString(pathElement.properties.path),
            matrix: makeMutable(copyMatrix4(pathElement.properties.matrix)),
          };
        })
        .filter(Boolean) as Path[];

      setAppState(parsedData);
      setPaths(newPaths);
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={draw}>
        <Canvas style={{ height: "100%" }}>
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
            width={path.width}
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

              localStorage.setItem("appState", JSON.stringify(newAppState));
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
            setPaths(paths.slice(0, paths.length - 1));
            setAppState((prev) => ({
              ...prev,
              elements: prev.elements.slice(0, prev.elements.length - 1),
            }));
            resetCanvasVariables();
          }}
        />
      </View>
    </GestureHandlerRootView>
  );
}
