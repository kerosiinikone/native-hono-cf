import { Button, StyleSheet, View } from "react-native";

interface ToolbarProps {
  undo: () => void;
}

export default function Toolbar({ undo }: ToolbarProps) {
  return (
    <View style={styles.container}>
      <Button title="Undo" onPress={undo} />
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
});
