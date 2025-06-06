import { StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { DocumentToolbar } from "../ui/DocumentToolbar";

const HEADING_FONT_SIZE = 40;
const BODY_FONT_SIZE = 20;

// When the "heading" input filed is deselected, it should be replaced with a bold
// text element that has the same text as the input field.

// Remove input field styling -> border, etc
function DocumentHeadingArea() {
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
    />
  );
}

function DocumentBodyArea() {
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
    />
  );
}

export default function DocumentScreen({
  switchView,
}: {
  switchView: () => void;
}) {
  return (
    <View style={styles.container}>
      <DocumentToolbar switchView={switchView} />
      <DocumentHeadingArea />
      <View
        style={{
          marginTop: 10,
          marginBottom: 10,
          borderBottomColor: "#ccc",
          borderBottomWidth: StyleSheet.hairlineWidth,
        }}
      />
      <DocumentBodyArea />
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
