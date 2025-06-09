import { ClientObject, withSkia_useCanvasStore } from "@/state/with-skia";
import { copyMatrix } from "@/utils/matrix";
import { Matrix4, rect, Skia } from "@shopify/react-native-skia";
import { useWindowDimensions } from "react-native";
import { makeMutable, useSharedValue } from "react-native-reanimated";
import { multiply4, translate } from "react-native-redash";

export default function useRect() {
  const { canvasMatrix } = withSkia_useCanvasStore((state) => state);
  const { width, height } = useWindowDimensions();
  const matrix = useSharedValue(Matrix4());

  const rHeight = height / 5;
  const rWidth = width / 4;

  const x = width / 2 - rWidth / 2;
  const y = height / 2 - rHeight / 2;

  const r = Skia.Path.Make();
  const sharedRect = useSharedValue(r.addRect(rect(x, y, rWidth, rHeight)));

  return {
    createRectPath: (): ClientObject => ({
      path: sharedRect.value.copy(),
      x,
      y,
      focalX: x + rWidth / 2,
      focalY: y + rHeight / 2,
      width: rWidth,
      height: rHeight,
      matrix: makeMutable(
        multiply4(
          copyMatrix(matrix.value),
          translate(-canvasMatrix.value[3], -canvasMatrix.value[7], 0)
        )
      ),
      stretchable: true,
    }),
  };
}
