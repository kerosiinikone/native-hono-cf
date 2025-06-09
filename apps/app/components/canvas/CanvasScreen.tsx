import { useWebSocket } from "@/hooks/useWebSocket";
import { useDocumentStore } from "@/state/document";
import {
  DocumentStateUpdate,
  MessageCommand,
  MessageType,
  StateMessageCommands,
  WSMessage,
} from "@native-hono-cf/shared";
import { useCallback, useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CanvasPointerMode } from "../ui/CanvasPointerMode";
import Toolbar from "../ui/CanvasToolbar";
import SkiaCn from "./SkiaCn";
import {
  ClientElement,
  transformClientObjectToServer,
  withSkia_useCanvasStore,
} from "@/state/with-skia";

export default function CanvasScreen({
  switchView,
}: {
  switchView: () => void;
}) {
  const { documentId, flushState: flushDocument } = useDocumentStore(
    (state) => state
  );
  const { setLocalFromServerState, flushState } = withSkia_useCanvasStore(
    (state) => state
  );

  const handleStateReceive = useCallback(
    (serverState: DocumentStateUpdate, command: MessageCommand) => {
      // CHECK IF THE STATE UPDATE CONCERNS ELEMENTS, NOT THE TEXT DOCUMENT!

      setLocalFromServerState(serverState, command);
    },
    [documentId]
  );

  // Move these higher up -> reuse the same socket for both text and canvas
  const { bufferMessage } = useWebSocket({
    documentId: documentId,
    onStateReceived: handleStateReceive,
  });

  const sendLocalState = useCallback(
    <T extends ClientElement>(type: StateMessageCommands, payload: T) => {
      if (!documentId) return;
      bufferMessage({
        type: MessageType.STATE,
        command: type,
        payload:
          type !== MessageCommand.DELETE
            ? transformClientObjectToServer(payload)
            : { elementIds: [payload.id] },
      } as WSMessage);
    },
    [documentId, bufferMessage]
  );

  useEffect(() => {
    return () => {
      // This ensures that the canvas is cleared when switching views or navigating away
      // if I decide ti want to re-establish the socket each time -> ???
      flushState();
      flushDocument();
    };
  }, [documentId]);

  return (
    <GestureHandlerRootView style={gStyles.container}>
      <SkiaCn sendLocalState={sendLocalState} />
      <CanvasPointerMode switchView={switchView} />
      <Toolbar sendLocalState={sendLocalState} />
    </GestureHandlerRootView>
  );
}

const gStyles = StyleSheet.create({
  container: { flex: 1 },
});
