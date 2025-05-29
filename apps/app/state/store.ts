import {
  DocumentStateUpdate,
  DrawingMode,
  Element,
  ElementType,
  MessageCommand,
  PathElement,
} from "@native-hono-cf/shared";
import { Matrix4, rect, Skia, SkPath } from "@shopify/react-native-skia";
import { makeMutable, SharedValue } from "react-native-reanimated";
import { create } from "zustand";

// TODO: Helpers and more elegent logic

export type ClientObject = {
  path: SkPath;
  x: number;
  y: number;
  focalX: number;
  focalY: number;
  width: number;
  height: number;
  matrix: SharedValue<Matrix4>;
  stretchable: boolean;
};

export interface ClientElement {
  id: string;
  type: ElementType;
  properties: ClientObject;
}

type State = {
  documentId: string | null;
  elements: ClientElement[];
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
  addElement: (elementData: ClientObject, type?: ElementType) => ClientElement;
  removeElement: (id: string) => ClientElement | null;
  updateElementMatrix: (
    elementId: string,
    newMatrix: Matrix4
  ) => ClientElement | null;
};

type RectActions = {
  editRectWidth: (id: string, newWidth: number, shiftX?: number) => void;
  editRectHeight: (id: string, newHeight: number, shiftY?: number) => void;
};

function transformServerPathToClient(
  serverPath: Element
): ClientElement | null {
  if (!serverPath.properties.path) return null;
  const skPath = Skia.Path.MakeFromSVGString(serverPath.properties.path);
  if (!skPath) return null;
  return {
    id: serverPath.id,
    type: serverPath.type,
    properties: {
      ...serverPath.properties,
      path: skPath,
      matrix: makeMutable(serverPath.properties.matrix),
    },
  };
}

export function transferClientPathToServer(clientPath: ClientElement): Element {
  return {
    id: clientPath.id,
    type: clientPath.type,
    properties: {
      ...clientPath.properties,
      matrix: clientPath.properties.matrix.value,
      path: clientPath.properties.path.toSVGString(),
    },
  };
}

export const useDocumentStore = create<State & Actions & RectActions>(
  (set, get) => ({
    documentId: "289d4f3c-3617-45cb-a696-15ed24386388",
    elements: [],
    drawingMode: "draw",
    canvasMatrix: makeMutable(Matrix4()),

    setDocumentId: (id) => set({ documentId: id }),
    setDrawingMode: (mode) => set({ drawingMode: mode }),

    // Optimize
    editRectWidth: (id, newWidth, shiftX) => {
      const path = get().elements.find((el) => el.id === id);
      if (!path || path.type !== ElementType.Rect) return;

      const newPath = Skia.Path.Make();
      const r = newPath.addRect(
        rect(
          shiftX ?? path.properties.x,
          path.properties.y,
          newWidth,
          path.properties.height
        )
      );

      set((state) => ({
        elements: state.elements.map((el) => {
          if (el.id === id) {
            return {
              ...el,
              properties: {
                ...el.properties,
                path: r,
                x: shiftX ?? path.properties.x,
                focalX: newWidth / 2,
                width: newWidth,
              },
            };
          }
          return el;
        }),
      }));
    },

    editRectHeight: (id, newHeight, shiftY) => {
      const path = get().elements.find((el) => el.id === id);
      if (!path || path.type !== ElementType.Rect) return;

      const newPath = Skia.Path.Make();
      const r = newPath.addRect(
        rect(
          path.properties.x,
          shiftY ?? path.properties.y,
          path.properties.width,
          newHeight
        )
      );

      set((state) => ({
        elements: state.elements.map((el) => {
          if (el.id === id) {
            return {
              ...el,
              properties: {
                ...el.properties,
                path: r,
                y: shiftY ?? path.properties.y,
                focalY: newHeight / 2,
                height: newHeight,
              },
            };
          }
          return el;
        }),
      }));
    },

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
          ) as ClientElement[],
        }));
        return;
      }
      set((state) => ({
        elements: state.elements.concat(
          [serverState as DocumentStateUpdate]
            .flat()
            .map((el) => transformServerPathToClient(el))
            .filter(Boolean) as ClientElement[]
        ),
      }));
    },

    addElement: (elementData, type) => {
      const newElement: ClientElement = {
        id: crypto.randomUUID(),
        type: type ?? ElementType.Path,
        properties: elementData,
      };
      set((state) => ({
        elements: [...state.elements, newElement],
      }));
      return newElement;
    },

    removeElement: (id) => {
      let removedElement: ClientElement | null = null;
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
      let updatedElement: ClientElement | null = null;
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
  })
);
