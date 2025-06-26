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
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CanvasPointerMode } from "../ui/CanvasPointerMode";
import Toolbar from "../ui/Toolbar";
import SkiaCn from "./SkiaCn";
import { mergeMessages } from "@collabs/collabs";

interface CanvasScreenProps {
  switchView: () => void;
  sendWithoutBuffer: (message: WSMessage) => void;
}

const THROTTLE_DELAY = 300;

export default function CanvasScreen({
  switchView,
  sendWithoutBuffer,
}: CanvasScreenProps) {
  const { documentId, uncommitedCanvasChanges, setUncommitedCanvasChanges } =
    useDocumentStore((state) => state);
  const { bindStore, doc, setSavedState, savedState } = withSkia_useCanvasStore(
    (state) => state
  );

  const isThrottling = useRef<boolean>(false);
  const changeBuffer = useRef<Uint8Array | null>(null); // Buffer for changes before sending

  const throttleTransaction = useCallback(() => {
    const batchedActions = changeBuffer.current;
    changeBuffer.current = null;
    if (!batchedActions || batchedActions.length === 0) {
      isThrottling.current = false;
      return;
    }
    // This doesn't defer the update itself but the sync operation
    sendWithoutBuffer({
      type: MessageType.STATE,
      command: MessageCommand.UPDATE,
      payload: uint8ArrayToBase64(batchedActions),
    });
    isThrottling.current = false;
  }, [doc]);

  useEffect(() => {
    if (!documentId) return;
    const canvasDoc = new CanvasDoc();
    bindStore(canvasDoc);
    // Trigger a rerender
    setUncommitedCanvasChanges(uncommitedCanvasChanges);
    // This is the place where either we send the "buffered" changes or
    // accumulate them (by merging) until a given throttle delay has passed
    canvasDoc.on("Send", (e) => {
      changeBuffer.current = mergeMessages(
        (!changeBuffer.current || changeBuffer.current.length === 0
          ? []
          : [changeBuffer.current]
        ).concat([e.message])
      );

      if (isThrottling.current) return;

      setTimeout(() => {
        throttleTransaction();
      }, THROTTLE_DELAY);

      // Send buffer was here!
      isThrottling.current = true;
    });
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
