import {
  Canvas,
  Matrix4,
  notifyChange,
  Path,
  Skia,
  SkPath,
} from "@shopify/react-native-skia";
import { useState } from "react";
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
  const path = Skia.Path.Make();
  const currentPath = useSharedValue(path);
  const [paths, setPaths] = useState<Path[]>([]);
  const matrix = useSharedValue(Matrix4());

  const [drawingMode, setDrawingMode] = useState<DrawingMode>("draw");

  const resetCanvasVariables = () => {
    currentPath.value = Skia.Path.Make();
    matrix.value = Matrix4();
  };

  const draw = Gesture.Pan()
    .averageTouches(true)
    .maxPointers(1)
    .onBegin((e) => {
      currentPath.value.moveTo(e.x, e.y);
      currentPath.value.lineTo(e.x, e.y);
      notifyChange(currentPath as SharedValue<unknown>);
    })
    .onChange((e) => {
      currentPath.value.lineTo(e.x, e.y);
      notifyChange(currentPath as SharedValue<unknown>);
    })
    .onEnd(() => {
      // Not yet fully implemented

      const width = Math.abs(
        currentPath.value.getPoint(0).x - currentPath.value.getLastPt().x
      );
      const height = Math.abs(
        currentPath.value.getPoint(0).y - currentPath.value.getLastPt().y
      );

      console.log("width", width, "height", height);
      console.log("first", currentPath.value.getPoint(0));
      console.log("last", currentPath.value.getLastPt());

      setPaths([
        ...paths,
        {
          path: currentPath.value.copy(),
          x: currentPath.value.getPoint(0).x,
          y: currentPath.value.getPoint(0).y,
          width,
          height,
          matrix: makeMutable(copyMatrix4(matrix.value)),
        },
      ]);

      resetCanvasVariables();
    })
    .enabled(drawingMode === "draw");

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
      {paths.map((path, i) => (
        <PathObject
          key={i}
          x={path.x}
          y={path.y}
          width={path.width}
          height={path.height}
          matrix={path.matrix}
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
            resetCanvasVariables();
          }}
        />
      </View>
    </GestureHandlerRootView>
  );
}
