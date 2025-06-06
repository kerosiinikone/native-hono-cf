import { useWebSocket } from "@/hooks/useWebSocket";
import {
  ClientElement,
  transferClientObjectToServer,
  useDocumentStore,
} from "@/state/store";
import {
  MessageCommand,
  MessageType,
  StateMessageCommands,
  WSMessage,
} from "@native-hono-cf/shared";
import { useCallback } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CanvasPointerMode } from "../ui/CanvasPointerMode";
import Toolbar from "../ui/CanvasToolbar";
import SkiaCn from "./SkiaCn";

export default function CanvasScreen({
  switchView,
}: {
  switchView: () => void;
}) {
  const { documentId, setLocalFromServerState } = useDocumentStore(
    (state) => state
  );

  const handleStateReceive = useCallback(setLocalFromServerState, [documentId]);

  // Move these higher up?
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
            ? transferClientObjectToServer(payload)
            : { elementIds: [payload.id] },
      } as WSMessage);
    },
    [documentId, bufferMessage]
  );

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
