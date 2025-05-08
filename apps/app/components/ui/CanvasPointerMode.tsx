import { Button, StyleSheet, View } from "react-native";

interface CanvasPointerModeProps {
  setModeDraw: () => void;
  setModeMove: () => void;
  setModeSelect: () => void;
}

export function CanvasPointerMode({
  setModeDraw,
  setModeMove,
  setModeSelect,
}: CanvasPointerModeProps) {
  return (
    <View style={styles.container}>
      <Button title="Draw" onPress={setModeDraw} />
      <Button title="Move" onPress={setModeMove} />
      <Button title="Select" onPress={setModeSelect} />
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
