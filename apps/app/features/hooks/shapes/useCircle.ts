import { ClientObject, useDocumentStore } from "@/state/store";
import { copyMatrix } from "@/utils/matrix";
import { Matrix4, Skia } from "@shopify/react-native-skia";
import { useWindowDimensions } from "react-native";
import { makeMutable, useSharedValue } from "react-native-reanimated";
import { multiply4, translate } from "react-native-redash";

export default function useCircle() {
  const { canvasMatrix } = useDocumentStore((state) => state);
  const { width, height } = useWindowDimensions();
  const matrix = useSharedValue(Matrix4());

  const radius = height / 4;

  const x = width / 2;
  const y = height / 2;

  const r = Skia.Path.Make();
  const sharedCirc = useSharedValue(r.addCircle(x, y, radius));

  return {
    createCirclePath: (): ClientObject => ({
      path: sharedCirc.value.copy(),
      x,
      y,
      focalX: x,
      focalY: y,
      width: radius * 2,
      height: radius * 2,
      matrix: makeMutable(
        multiply4(
          copyMatrix(matrix.value),
          translate(-canvasMatrix.value[3], -canvasMatrix.value[7], 0)
        )
      ),
      stretchable: false,
    }),
  };
}
