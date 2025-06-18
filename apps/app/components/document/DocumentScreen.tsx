import { useDocumentStore } from "@/state/document";
import { AbstractDoc, CVar, DocOptions } from "@collabs/collabs";
import { useCollab } from "@collabs/react";
import { MessageCommand, MessageType, WSMessage } from "@native-hono-cf/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { DocumentToolbar } from "../ui/DocumentToolbar";
import { base64ToUint8Array, uint8ArrayToBase64 } from "@/utils/binary";

type NativeSelection = {
  start: number;
  end: number;
};

interface DocumentScreenProps {
  switchView: () => void;
  bufferMessage: (message: WSMessage) => void;
}

class TextDoc extends AbstractDoc {
  // Selections?
  readonly heading: CVar<string>;
  readonly content: CVar<string>;

  constructor(options?: DocOptions) {
    super(options);
    this.heading = this.runtime.registerCollab(
      "heading",
      (init) => new CVar(init, "")
    );
    this.content = this.runtime.registerCollab(
      "content",
      (init) => new CVar(init, "")
    );
  }

  updateContent(text: string) {
    this.content.set(text);
  }

  updateHeading(text: string) {
    this.heading.set(text);
  }
}

function DocumentHeadingArea({
  onChangeText,
  doc,
  onSelectionChange,
}: {
  doc: TextDoc;
  onChangeText: (text: string) => void;
  onSelectionChange: (selection: NativeSelection) => void;
}) {
  useCollab(doc.content);

  return (
    <TextInput
      autoFocus={true}
      multiline={true}
      numberOfLines={1}
      onSelectionChange={(event) =>
        onSelectionChange(event.nativeEvent.selection)
      }
      placeholder="Heading"
      placeholderTextColor="#999"
      style={{
        ...styles.inputHeading,
        borderColor: "rgba(0, 0, 0, 0)",
        outline: "none",
      }}
      onChangeText={onChangeText}
    />
  );
}

function DocumentBodyArea({
  onChangeText,
  doc,
  onSelectionChange,
}: {
  doc: TextDoc;
  onChangeText: (text: string) => void;
  onSelectionChange: (selection: NativeSelection) => void;
}) {
  const { height } = useWindowDimensions();
  useCollab(doc.content);

  return (
    <TextInput
      placeholder="Start writing your document here"
      placeholderTextColor="#999"
      multiline={true}
      onSelectionChange={(event) =>
        onSelectionChange(event.nativeEvent.selection)
      }
      style={[
        styles.inputBody,
        {
          height: height - 220,
          borderColor: "rgba(0, 0, 0, 0)",
          outline: "none",
        },
      ]}
      value={doc.content.value}
      onChangeText={onChangeText}
    />
  );
}

export default function DocumentScreen({
  switchView,
  bufferMessage,
}: DocumentScreenProps) {
  const { documentId, globalTextMessageQueue, popMessageFromTextQueue } =
    useDocumentStore((state) => state);

  const headingSelection = useRef<NativeSelection>({ start: 0, end: 0 });
  const contentSelection = useRef<NativeSelection>({ start: 0, end: 0 });

  const docRef = useRef<TextDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  const handleStateReceive = useCallback(
    (msg: WSMessage) => {
      if (!docRef.current) return;
      if (msg.type !== MessageType.TEXT_STATE || !msg.payload) return;

      const base64 = msg.payload;
      docRef.current.receive(base64ToUint8Array(base64));
    },
    [documentId, docRef, bufferMessage]
  );

  // Later -> this should be in the store (init)!
  useEffect(() => {
    if (!documentId) return;
    docRef.current = new TextDoc();
    docRef.current.on("Send", (e) => {
      bufferMessage({
        type: MessageType.TEXT_STATE,
        command: MessageCommand.UPDATE,
        payload: uint8ArrayToBase64(e.message),
      });
    });
    setLoaded(true);
  }, [documentId]);

  // TODO: Merge incoming text changes pre-buffer?
  const handleLocalHeadingChange = (newText: string) => {
    if (!docRef.current) return;
    docRef.current.updateHeading(newText);
  };

  // Interface between the input and the document state
  const handleLocalBodyChange = (newText: string) => {
    if (!docRef.current) return;
    docRef.current.updateContent(newText);
  };

  // Flawed
  // TODO: Separate logic for deciding on updates (and their order)
  // And make into a custom hook -> with CanvasScreen as well?
  useEffect(() => {
    for (let i = globalTextMessageQueue.length - 1; i >= 0; i--) {
      const message = globalTextMessageQueue[i];
      if (!message || !message.payload) continue;
      if (message.type !== MessageType.TEXT_STATE) continue;

      handleStateReceive(message);
      popMessageFromTextQueue();
    }
  }, [globalTextMessageQueue, handleStateReceive, popMessageFromTextQueue]);

  return (
    <View style={styles.container}>
      <DocumentToolbar switchView={switchView} />
      {loaded && docRef.current !== null && (
        <DocumentHeadingArea
          doc={docRef.current}
          onChangeText={handleLocalHeadingChange}
          onSelectionChange={(selection) => {
            headingSelection.current = selection;
          }}
        />
      )}
      <View style={styles.separator} />
      {loaded && docRef.current !== null && (
        <DocumentBodyArea
          doc={docRef.current}
          onSelectionChange={(selection) => {
            contentSelection.current = selection;
          }}
          onChangeText={handleLocalBodyChange}
        />
      )}
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
    fontSize: 40,
    padding: 10,
  },
  inputBody: {
    textAlignVertical: "top",
    fontSize: 20,
    padding: 10,
  },
  separator: {
    marginVertical: 10,
    borderBottomColor: "#ccc",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
