import { Button, StyleSheet, View } from "react-native";

export function DocumentToolbar({ switchView }: { switchView: () => void }) {
  return (
    <View style={styles.container}>
      <Button title="Canvas" onPress={switchView} />
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
