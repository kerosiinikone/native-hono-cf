import {
  Canvas,
  Group,
  notifyChange,
  Path,
  Skia,
  SkPath,
} from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SharedValue, useSharedValue } from "react-native-reanimated";

export default function HomeScreen() {
  const path = Skia.Path.Make();
  const currentPath = useSharedValue(path.moveTo(0, 0));
  const paths = useSharedValue([] as SharedValue<SkPath>[]);

  const removePath = () => {
    paths.value.pop();
    paths.value.forEach((path) => {
      path.value = Skia.Path.Make();
      notifyChange(path as SharedValue<unknown>);
    });
  };

  const pan = Gesture.Pan()
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
      paths.set((prev) => [...prev, currentPath]);
      removePath();
    });

  return (
    <GestureDetector gesture={pan}>
      <Canvas style={{ width: 1000, height: 1000 }}>
        <Group>
          {paths.value.map((path, index) => (
            <Path
              key={index}
              path={path}
              style="stroke"
              strokeWidth={20}
              strokeCap="round"
              strokeJoin="round"
            />
          ))}
        </Group>
      </Canvas>
    </GestureDetector>
  );
}
