import { TextDoc } from "@/state/document";
import { useCollab } from "@collabs/react";
import { TextInput } from "react-native-gesture-handler";

export default function DocumentHeadingArea({
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
  textStyles: any; // Optional styles for the text input
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
        ...textStyles.inputHeading,
        borderColor: "rgba(0, 0, 0, 0)",
        outline: "none",
      }}
      onChangeText={onChangeText}
      value={text}
    />
  );
}
