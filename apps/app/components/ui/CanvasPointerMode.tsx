import { useDocumentStore } from "@/state/document";
import { useCallback } from "react";
import { Button, StyleSheet, View } from "react-native";

export function CanvasPointerMode({ switchView }: { switchView: () => void }) {
  const { setDrawingMode, drawingMode, flushState } = useDocumentStore(
    (state) => state
  );

  const handleSwitchView = useCallback(() => {
    flushState();
    switchView();
  }, [flushState, switchView]);

  return (
    <View style={styles.container}>
      <Button title="Document" onPress={handleSwitchView} />
      <Button
        title="Draw"
        onPress={() => setDrawingMode("draw")}
        disabled={drawingMode === "draw"}
      />
      <Button
        title="Move"
        onPress={() => setDrawingMode("move")}
        disabled={drawingMode === "move"}
      />
      <Button
        title="Select"
        onPress={() => setDrawingMode("select")}
        disabled={drawingMode === "select"}
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
    top: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
});
