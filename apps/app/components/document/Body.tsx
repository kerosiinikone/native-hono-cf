import { TextDoc } from "@/state/document";
import {
  KeyboardAvoidingView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { useCollab } from "@collabs/react";
import { useState } from "react";
import { ScrollView, TextInput } from "react-native-gesture-handler";
import Markdown from "react-native-markdown-display";

// TODO: Markdown font sizes!
// Fix the overflow issue with Markdown rendering
// Make sure styles are applied correctly and set in the right place

export default function DocumentBodyArea({
  onChangeText,
  doc,
  optimistic,
  onSelectionChange,
  textStyles,
}: {
  doc: TextDoc;
  optimistic: string;
  onChangeText: (text: string) => void;
  onSelectionChange: (selection: { start: number; end: number }) => void;
  textStyles: any;
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
                textStyles.inputBody,
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
            textStyles.inputBody,
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
