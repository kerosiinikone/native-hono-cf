import useCanvasPanGesture from "@/features/hooks/useCanvasPanGesture";
import useDrawingGesture from "@/features/hooks/useDrawingGesture";
import { ClientElement, useDocumentStore } from "@/state/store";
import { MessageCommand, StateMessageCommands } from "@native-hono-cf/shared";
import { Canvas, Group, Matrix4, Path } from "@shopify/react-native-skia";
import { StyleSheet } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue } from "react-native-reanimated";
import SelectPath from "./SelectPath";

interface SkiaCnProps {
  sendLocalState: <T extends ClientElement>(
    type: StateMessageCommands,
    payload: T
  ) => void;
}

export default function SkiaCn({ sendLocalState }: SkiaCnProps) {
  const { canvasMatrix, drawingMode, elements, updateElementMatrix } =
    useDocumentStore((state) => state);

  const { drawingGesture, currentPath } = useDrawingGesture({ sendLocalState });
  const canvasPanGesture = useCanvasPanGesture();

  const transform = useDerivedValue(() => {
    return [{ matrix: canvasMatrix.value }];
  });

  const gesture = drawingMode === "draw" ? drawingGesture : canvasPanGesture;

  return (
    <>
      <GestureDetector gesture={gesture}>
        <Canvas style={cnStyles.canvas}>
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
          <SelectPath
            key={i}
            pathType={el.type}
            id={el.id}
            {...el.properties}
            canvasMatrix={canvasMatrix}
            updatePath={(params: Matrix4) => {
              const upEl = updateElementMatrix(el.id, params);
              if (!upEl) return;
              sendLocalState(MessageCommand.UPDATE, upEl);
            }}
          />
        ))}
    </>
  );
}

const cnStyles = StyleSheet.create({
  canvas: { height: "100%" },
});
