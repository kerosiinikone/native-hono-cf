import { CanvasDoc } from "@/state/c_canvas";
import { useDocumentStore } from "@/state/document";
import { withSkia_useCanvasStore } from "@/state/with_skia";
import {
  base64ToUint8Array,
  DocumentStateUpdate,
  MessageCommand,
  MessageType,
  uint8ArrayToBase64,
  WSMessage,
} from "@native-hono-cf/shared";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CanvasPointerMode } from "../ui/CanvasPointerMode";
import Toolbar from "../ui/Toolbar";
import SkiaCn from "./SkiaCn";

interface CanvasScreenProps {
  switchView: () => void;
  sendWithoutBuffer: (message: WSMessage) => void;
}

export default function CanvasScreen({
  switchView,
  sendWithoutBuffer,
}: CanvasScreenProps) {
  const { documentId, uncommitedCanvasChanges, setUncommitedCanvasChanges } =
    useDocumentStore((state) => state);
  const { bindStore, doc, setSavedState, savedState } = withSkia_useCanvasStore(
    (state) => state
  );

  useEffect(() => {
    if (!documentId) return;
    const canvasDoc = new CanvasDoc();
    bindStore(canvasDoc);
    // Trigger a rerender
    setUncommitedCanvasChanges(uncommitedCanvasChanges);
    // This has to be bound here since it uses the WS hook function
    canvasDoc.on("Send", (e) => {
      // if (isThrottling.current) return;
      sendWithoutBuffer({
        type: MessageType.STATE,
        command: MessageCommand.UPDATE,
        payload: uint8ArrayToBase64(e.message),
      });
    });
    // setLoaded(true);
    return () => {
      // Save for unmount
      setSavedState(canvasDoc.save());
    };
  }, [documentId]);

  // EventEmitter?
  useEffect(() => {
    if (!doc) return;
    if (uncommitedCanvasChanges.length > 0 && savedState.length === 0) {
      doc.receive(uncommitedCanvasChanges);
      setUncommitedCanvasChanges(new Uint8Array());
    }
  }, [uncommitedCanvasChanges, doc]);

  return (
    <GestureHandlerRootView style={gStyles.container}>
      {doc && <SkiaCn doc={doc} />}
      <CanvasPointerMode switchView={switchView} />
      {doc && <Toolbar doc={doc} />}
    </GestureHandlerRootView>
  );
}

const gStyles = StyleSheet.create({
  container: { flex: 1 },
});
