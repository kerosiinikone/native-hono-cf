import { ClientObject, useDocumentStore } from "@/state/store";
import { Matrix4, rect, Skia } from "@shopify/react-native-skia";
import { useWindowDimensions } from "react-native";
import { makeMutable, useSharedValue } from "react-native-reanimated";
import { multiply4, translate } from "react-native-redash";

// More elegant way to copy a matrix?
function copyMatrix(matrix: Matrix4): Matrix4 {
  return [
    matrix[0],
    matrix[1],
    matrix[2],
    matrix[3],
    matrix[4],
    matrix[5],
    matrix[6],
    matrix[7],
    matrix[8],
    matrix[9],
    matrix[10],
    matrix[11],
    matrix[12],
    matrix[13],
    matrix[14],
    matrix[15],
  ];
}

// Enable stretch and resizing of the rectangle
export default function useRect() {
  const { canvasMatrix } = useDocumentStore((state) => state);
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
      focalX: rWidth / 2, // ???
      focalY: rHeight / 2, // ???
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
