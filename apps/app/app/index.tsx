import { Text, View } from "react-native";
import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import { useState } from "react";
import DocumentScreen from "@/components/document/DocumentScreen";

// View change should flush out the Skia canvas to avoid memory leaks
// and performance issues when switching between screens

export default function DocumentCanvasScreen() {
  const [screenView, setScreenView] = useState<number>(0); // 0 for CanvasScreen, 1 for another screen if needed

  return (
    <View style={{ flex: 1 }}>
      {screenView == 0 ? (
        <WithSkiaWeb
          getComponent={() => require("@/components/canvas/CanvasScreen")}
          componentProps={{
            switchView: () => setScreenView(1),
          }}
          fallback={<Text>Loading canvas...</Text>} // Spinner or placeholder while loading
        />
      ) : (
        <DocumentScreen switchView={() => setScreenView(0)} />
      )}
    </View>
  );
}
