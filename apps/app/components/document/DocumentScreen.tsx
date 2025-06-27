import { TextDoc, useDocumentStore } from "@/state/document";
import { useCollab } from "@collabs/react";
import {
  MessageCommand,
  MessageType,
  uint8ArrayToBase64,
  WSMessage,
} from "@native-hono-cf/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Markdown from "react-native-markdown-display";
import { DocumentToolbar } from "../ui/DocumentToolbar";

type NativeSelection = {
  start: number;
  end: number;
};

interface DocumentScreenProps {
  switchView: () => void;
  sendWithoutBuffer: (message: WSMessage) => void;
}

const THROTTLE_DELAY = 300;

function DocumentHeadingArea({
  onChangeText,
  doc,
  optimistic,
  onSelectionChange,
}: {
  doc: TextDoc;
  optimistic: string;
  onChangeText: (text: string) => void;
  onSelectionChange: (selection: NativeSelection) => void;
}) {
  useCollab(doc.heading);
  const text = optimistic !== "" ? optimistic : doc.heading.value;
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
      value={text}
    />
  );
}

// TODO: Markdown font sizes!
// Fix the overflow issue with Markdown rendering
// Make sure styles are applied correctly and set in the right place

function DocumentBodyArea({
  onChangeText,
  doc,
  optimistic,
  onSelectionChange,
}: {
  doc: TextDoc;
  optimistic: string;
  onChangeText: (text: string) => void;
  onSelectionChange: (selection: NativeSelection) => void;
}) {
  const { height } = useWindowDimensions();
  useCollab(doc.content);

  const text = optimistic !== "" ? optimistic : doc.content.value;
  const [focused, setFocused] = useState<boolean>(false);

  return (
    <>
      {focused ? (
        <KeyboardAvoidingView>
          <ScrollView>
            <TextInput
              placeholder="Start writing your document here (markdown supported)"
              placeholderTextColor="#999"
              multiline={true}
              autoFocus={true}
              onBlur={() => setFocused(false)}
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
              value={text}
              onChangeText={onChangeText}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <TouchableOpacity
          style={[
            styles.inputBody,
            {
              height: height - 220,
            },
          ]}
          onPress={() => setFocused(true)}
        >
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            style={{ height: "100%", width: "100%" }}
          >
            {text !== "" ? (
              <Markdown
                rules={{}}
                style={{
                  body: {
                    width: "100%",
                    overflow: "scroll",
                  },
                }}
              >
                {text}
              </Markdown>
            ) : (
              <Text style={{ color: "#999", fontSize: 20 }}>
                Start writing your document here (markdown supported)
              </Text>
            )}
          </ScrollView>
        </TouchableOpacity>
      )}
    </>
  );
}

export default function DocumentScreen({
  switchView,
  sendWithoutBuffer,
}: DocumentScreenProps) {
  const { documentId, doc, bindStore } = useDocumentStore((state) => state);

  const [optimisticHeading, setOptimisticHeading] = useState<string>("");
  const [optimisticContent, setOptimisticContent] = useState<string>("");

  const [loaded, setLoaded] = useState<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const actionBuffer = useRef<
    { content: string; type: "heading" | "content" }[]
  >([]);

  const throttleTransaction = useCallback(() => {
    const batchedActions = actionBuffer.current;
    actionBuffer.current = [];
    if (batchedActions.length === 0) {
      return;
    }
    doc!.transact(() => {
      for (const change of batchedActions) {
        if (change.type === "heading") {
          doc!.heading.set(change.content);
        }
        if (change.type === "content") {
          doc!.content.set(change.content);
        }
      }
    });
  }, [doc]);

  useEffect(() => {
    if (!documentId) return;
    const doc = new TextDoc();
    bindStore(doc);

    // This has to be bound here since it uses the WS hook function
    doc.on("Send", (e) => {
      sendWithoutBuffer({
        type: MessageType.TEXT_STATE,
        command: MessageCommand.UPDATE,
        payload: uint8ArrayToBase64(e.message),
      });
    });

    setLoaded(true);
    return () => {
      // TODO: Save state here?
      //
      // Cleanup the document store
      clearTimeout(timeoutRef.current!);
    };
  }, [documentId]);

  const handleLocalHeadingChange = useCallback(
    (newText: string) => {
      if (!doc) return;

      const currentHeading = optimisticHeading.concat(newText);
      setOptimisticHeading(currentHeading);

      actionBuffer.current.push({
        content: currentHeading,
        type: "heading",
      });
      timeoutRef.current = setTimeout(() => {
        throttleTransaction();
        setOptimisticHeading("");
      }, THROTTLE_DELAY);
    },
    [doc, documentId]
  );

  // Interface between the input and the document state
  const handleLocalBodyChange = useCallback(
    (newText: string) => {
      if (!doc) return;

      const currentContent = optimisticContent.concat(newText);
      setOptimisticContent(currentContent);

      actionBuffer.current.push({
        content: currentContent,
        type: "content",
      });
      setTimeout(() => {
        throttleTransaction();
        setOptimisticContent("");
      }, THROTTLE_DELAY);
    },
    [doc, documentId]
  );

  return (
    <View style={styles.container}>
      <DocumentToolbar switchView={switchView} />
      {loaded && doc && (
        <DocumentHeadingArea
          doc={doc}
          onChangeText={handleLocalHeadingChange}
          optimistic={optimisticHeading}
          onSelectionChange={(_) => {}}
        />
      )}
      <View style={styles.separator} />
      {loaded && doc && (
        <DocumentBodyArea
          doc={doc}
          optimistic={optimisticContent}
          onSelectionChange={(_) => {}}
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
