import { useWebSocket } from "@/hooks/useWebSocket";
import {
  ClientPathElement,
  transferClientPathToServer,
  useDocumentStore,
} from "@/state/store";
import { MessageCommand, MessageType } from "@native-hono-cf/shared";
import { useCallback } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CanvasPointerMode } from "../ui/CanvasPointerMode";
import Toolbar from "../ui/Toolbar";
import SkiaCn from "./SkiaCn";

export default function CanvasScreen() {
  const { documentId, setLocalFromServerState } = useDocumentStore(
    (state) => state
  );

  const handleStateReceive = useCallback(setLocalFromServerState, [documentId]);

  const { bufferMessage } = useWebSocket({
    documentId: documentId,
    onStateReceived: handleStateReceive,
  });

  const sendLocalState = useCallback(
    <T extends ClientPathElement>(type: MessageCommand, payload: T) => {
      if (!documentId) return;
      bufferMessage({
        type: MessageType.STATE,
        method: type,
        payload: transferClientPathToServer(payload),
      });
    },
    [documentId, bufferMessage]
  );

  return (
    <GestureHandlerRootView style={gStyles.container}>
      <SkiaCn sendLocalState={sendLocalState} />
      <CanvasPointerMode />
      <Toolbar sendLocalState={sendLocalState} />
    </GestureHandlerRootView>
  );
}

const gStyles = StyleSheet.create({
  container: { flex: 1 },
});
