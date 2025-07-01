import useCircle from "@/features/hooks/shapes/useCircle";
import useRect from "@/features/hooks/shapes/useRect";
import { CCanvas } from "@/state/c_canvas";
import { useCollab } from "@collabs/react";
import { ElementType } from "@native-hono-cf/shared";
import { Button, StyleSheet, View } from "react-native";

export default function Toolbar({ doc }: { doc: CCanvas }) {
  useCollab(doc);

  const { createRectPath } = useRect();
  const { createCirclePath } = useCircle();

  const undoPath = () => {
    // TODO: Only pop the updates that the client has made itself
    // -> for example, in SETUP, send a client id and only pop the updates
    // that are from the client itself (by looping through the elements and checking)
    const len = doc.elements.length;
    if (!len) return;
    doc.removeElement(doc.elements.get(len - 1));
  };

  const addRectPathToStore = () =>
    doc.addElement({ ...createRectPath(), type: ElementType.Rect });

  const addRCirclePathToStore = () =>
    doc.addElement({ ...createCirclePath(), type: ElementType.Circle });

  return (
    <View style={styles.container}>
      <Button title="Undo" color="rgba(243, 33, 33, 1)" onPress={undoPath} />
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
    justifyContent: "space-around",
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
