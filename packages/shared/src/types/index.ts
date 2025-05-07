import { Matrix4 } from "react-native-redash";

enum ElementType {
  Path = "path",
}

export enum MessageType {
  SETUP = "setup",
  STATE = "state",
  ERROR = "error",
  PING = "ping",
  PONG = "pong",
}

export type WSMessage = {
  type: MessageType;
  senderId?: string;
  payload?: string | DocumentStateUpdate;
};

export interface DocumentState {
  elements: Element[];
  // ...
}

export type DocumentStateUpdate = Partial<DocumentState>;

export interface Element {
  id: string;
  type: ElementType;
  properties: Record<string, any>;
  children?: Element[];
}

export interface PathElement extends Element {
  type: ElementType.Path;
  properties: {
    path: string;
    x: number;
    y: number;
    focalX: number;
    focalY: number;
    width: number;
    height: number;
    matrix: Matrix4;
  };
}
