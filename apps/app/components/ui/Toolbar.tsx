import useRect from "@/features/hooks/useRect";
import { ClientElement, useDocumentStore } from "@/state/store";
import { MessageCommand, StateMessageCommands } from "@native-hono-cf/shared";
import { Button, StyleSheet, View } from "react-native";

interface ToolbarProps {
  sendLocalState: <T extends ClientElement>(
    type: StateMessageCommands,
    payload: T
  ) => void;
}

export default function Toolbar({ sendLocalState }: ToolbarProps) {
  const { removeElement, elements, addElement } = useDocumentStore(
    (state) => state
  );
  const { createRectPath } = useRect();

  const undoPath = () => {
    // TODO: Only pop the updates that the client has made itself
    // -> for example, in SETUP, send a client id and only pop the updates
    // that are from the client itself (by looping through the elements and checking)

    if (!elements.length) return;
    const lastElement = removeElement(
      (elements[elements.length - 1] as ClientElement).id
    );
    if (!lastElement) return;

    sendLocalState(MessageCommand.DELETE, lastElement);
  };

  // Here or in the useRect hook?
  const addRectPathToStore = () =>
    sendLocalState(MessageCommand.ADD, addElement(createRectPath()));

  return (
    <View style={styles.container}>
      <Button title="Undo" color="rgba(243, 33, 33, 1)" onPress={undoPath} />
      <Button
        title="Rectangle"
        color="rgb(174, 0, 255)"
        onPress={addRectPathToStore}
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
