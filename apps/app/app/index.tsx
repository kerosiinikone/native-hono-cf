import { Text, View } from "react-native";
import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

export default function HomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <WithSkiaWeb
        getComponent={() => require("@/components/Skia")}
        fallback={<Text>Loading canvas...</Text>} // Spinner or placeholder while loading
      />
    </View>
  );
}
