import { CanvasDoc } from "@/state/c_canvas";
import { useDocumentStore } from "@/state/document";
import { withSkia_useCanvasStore } from "@/state/with-skia";
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
  const { bindStore, doc } = withSkia_useCanvasStore((state) => state);

  useEffect(() => {
    if (!documentId) return;
    const doc = new CanvasDoc();
    bindStore(doc, (instance: CanvasDoc) => {
      // Flush the uncommited changes -> has to be done here
      if (uncommitedCanvasChanges.length > 0) {
        instance.receive(uncommitedCanvasChanges);
        setUncommitedCanvasChanges(new Uint8Array());
      }
    });
    // This has to be bound here since it uses the WS hook function
    doc.on("Send", (e) => {
      // if (isThrottling.current) return;
      sendWithoutBuffer({
        type: MessageType.STATE,
        command: MessageCommand.UPDATE,
        payload: uint8ArrayToBase64(e.message),
      });
    });
    // setLoaded(true);
  }, [documentId]);

  // EventEmitter?
  useEffect(() => {
    if (!doc) return;
    if (uncommitedCanvasChanges.length > 0) {
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
