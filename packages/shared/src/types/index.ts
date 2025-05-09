import { Matrix4 } from "react-native-redash";

// TODO: Concat types from store and components

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

export type DocumentStateUpdate = Element | Element[];

export type WSMessage = {
  type: MessageType;
  method: MessageCommand;
  senderId?: string;
  payload?: string | DocumentStateUpdate;
};

export interface DocumentState {
  elements: Element[];
  // ...
}

export interface Element {
  id: string;
  type: ElementType;
  properties: {
    x: number;
    y: number;
    focalX: number;
    focalY: number;
    width: number;
    height: number;
    matrix: Matrix4;
  } & Record<string, any>; // Additional properties can be added here
}

export interface PathElement extends Element {
  id: string;
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
