import { Matrix4 } from "react-native-redash";

// TODO: Concat types from store and components

export type DrawingMode = "draw" | "select" | "move";

export enum ElementType {
  Path = "path",
}

export enum MessageType {
  SETUP = "setup",
  STATE = "state",
  ERROR = "error",
  PING = "ping",
  PONG = "pong",
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

export type DocumentStateUpdate =
  | Readonly<Element>
  | ReadonlyArray<Readonly<Element>>;

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
}

// Only support path elements for now
export type Element = {
  id: string;
  type: ElementType.Path;
  properties: PathElementProperties;
};

export interface PathElement extends Element {
  id: string;
  type: ElementType.Path;
  properties: PathElementProperties;
}

export interface SetupMessage {
  type: MessageType.SETUP;
  command: MessageCommand.INFO;
  payload: {
    clientId?: string;
  };
}

export interface StateUpdateMessage {
  type: MessageType.STATE;
  command: StateMessageCommands;
  payload: DocumentStateUpdate;
}

export interface StateDeleteMessage {
  type: MessageType.STATE;
  command: MessageCommand.DELETE;
  payload: { elementIds: string[] };
}

export interface ErrorMessage {
  type: MessageType.ERROR;
  command: MessageCommand.INFO;
  payload: {
    message: string;
  };
}

export type WSMessage =
  | SetupMessage
  | StateUpdateMessage
  | StateDeleteMessage
  | ErrorMessage;
