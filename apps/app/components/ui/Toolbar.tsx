import { ClientPathElement, useDocumentStore } from "@/state/store";
import { MessageCommand } from "@native-hono-cf/shared";
import { Button, StyleSheet, View } from "react-native";

interface ToolbarProps {
  sendLocalState: <T extends ClientPathElement>(
    type: MessageCommand,
    payload: T
  ) => void;
}

export default function Toolbar({ sendLocalState }: ToolbarProps) {
  const { removeElement, elements } = useDocumentStore((state) => state);

  const undoPath = () => {
    // TODO: Only pop the updates that the client has made itself
    // -> for example, in SETUP, send a client id and only pop the updates
    // that are from the client itself (by looping through the elements and checking)

    if (!elements.length) return;
    const lastElement = removeElement(
      (elements[elements.length - 1] as ClientPathElement).id
    );
    if (!lastElement) return;

    sendLocalState(MessageCommand.DELETE, lastElement as ClientPathElement);
  };

  return (
    <View style={styles.container}>
      <Button title="Undo" onPress={undoPath} />
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
