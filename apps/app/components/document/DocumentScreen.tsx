import { useDocumentStore } from "@/state/document";
import {
  MessageCommand,
  MessageType,
  TextDocumentStateUpdate,
  WSMessage,
} from "@native-hono-cf/shared";
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { DocumentToolbar } from "../ui/DocumentToolbar";

type NativeSelection = {
  start: number;
  end: number;
};

interface DocumentScreenProps {
  switchView: () => void;
  bufferMessage: (message: WSMessage) => void;
}

const HEADING_FONT_SIZE = 40;
const BODY_FONT_SIZE = 20;

function DocumentHeadingArea({
  value,
  onChange,
  onSelectionChange,
}: {
  value: string;
  onChange: (newText: string) => void;
  onSelectionChange: (selection: NativeSelection) => void;
}) {
  return (
    <TextInput
      multiline={true}
      placeholderTextColor="#999"
      placeholder="Heading"
      onSelectionChange={(e) => onSelectionChange(e.nativeEvent.selection)}
      style={styles.inputHeading}
      value={value}
      onChangeText={onChange}
    />
  );
}

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
      placeholder="Start writing your document here"
      placeholderTextColor="#999"
      multiline={true}
      style={[styles.inputBody, { height: height - 220 }]}
      value={value}
      onChangeText={onChangeText}
    />
  );
}

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

  const headingSelection = useRef<NativeSelection>({ start: 0, end: 0 });

  const handleStateReceive = useCallback(
    (msg: WSMessage) => {
      if (!msg.payload || !documentId) return;

      const payloadState = (msg.payload as { state: TextDocumentStateUpdate })
        .state;

      if (msg.command === MessageCommand.ADD) {
        if (payloadState.heading) {
          setTextHeading(textHeading + payloadState.heading);
        }
        if (payloadState.text) {
          setTextContent(textContent + payloadState.text);
        }
      }
    },
    [documentId, textHeading, textContent, setTextHeading, setTextContent]
  );

  const handleLocalHeadingChange = (newText: string) => {
    if (newText.length > textHeading.length) {
      const diff = newText.slice(textHeading.length).trim();
      if (!diff) return;

      if (documentId) {
        bufferMessage({
          type: MessageType.TEXT_STATE,
          command: MessageCommand.ADD,
          payload: {
            state: {
              heading: diff,
              text: "",
            },
          },
        });
      }
    }
    setTextHeading(newText);
  };

  const handleLocalBodyChange = (newText: string) => {
    setTextContent(newText);
  };

  useEffect(() => {
    for (let i = globalTextMessageQueue.length - 1; i >= 0; i--) {
      const message = globalTextMessageQueue[i];
      if (!message || !message.payload) continue;
      if (message.type !== MessageType.TEXT_STATE) continue;

      handleStateReceive(message);
      popMessageFromQueue("text");
    }
  }, [globalTextMessageQueue, handleStateReceive, popMessageFromQueue]);

  return (
    <View style={styles.container}>
      <DocumentToolbar switchView={switchView} />
      <DocumentHeadingArea
        value={textHeading}
        onChange={handleLocalHeadingChange}
        onSelectionChange={(selection) => {
          headingSelection.current = selection;
        }}
      />
      <View style={styles.separator} />
      <DocumentBodyArea
        value={textContent}
        onChangeText={handleLocalBodyChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 50,
    paddingTop: 100,
    backgroundColor: "#fff",
  },
  inputHeading: {
    height: 80,
    textAlignVertical: "top",
    borderColor: "rgba(0, 0, 0, 0)",
    borderWidth: 0,
    fontSize: HEADING_FONT_SIZE,
    padding: 10,
    outline: "none",
  },
  inputBody: {
    textAlignVertical: "top",
    fontSize: BODY_FONT_SIZE,
    padding: 10,
  },
  separator: {
    marginVertical: 10,
    borderBottomColor: "#ccc",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
