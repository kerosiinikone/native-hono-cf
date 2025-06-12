import { Matrix4 } from "react-native-redash";

// TODO: Split into multiple files for better organization

export type DrawingMode = "draw" | "select" | "move";

export enum ElementType {
  Path = "path",
  Rect = "rect",
  Circle = "circle",
}

export enum MessageType {
  SETUP = "setup",
  STATE = "state",
  ERROR = "error",
  PING = "ping",
  PONG = "pong",
  TEXT_STATE = "text_state",
}

export enum MessageCommand {
  UPDATE = "update",
  DELETE = "delete",
  ADD = "add",
  INFO = "info",
}

export type StateMessageCommands =
  | MessageCommand.ADD
  | MessageCommand.UPDATE
  | MessageCommand.DELETE;

export interface DocumentState {
  elements: Element[];
}

export interface TextDocumentState {
  heading: string;
  text: string;
}

export interface TextDocumentStateUpdate {
  heading?: string;
  headingOffset?: number;
  headingEnd?: number;

  text?: string;
  textOffset?: number;
  textEnd?: number;
}

export type DocumentStateUpdate =
  | Readonly<Element>
  | ReadonlyArray<Readonly<Element>>
  | Readonly<{
      elementIds: string[];
    }>;

export interface BaseElementProperties {
  x: number;
  y: number;
  focalX: number;
  focalY: number;
  width: number;
  height: number;
  matrix: Matrix4;
}

export interface PathElementProperties extends BaseElementProperties {
  path: string;
  stretchable: false;
}

export interface RectPathElementProperties extends BaseElementProperties {
  path: string;
  stretchable: true;
}

export type Element = {
  id: string;
  type: ElementType;
  properties: RectPathElementProperties | PathElementProperties;
};

export interface PathElement extends Element {
  id: string;
  type: ElementType.Path;
  properties: PathElementProperties;
}

export interface RectElement extends Element {
  id: string;
  type: ElementType.Rect;
  properties: RectPathElementProperties;
}

export interface SetupMessage {
  type: MessageType.SETUP;
  command: MessageCommand.INFO;
  payload: null;
}

export interface StateUpdateMessage {
  type: MessageType.STATE;
  command: StateMessageCommands;
  payload: DocumentStateUpdate;
}

export interface ErrorMessage {
  type: MessageType.ERROR;
  command: MessageCommand.INFO;
  payload: {
    message: string;
  };
}

export interface TextPatchMessage {
  type: MessageType.TEXT_STATE;
  command: StateMessageCommands;
  payload: {
    state: TextDocumentStateUpdate;
  };
}

export type WSMessage =
  | SetupMessage
  | StateUpdateMessage
  | ErrorMessage
  | TextPatchMessage;
// | CursorUpdateMessage
