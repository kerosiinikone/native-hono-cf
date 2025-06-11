import { useDocumentStore } from "@/state/document";
import {
  MessageType,
  StateMessageCommands,
  WSMessage,
} from "@native-hono-cf/shared";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { DocumentToolbar } from "../ui/DocumentToolbar";

interface DocumentScreenProps {
  switchView: () => void;
  bufferMessage: (message: WSMessage) => void;
}

const HEADING_FONT_SIZE = 40;
const BODY_FONT_SIZE = 20;

// DocumentHeadingArea now receives value and onChangeText as props
function DocumentHeadingArea({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <TextInput
      autoFocus={true}
      multiline={true}
      numberOfLines={1}
      placeholder="Heading"
      placeholderTextColor="#999"
      style={{
        height: 80,
        textAlignVertical: "top",
        borderColor: "rgba(0, 0, 0, 0)",
        borderWidth: 1,
        fontSize: HEADING_FONT_SIZE,
        padding: 10,
        outline: "none",
      }}
      value={value}
      onChangeText={onChangeText}
    />
  );
}

// DocumentBodyArea now receives value and onChangeText as props
function DocumentBodyArea({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (text: string) => void;
}) {
  const { height } = useWindowDimensions();
  return (
    <TextInput
      autoFocus={true}
      placeholder="Start writing your document here"
      placeholderTextColor="#999"
      multiline={true}
      style={{
        height: height - 220,
        textAlignVertical: "top",
        borderColor: "rgba(0, 0, 0, 0)",
        borderWidth: 1,
        fontSize: BODY_FONT_SIZE,
        padding: 10,
        outline: "none",
      }}
      value={value}
      onChangeText={onChangeText}
    />
  );
}

// Logic for editing the text document
//
// SENDING
//
// User edits (adds, deletes, modifies) text or/and the heading
// The start point of the text is recorded as the offset
// The end point of the added/deleted text is recorded as the end
// There is an enum that keeps track of the type of action
// (add, delete, update)
// Each time the input changes, the local state is updated and a message
// is debounced with the gelp of a bufferMessage function (or similar)
//
// RECEIVING
//
// The server sends a message with the type of action and the payload
// The payload contains the offset and end of the text
// The local state is computed in the "store" and sent back as a whole
// This becomes important when inputs are switched between interactable and
// previews (for Markdown formatting after editing is "done")

export default function DocumentScreen({
  switchView,
  bufferMessage,
}: DocumentScreenProps) {
  const {
    documentId,
    textContent,
    textHeading,
    setTextContent,
    setTextHeading,
    globalTextMessageQueue,
    popMessageFromQueue,
  } = useDocumentStore((state) => state);

  // When true -> TextInputs are active
  // When false -> TextInputs are replaced with Text components (with Markdown formatting)
  const [isEditingHeading, setIsEditingHeading] = useState<boolean>(false);
  const [isEditingBody, setIsEditingBody] = useState<boolean>(false);

  const handleStateReceive = useCallback(
    (msg: WSMessage) => {
      // const { command, payload } = msg as WSMessage;
      // setLocalFromServerState(serverState, command);
      popMessageFromQueue("text");
    },
    [documentId]
  );

  const sendLocalState = useCallback(
    <
      T extends {
        [key: string]: any; // For now
      }
    >(
      type: StateMessageCommands
    ) => {
      if (!documentId) return;

      bufferMessage({
        type: MessageType.TEXT_STATE,
        command: type,
        payload: {
          state: {
            heading: textHeading,
            text: textContent,
          },
        },
      });
    },
    [documentId, bufferMessage]
  );

  const setTextHeadingWithUpdate = (text: string) => {
    // sendLocalState() -> how do I distinguish between editing and adding new text?
    setTextHeading(text);
  };

  const setTextBodyWithUpdate = (text: string) => {
    setTextContent(text);
  };

  useEffect(() => {
    for (let i = globalTextMessageQueue.length - 1; i >= 0; i--) {
      const message = globalTextMessageQueue[i];
      if (!message || !message.payload) continue;
      if (message.type !== MessageType.TEXT_STATE) continue;
      handleStateReceive(message);
    }
  }, [globalTextMessageQueue, popMessageFromQueue, handleStateReceive]);

  return (
    <View style={styles.container}>
      <DocumentToolbar switchView={switchView} />
      <DocumentHeadingArea
        value={textHeading}
        onChangeText={setTextHeadingWithUpdate}
      />
      <View
        style={{
          marginTop: 10,
          marginBottom: 10,
          borderBottomColor: "#ccc",
          borderBottomWidth: StyleSheet.hairlineWidth,
        }}
      />
      <DocumentBodyArea
        value={textContent}
        onChangeText={setTextBodyWithUpdate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingLeft: 50,
    paddingRight: 50,
    paddingTop: 100,
  },
});
