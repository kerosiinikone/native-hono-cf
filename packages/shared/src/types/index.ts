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
  SNAPSHOT = "snapshot",
  PING = "ping",
  PONG = "pong",
  TEXT_STATE = "text_state",
}

export enum MessageCommand {
  UPDATE = "update",
  DELETE = "delete",
  INFO = "info",
  SNAPSHOT = "snapshot",
}

export type StateMessageCommands =
  | MessageCommand.UPDATE
  | MessageCommand.SNAPSHOT;

export interface DocumentState {
  elements: Element[];
}

export type DocumentStateUpdate = Readonly<string>;

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

export interface SnapshotUpstream {
  type: MessageType.STATE;
  command: MessageCommand.SNAPSHOT;
  payload: DocumentStateUpdate;
}

export interface SnapshotDownstream {
  type: MessageType.SETUP;
  command: MessageCommand.SNAPSHOT;
  payload: DocumentStateUpdate;
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
  payload: DocumentStateUpdate;
}

export type WSMessage =
  | SetupMessage
  | StateUpdateMessage
  | ErrorMessage
  | TextPatchMessage
  | SnapshotUpstream
  | SnapshotDownstream;
