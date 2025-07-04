import { TextDoc, useDocumentStore } from "@/state/document";
import {
  MessageCommand,
  MessageType,
  uint8ArrayToBase64,
  WSMessage,
} from "@native-hono-cf/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { DocumentToolbar } from "../ui/DocumentToolbar";
import DocumentBodyArea from "./Body";
import DocumentHeadingArea from "./Heading";
import { DOCUMENT } from "@/constants";

interface DocumentScreenProps {
  switchView: () => void;
  sendWithoutBuffer: (message: WSMessage) => void;
}

export default function DocumentScreen({
  switchView,
  sendWithoutBuffer,
}: DocumentScreenProps) {
  const { documentId, doc, bindStore, setSavedState } = useDocumentStore(
    (state) => state
  );

  // Global state?
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
    if (!doc) return;
    doc.transact(() => {
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
    const textDoc = new TextDoc();
    bindStore(textDoc);
    // This has to be bound here since it uses the WS hook function
    textDoc.on("Send", (e) => {
      sendWithoutBuffer({
        type: MessageType.TEXT_STATE,
        command: MessageCommand.UPDATE,
        payload: uint8ArrayToBase64(e.message),
      });
    });

    setLoaded(true);
    return () => {
      // TODO: Similar snapshots here?
      setSavedState(textDoc.save());
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
      }, DOCUMENT.THROTTLE_DELAY);
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
      }, DOCUMENT.THROTTLE_DELAY);
    },
    [doc, documentId]
  );

  return (
    <View style={textStyles.container}>
      <DocumentToolbar switchView={switchView} />
      {loaded && doc && (
        <DocumentHeadingArea
          doc={doc}
          onChangeText={handleLocalHeadingChange}
          optimistic={optimisticHeading}
          textStyles={textStyles}
          onSelectionChange={(_) => {}}
        />
      )}
      <View style={textStyles.separator} />
      {loaded && doc && (
        <DocumentBodyArea
          doc={doc}
          textStyles={textStyles}
          optimistic={optimisticContent}
          onSelectionChange={(_) => {}}
          onChangeText={handleLocalBodyChange}
        />
      )}
    </View>
  );
}

export const textStyles = StyleSheet.create({
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
