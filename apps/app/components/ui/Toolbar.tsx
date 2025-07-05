import useCircle from "@/features/hooks/shapes/useCircle";
import useRect from "@/features/hooks/shapes/useRect";
import { CanvasDoc } from "@/state/c_canvas";
import { withSkia_useCanvasStore } from "@/state/with_skia";
import { ElementType } from "@native-hono-cf/shared";
import { Button, StyleSheet, View } from "react-native";

export default function Toolbar({
  doc,
  undo,
}: {
  doc: CanvasDoc;
  undo: () => void;
}) {
  const appendToRedoBuffer = withSkia_useCanvasStore(
    (state) => state.appendToRedoBuffer
  );
  const { createRectPath } = useRect();
  const { createCirclePath } = useCircle();

  const addRectPathToStore = () => {
    const newElement = doc.addElement({
      ...createRectPath(),
      type: ElementType.Rect,
    });
    appendToRedoBuffer({
      type: "remove",
      element: newElement,
    });
  };

  const addRCirclePathToStore = () => {
    const newElement = doc.addElement({
      ...createCirclePath(),
      type: ElementType.Circle,
    });
    appendToRedoBuffer({
      type: "remove",
      element: newElement,
    });
  };

  return (
    <View style={styles.container}>
      <Button title="Undo" color="rgba(243, 33, 33, 1)" onPress={undo} />
      <Button
        title="Rectangle"
        color="rgb(174, 0, 255)"
        onPress={addRectPathToStore}
      />
      <Button
        title="Circle"
        color="rgb(0, 255, 42)"
        onPress={addRCirclePathToStore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(200, 200, 200, 0.8)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    zIndex: 1,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: "#ccc",
  },
  button: {
    backgroundColor: "#007BFF",
    color: "#fff",
    padding: 10,
    borderRadius: 5,
  },
});
