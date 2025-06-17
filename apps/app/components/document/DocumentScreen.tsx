import { useDocumentStore } from "@/state/document";
import {
  MessageCommand,
  MessageType,
  TextDocumentStateUpdate,
  WSMessage,
} from "@native-hono-cf/shared";
import { diffChars } from "diff";
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { DocumentToolbar } from "../ui/DocumentToolbar";
import { calculateTextUpdate } from "@native-hono-cf/shared";

type NativeSelection = {
  start: number;
  end: number;
};

interface DocumentScreenProps {
  switchView: () => void;
  bufferMessage: (message: WSMessage) => void;
}

type TextOperation = {
  text?: string;
  end?: number;
  offset?: number;
};

// TODO: Types for operations?
// type InsertOperation = { type: 'INSERT'; };
// type DeleteOperation = { type: 'DELETE'; };
// type ReplaceOperation = { type: 'REPLACE'; };

const DEFAULT_MSG_PARAMS = {
  text: "",
  heading: "",
  headingEnd: 0,
  headingOffset: 0,
};

function getTextUpdate(
  oldText: string,
  newText: string,
  selection: NativeSelection
): TextOperation | null {
  const oldLen = oldText.length;
  const newLen = newText.length;

  const isLonger = newLen > oldLen;
  const equalSelection = selection.start === selection.end;

  // Concatenation case
  if (isLonger && equalSelection) {
    const insertedText = newText.substring(
      selection.start,
      selection.start + (newLen - oldLen)
    );
    return {
      text: insertedText,
      end: selection.start, // same since the insert happens to a specific index
      offset: selection.start,
    };
  }

  // Simple delete case (without selection)
  if (
    !isLonger &&
    equalSelection &&
    newText ===
      oldText.slice(0, selection.start - 1) +
        oldText.slice(selection.end - 1 + (oldLen - newLen))
  ) {
    return {
      text: "",
      offset: selection.start - 1, // the selection pointer lags behind
      end: selection.start - 1 + (oldLen - newLen),
    };
  }

  // Catch-all modification case (with selection)
  const diff = diffChars(oldText, newText);
  let final = "";

  // Order matters here!
  diff.forEach((part, i) => {
    const isUnchanged = !part?.added && !part?.removed;
    if (selection.start > 0 && i === 0 && isUnchanged) {
      if (part?.value.length! > selection.start) {
        final += part?.value.slice(selection.start, part?.value.length);
      }
      return;
    }
    if (selection.end < oldLen && i === diff.length - 1 && isUnchanged) {
      if (part?.value.length! > oldLen - selection.end) {
        final += part?.value.slice(
          0,
          part?.value.length - (oldLen - selection.end)
        );
      }
      return;
    }
    if (!part?.removed) final += part?.value;
  });

  return {
    text: final,
    end: selection.end,
    offset: selection.start,
  };
}

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
      style={[
        styles.inputBody,
        {
          height: height - 220,
          borderColor: "rgba(0, 0, 0, 0)",
          outline: "none",
        },
      ]}
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
    popMessageFromTextQueue,
  } = useDocumentStore((state) => state);

  const headingSelection = useRef<NativeSelection>({ start: 0, end: 0 });

  const handleStateReceive = useCallback(
    (msg: WSMessage) => {
      if (!msg.payload || !documentId) return;

      const payloadState = (msg.payload as { state: TextDocumentStateUpdate })
        .state;

      if (msg.command === MessageCommand.ADD) {
        // Initial state setup
        setTextContent(payloadState.text || "");
        setTextHeading(payloadState.heading || "");
        return;
      }
      if (msg.command !== MessageCommand.UPDATE) return;

      setTextHeading(
        calculateTextUpdate(
          textHeading,
          payloadState.heading,
          payloadState.headingOffset,
          payloadState.headingEnd
        ) || ""
      );
      // TODO: setTextContent(newContent);
    },
    [documentId, textHeading, textContent, setTextHeading, setTextContent]
  );

  // TODO: Merge incoming text changes pre-buffer?
  const handleLocalHeadingChange = (newText: string) => {
    if (!documentId) return;

    const updated = getTextUpdate(
      textHeading,
      newText,
      headingSelection.current
    );

    if (updated) {
      bufferMessage({
        type: MessageType.TEXT_STATE,
        command: MessageCommand.UPDATE,
        payload: {
          state: {
            ...DEFAULT_MSG_PARAMS,
            heading: updated.text,
            headingEnd: updated.end,
            headingOffset: updated.offset,
          },
        },
      });
    }
    setTextHeading(newText);
  };

  const handleLocalBodyChange = (newText: string) => {
    setTextContent(newText);
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
