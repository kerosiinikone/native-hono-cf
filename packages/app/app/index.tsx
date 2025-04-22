import { Text, View } from "react-native";
import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

export default function HomeScreen() {
    return (
      <View>
        <WithSkiaWeb
          getComponent={() => import("@/components/Skia")}
          fallback={<Text>Loading Skia...</Text>}
        />
      </View>
    )
}