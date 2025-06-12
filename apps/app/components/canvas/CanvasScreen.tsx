import { useDocumentStore } from "@/state/document";
import {
  ClientElement,
  transformClientObjectToServer,
  withSkia_useCanvasStore,
} from "@/state/with-skia";
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

interface CanvasScreenProps {
  switchView: () => void;
  bufferMessage: (message: WSMessage) => void;
}

export default function CanvasScreen({
  switchView,
  bufferMessage,
}: CanvasScreenProps) {
  const { documentId, globalCanvasMessageQueue, popMessageFromQueue } =
    useDocumentStore((state) => state);
  const { setLocalFromServerState } = withSkia_useCanvasStore((state) => state);

  // Leave and abstract this to the store to handle the state updates?
  const handleStateReceive = useCallback(
    (msg: WSMessage) => {
      const { command, payload } = msg as WSMessage;
      setLocalFromServerState(payload as DocumentStateUpdate, command);
    },
    [documentId]
  );

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
      });
    },
    [documentId, bufferMessage]
  );

  useEffect(() => {
    for (let i = globalCanvasMessageQueue.length - 1; i >= 0; i--) {
      const message = globalCanvasMessageQueue[i];
      if (!message || !message.payload) continue;
      if (message.type === MessageType.TEXT_STATE) continue;
      handleStateReceive(message);
      popMessageFromQueue("canvas");
    }
  }, [globalCanvasMessageQueue, popMessageFromQueue, handleStateReceive]);

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
