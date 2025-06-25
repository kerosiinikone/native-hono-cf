import useCanvasPanGesture from "@/features/hooks/useCanvasPanGesture";
import useDrawingGesture from "@/features/hooks/useDrawingGesture";
import { CanvasDoc } from "@/state/c_canvas";
import { useDocumentStore } from "@/state/document";
import { withSkia_useCanvasStore } from "@/state/with-skia";
import { useCollab } from "@collabs/react";
import { Canvas, Group, Matrix4, Path } from "@shopify/react-native-skia";
import { StyleSheet } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue } from "react-native-reanimated";
import SelectPath from "./SelectPath";

export default function SkiaCn({ doc }: { doc: CanvasDoc }) {
  useCollab(doc.elements);

  const drawingMode = useDocumentStore((state) => state.drawingMode);
  const { canvasMatrix } = withSkia_useCanvasStore((state) => state);

  const { drawingGesture, currentPath } = useDrawingGesture(doc);
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
            {doc?.elements.map((el, i) => (
              <Path
                key={i}
                path={el.path.value}
                matrix={el.matrix.value}
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
        // These has to be calculated as props, not through the ref for some weird reason!
        doc.elements.map((el, i) => (
          <SelectPath
            key={i}
            x={el.posX()}
            y={el.posY()}
            width={el.elementWidth()}
            height={el.elementHeight()}
            type={el.type.value}
            matrix={el.matrix.value}
            stretchable={el.stretchable.value}
            focalX={el.focX()}
            focalY={el.focY()}
            elementRef={el} // TODO: Can also be bound to the rect updates?
            canvasMatrix={canvasMatrix}
            updatePath={(params: Matrix4) =>
              doc.updateElementMatrix(el, params)
            }
          />
        ))}
    </>
  );
}

const cnStyles = StyleSheet.create({
  canvas: { height: "100%" },
});
