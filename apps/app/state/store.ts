import {
  DocumentStateUpdate,
  DrawingMode,
  Element,
  ElementType,
  MessageCommand,
  PathElement,
} from "@native-hono-cf/shared";
import { Matrix4, Skia, SkPath } from "@shopify/react-native-skia";
import { makeMutable, SharedValue } from "react-native-reanimated";
import { create } from "zustand";

// Differs from Element's path properties
export type ClientPath = {
  path: SkPath;
  x: number;
  y: number;
  focalX: number;
  focalY: number;
  width: number;
  height: number;
  matrix: SharedValue<Matrix4>;
};

export interface ClientElement {
  id: string;
  type: ElementType;
  properties: Record<string, any>; // Additional properties can be added here
}

export interface ClientPathElement extends ClientElement {
  type: ElementType.Path;
  properties: ClientPath;
}

// Immer is for updating the state in an immutable way (array and object updates) -> note for self

type State = {
  documentId: string | null;
  elements: ClientPathElement[];
  drawingMode: DrawingMode;
  canvasMatrix: SharedValue<Matrix4>;
};

type Actions = {
  setDocumentId: (id: string | null) => void;
  setDrawingMode: (mode: DrawingMode) => void;
  setLocalFromServerState: (
    serverState:
      | DocumentStateUpdate
      | {
          elementIds: string[];
        },
    command: MessageCommand
  ) => void;
  addElement: (elementData: ClientPath) => ClientPathElement;
  removeElement: (id: string) => ClientPathElement | null;
  updateElementMatrix: (
    elementId: string,
    newMatrix: Matrix4
  ) => ClientPathElement | null;
};

function transformServerPathToClient(
  serverPath: PathElement
): ClientPathElement | null {
  if (!serverPath.properties.path) return null;
  const skPath = Skia.Path.MakeFromSVGString(serverPath.properties.path);
  if (!skPath) return null;
  return {
    id: serverPath.id,
    type: ElementType.Path,
    properties: {
      ...serverPath.properties,
      path: skPath,
      matrix: makeMutable(serverPath.properties.matrix),
    },
  };
}

// TODO: Make more generic
export function transferClientPathToServer(
  clientPath: ClientPathElement
): PathElement {
  return {
    id: clientPath.id,
    type: ElementType.Path,
    properties: {
      ...clientPath.properties,
      matrix: clientPath.properties.matrix.value,
      path: clientPath.properties.path.toSVGString(),
    },
  };
}

export const useDocumentStore = create<State & Actions>((set) => ({
  documentId: "289d4f3c-3617-45cb-a696-15ed24386388", // test
  elements: [],
  drawingMode: "draw",
  canvasMatrix: makeMutable(Matrix4()),

  setDocumentId: (id) => set({ documentId: id }),

  setDrawingMode: (mode) => set({ drawingMode: mode }),

  setLocalFromServerState: (serverState, cmd) => {
    if (cmd === MessageCommand.DELETE) {
      const elementIds = (
        serverState as {
          elementIds: string[];
        }
      ).elementIds;
      set((state) => ({
        elements: state.elements.filter((el) => !elementIds.includes(el.id)),
      }));
      return;
    }
    if (cmd === MessageCommand.UPDATE) {
      set(({ elements }) => ({
        elements: elements.map((el) =>
          el.id === (serverState as PathElement).id
            ? transformServerPathToClient({
                ...el,
                properties: (serverState as PathElement).properties,
              })
            : el
        ) as ClientPathElement[],
      }));
      return;
    }
    set((state) => ({
      elements: state.elements.concat(
        [serverState as DocumentStateUpdate]
          .flat()
          .filter((el) => el.type === "path")
          .map((el) => transformServerPathToClient(el as PathElement))
          .filter(Boolean) as ClientPathElement[]
      ),
    }));
  },

  addElement: (elementData) => {
    const newElement: ClientPathElement = {
      id: crypto.randomUUID(),
      type: ElementType.Path,
      properties: elementData,
    };
    set((state) => ({
      elements: [...state.elements, newElement],
    }));
    return newElement;
  },

  removeElement: (id) => {
    let removedElement: ClientPathElement | null = null;
    set((state) => ({
      elements: state.elements.filter((el) => {
        if (el.id === id) {
          removedElement = el;
          return false;
        }
        return true;
      }),
    }));
    return removedElement;
  },

  updateElementMatrix: (elementId, newMatrix) => {
    let updatedElement: ClientPathElement | null = null;
    set((state) => {
      const element = state.elements.find((el) => el.id === elementId);
      if (element && element.properties.matrix) {
        updatedElement = element;
        element.properties.matrix.value = newMatrix;
      }
      return { elements: [...state.elements] };
    });
    return updatedElement;
  },
}));
