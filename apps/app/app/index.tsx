import { Text, View } from "react-native";
import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import { useState } from "react";
import DocumentScreen from "@/components/document/DocumentScreen";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useDocumentStore } from "@/state/document";

export default function DocumentCanvasScreen() {
  // The Skia web component can't consume this from the global store for some reason
  // so we need to manage the screen view state here.
  const [screenView, setScreenView] = useState<number>(0);
  const documentId = useDocumentStore((state) => state.documentId);
  const { sendWithoutBuffer } = useWebSocket({
    documentId,
  });

  return (
    <View style={{ flex: 1, height: "100%", width: "100%" }}>
      {screenView == 0 ? (
        // For web, use WithSkiaWeb to load the CanvasScreen component
        <WithSkiaWeb
          getComponent={() => require("@/components/canvas/CanvasScreen")}
          componentProps={{
            switchView: () => setScreenView(1),
            sendWithoutBuffer,
          }}
          fallback={<Text>Loading canvas...</Text>} // Spinner or placeholder while loading
        />
      ) : (
        <DocumentScreen
          switchView={() => setScreenView(0)}
          sendWithoutBuffer={sendWithoutBuffer}
        />
      )}
    </View>
  );
}
