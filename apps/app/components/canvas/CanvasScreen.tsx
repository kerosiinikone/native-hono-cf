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

interface CanvasScreenProps {
  switchView: () => void;
  sendWithoutBuffer: (message: WSMessage) => void;
}

const THROTTLE_DELAY = 300;

export default function CanvasScreen({
  switchView,
  sendWithoutBuffer,
}: CanvasScreenProps) {
  const {
    documentId,
    uncommitedCanvasChanges,
    setUncommitedCanvasChanges,
    savedCanvasState,
  } = useDocumentStore((state) => state);
  const { bindStore, setSavedState } = withSkia_useCanvasStore(
    (state) => state
  );
  const canvasRef = useRef<CanvasDoc | null>(null);

  const isThrottling = useRef<boolean>(false);
  const changeBuffer = useRef<Uint8Array | null>(null); // Buffer for changes before sending
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    if (!documentId) return;
    const canvasDoc = new CanvasDoc();
    canvasRef.current = canvasDoc;
    // Bind the store to the canvas document -> is this even necessary?
    bindStore(canvasDoc);
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
      }, THROTTLE_DELAY);

      // Send buffer was here!
      isThrottling.current = true;
    });

    return () => {
      // Save for unmount -> send a MessageType.SNAPSHOT to the server!
      // Also periodically save the state and send it to the server!
      //
      // useSendSnapshot hook? -> intervals on useEffect?
      //
      // Save and send the senderCounter as well!!!! -> verify latest state
      const save = canvasDoc.save();
      if (!save.length) return;
      // TODO: Don't send if no changes have been made
      sendWithoutBuffer({
        type: MessageType.STATE,
        command: MessageCommand.SNAPSHOT,
        payload: uint8ArrayToBase64(save),
      });
      setSavedState(save);
      clearTimeout(timeoutRef.current!);
    };
  }, [documentId]);

  // Merge these hooks?
  useEffect(() => {
    if (!canvasRef.current) return;
    if (savedCanvasState.length > 0) {
      canvasRef.current.load(savedCanvasState);
    }
  }, [savedCanvasState, canvasRef.current]);

  // EventEmitter?
  useEffect(() => {
    if (!canvasRef.current) return;
    // When reloading the page (the connection resets at the root of index.tsx), the savedState should be empty
    // This should in turn load the "merged" state from the server (not a complete state snapshot as it probably should be....)
    if (uncommitedCanvasChanges.length > 0) {
      canvasRef.current.receive(uncommitedCanvasChanges);
      setUncommitedCanvasChanges(new Uint8Array());
    }
  }, [uncommitedCanvasChanges, canvasRef.current]);

  return (
    <GestureHandlerRootView style={gStyles.container}>
      <CanvasPointerMode switchView={switchView} />
      {canvasRef.current && <SkiaCn doc={canvasRef.current} />}
      {canvasRef.current && <Toolbar doc={canvasRef.current} />}
    </GestureHandlerRootView>
  );
}

const gStyles = StyleSheet.create({
  container: { flex: 1 },
});
