import {
  Canvas,
  fitbox,
  notifyChange,
  Path,
  processTransform2d,
  rect,
  Skia,
  SkPath,
} from "@shopify/react-native-skia";
import type { SkMatrix } from "@shopify/react-native-skia/lib/typescript/src/skia/types";
import { useState } from "react";
import {
  Button,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
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
import { Mutable } from "react-native-reanimated/lib/typescript/commonTypes";

type DrawingMode = "draw" | "select" | "move";

type Path = {
  path: SkPath;
  matrix?: Mutable<SkMatrix>;
};

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();

  const path = Skia.Path.Make();
  const currentPath = useSharedValue(path.moveTo(0, 0));
  const [paths, setPaths] = useState<Path[]>([]);

  const [drawingMode, setDrawingMode] = useState<DrawingMode>("draw");

  const drawPan = Gesture.Pan()
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
    .onFinalize((e) => {
      const src = rect(0, 0, e.translationX, e.translationY); // Maybe?
      const dst = rect(0, 0, width, height);
      const m3 = processTransform2d(fitbox("contain", src, dst));
      const matrix = makeMutable(m3);

      setPaths([
        ...paths,
        {
          path: currentPath.value.copy(),
          matrix: matrix,
        },
      ]);
    })
    .enabled(drawingMode === "draw");

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={drawPan}>
        <ScrollView
          contentContainerStyle={{
            width,
            height,
          }}
        >
          <Canvas style={{ height: "100%" }}>
            {paths.map((path, i) => (
              <Path
                key={i}
                path={path.path}
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
                setPaths(paths.slice(0, paths.length - 2));
                currentPath.value = Skia.Path.Make().moveTo(0, 0);
              }}
            />
          </View>
        </ScrollView>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
