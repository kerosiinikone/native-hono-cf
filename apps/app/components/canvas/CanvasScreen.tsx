import { CanvasDoc } from "@/state/c_canvas";
import { useDocumentStore } from "@/state/document";
import { withSkia_useCanvasStore } from "@/state/with_skia";
import { mergeMessages } from "@collabs/collabs";
import {
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
import { CANVAS } from "@/constants";

interface CanvasScreenProps {
  sendWithoutBuffer: (message: WSMessage) => void;
  switchView: () => void;
}

// ForwardRef?
function useUncommitedCanvasChanges(
  canvasRef: React.MutableRefObject<CanvasDoc | null>
) {
  const { setUncommitedCanvasChanges, uncommitedCanvasChanges } =
    useDocumentStore((state) => state);
  useEffect(() => {
    if (!canvasRef.current) return;
    // When reloading the page (the connection resets at the root of index.tsx), the savedState should be empty
    if (uncommitedCanvasChanges.length > 0) {
      canvasRef.current.receive(uncommitedCanvasChanges);
      setUncommitedCanvasChanges(new Uint8Array());
    }
  }, [uncommitedCanvasChanges, canvasRef.current]);
}

function useSavedCanvasState(
  canvasRef: React.MutableRefObject<CanvasDoc | null>
) {
  const { savedCanvasState, setSavedCanvasState } = useDocumentStore(
    (state) => state
  );
  useEffect(() => {
    if (!canvasRef.current) return;
    if (savedCanvasState.length > 0) {
      canvasRef.current.load(savedCanvasState);
      setSavedCanvasState(new Uint8Array());
    }
  }, [savedCanvasState, canvasRef.current]);
}

export default function CanvasScreen({
  sendWithoutBuffer,
  switchView,
}: CanvasScreenProps) {
  const documentId = useDocumentStore((state) => state.documentId);
  const { loadSavedState, setSavedState } = withSkia_useCanvasStore(
    (state) => state
  );
  const canvasRef = useRef<CanvasDoc | null>(null);

  const isThrottling = useRef<boolean>(false);
  const changeBuffer = useRef<Uint8Array | null>(null); // Buffer for changes before sending
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useUncommitedCanvasChanges(canvasRef);
  useSavedCanvasState(canvasRef);

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
  }, [canvasRef.current, sendWithoutBuffer]);

  // TODO: a hook named "useCanvasDoc" -> to encapsulate the logic of creating
  // the CanvasDoc instance?
  useEffect(() => {
    if (!documentId) return;
    const canvasDoc = new CanvasDoc();
    canvasRef.current = canvasDoc;
    // This is where the doc would be bound to the store
    // but now we just load the saved state without binding
    loadSavedState(canvasDoc);
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

      timeoutRef.current = setTimeout(() => {
        throttleTransaction();
      }, CANVAS.THROTTLE_DELAY);

      // Send buffer was here!
      isThrottling.current = true;
    });

    return () => {
      // Save for unmount -> send a MessageType.SNAPSHOT to the server
      // Also periodically save the state and send it to the server
      //
      // TODO: useSendSnapshot hook? -> intervals on useEffect?
      // Save and send the senderCounter as well!!!! -> verify latest state
      const save = canvasDoc.save();
      if (!save.length) return;
      // Don't send if no changes have been made?
      sendWithoutBuffer({
        type: MessageType.STATE,
        command: MessageCommand.SNAPSHOT,
        payload: uint8ArrayToBase64(save),
      });
      setSavedState(save);
      clearTimeout(timeoutRef.current!);
    };
  }, [documentId]);

  return (
    <GestureHandlerRootView style={canvasStyles.container}>
      <CanvasPointerMode switchView={switchView} />
      {canvasRef.current && <SkiaCn doc={canvasRef.current} />}
      {canvasRef.current && <Toolbar doc={canvasRef.current} />}
    </GestureHandlerRootView>
  );
}

const canvasStyles = StyleSheet.create({
  container: { flex: 1 },
});
