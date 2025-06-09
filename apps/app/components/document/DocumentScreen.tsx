import { useWebSocket } from "@/hooks/useWebSocket";
import { useDocumentStore } from "@/state/document";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { DocumentToolbar } from "../ui/DocumentToolbar";
import {
  MessageCommand,
  MessageType,
  StateMessageCommands,
  WSMessage,
} from "@native-hono-cf/shared";

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

export default function DocumentScreen({
  switchView,
}: {
  switchView: () => void;
}) {
  const {
    documentId,
    flushState,
    textContent,
    textHeading,
    setTextContent,
    setTextHeading,
  } = useDocumentStore((state) => state);

  // Move these higher up -> reuse the same socket for both text and canvas
  const { bufferMessage } = useWebSocket({
    documentId: documentId,
    onStateReceived: (_) => {
      // Unimplemented
    },
  });

  const sendLocalState = useCallback(
    <
      T extends {
        [key: string]: any; // For now
      }
    >(
      type: StateMessageCommands,
      payload: T
    ) => {
      if (!documentId) return;
      bufferMessage({
        type: MessageType.STATE,
        command: type, // Upddate or Add in the case of text
        payload,
      } as WSMessage);
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

  // If new WS messages are changes in elements, disregard them here

  useEffect(() => {
    return () => {
      flushState();
    };
  }, [documentId]);

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
