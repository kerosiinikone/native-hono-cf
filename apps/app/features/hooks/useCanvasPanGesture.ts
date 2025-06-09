import { withSkia_useCanvasStore } from "@/state/with-skia";
import { Gesture, PanGesture } from "react-native-gesture-handler";
import { multiply4, translate } from "react-native-redash";

export default function useCanvasPanGesture(): PanGesture {
  const { canvasMatrix } = withSkia_useCanvasStore((state) => state);
  return Gesture.Pan()
    .averageTouches(true)
    .maxPointers(1)
    .onChange((e) => {
      "worklet";
      canvasMatrix.value = multiply4(
        translate(e.changeX, e.changeY, 0),
        canvasMatrix.value
      );
    });
}
