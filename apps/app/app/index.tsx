import { Text, View } from "react-native";
import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import { useState } from "react";
import DocumentScreen from "@/components/document/DocumentScreen";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useDocumentStore } from "@/state/document";

// View change should flush out the Skia canvas to avoid memory leaks
// and performance issues when switching between screens

export default function DocumentCanvasScreen() {
  const [screenView, setScreenView] = useState<number>(0); // 0 for CanvasScreen, 1 for another screen if needed
  const documentId = useDocumentStore((state) => state.documentId);

  const { bufferMessage } = useWebSocket({
    documentId: documentId,
  });

  return (
    <View style={{ flex: 1 }}>
      {screenView == 0 ? (
        // For web, use WithSkiaWeb to load the CanvasScreen component
        <WithSkiaWeb
          getComponent={() => require("@/components/canvas/CanvasScreen")}
          componentProps={{
            switchView: () => setScreenView(1),
            bufferMessage,
          }}
          fallback={<Text>Loading canvas...</Text>} // Spinner or placeholder while loading
        />
      ) : (
        <DocumentScreen
          switchView={() => setScreenView(0)}
          bufferMessage={bufferMessage}
        />
      )}
    </View>
  );
}
