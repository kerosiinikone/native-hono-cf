import {
  AbstractDoc,
  CList,
  CObject,
  CVar,
  DocOptions,
  InitToken,
  Serializer,
} from "@collabs/collabs";
import { ElementType } from "@native-hono-cf/shared";
import { Matrix4, rect, Skia, SkPath } from "@shopify/react-native-skia";
import { makeMutable, SharedValue } from "react-native-reanimated";

// AbstractDoc for element array (CanvasDoc) -> this is the state of the canvas,
// Each element is a CObject (element) that can be transformed to/from server state

export type UndoCommand = {
  type: "add" | "remove"; // In reverse (move later maybe)
  element: CElement; // The element that was added or removed
};

export interface ElementProperties {
  path: SkPath;
  type: ElementType;
  x: number;
  y: number;
  focalX: number;
  focalY: number;
  width: number;
  height: number;
  matrix: Matrix4;
}

class Matrix4Serializer implements Serializer<SharedValue<Matrix4>> {
  deserialize(message: Uint8Array): SharedValue<Matrix4> {
    if (message.length !== 64) {
      throw new Error(
        "Invalid Uint8Array length for a Matrix4. Expected 64 bytes."
      );
    }
    const alignedMessage = message.slice();
    const float32Array = new Float32Array(
      alignedMessage.buffer,
      alignedMessage.byteOffset,
      16
    );
    // Forced
    return makeMutable(
      Array.from(float32Array)
    ) as unknown as SharedValue<Matrix4>;
  }
  serialize(value: SharedValue<Matrix4>): Uint8Array {
    if (value.value.length !== 16) {
      throw new Error(
        "Input array must have 16 elements to represent a Matrix4."
      );
    }
    const float32Array = new Float32Array(value.value);
    return new Uint8Array(float32Array.buffer);
  }
}

class SkPathSerializer implements Serializer<SkPath> {
  deserialize(message: Uint8Array): SkPath {
    return (
      Skia.Path.MakeFromSVGString(new TextDecoder().decode(message)) ||
      Skia.Path.Make() // For now
    );
  }
  serialize(value: SkPath): Uint8Array {
    return new Uint8Array(new TextEncoder().encode(value.toSVGString()));
  }
}

export class CanvasDoc extends AbstractDoc {
  readonly elements: CList<CElement, []>;

  constructor(options?: DocOptions) {
    super(options);

    this.elements = this.runtime.registerCollab(
      "elements",
      (init) => new CList(init, (valueInit) => new CElement(valueInit))
    );
  }

  redo(op: UndoCommand): void {
    switch (op.type) {
      case "add":
        this.keepElement(op.element);
        break;
      case "remove":
        this.archiveElement(op.element);
        break;
    }
  }

  addElement(el: ElementProperties): CElement {
    const newEl = this.elements.push();
    newEl.init(el);
    return newEl;
  }

  removeElement(el: CElement): void {
    const idx = this.elements.indexOf(el);
    if (idx !== -1) {
      this.elements.archive(idx);
    }
  }

  private keepElement(el: CElement) {
    this.elements.restore(el);
  }

  private archiveElement(el: CElement) {
    const idx = this.elements.indexOf(el);
    if (idx !== -1) {
      this.elements.archive(idx);
    }
  }
}

export class CElement extends CObject {
  readonly type: CVar<ElementType>;
  readonly path: CVar<SkPath>;
  readonly matrix: CVar<SharedValue<Matrix4>>;
  readonly x: CVar<number>;
  readonly y: CVar<number>;
  readonly focalX: CVar<number>;
  readonly focalY: CVar<number>;
  readonly width: CVar<number>;
  readonly height: CVar<number>;

  constructor(init: InitToken) {
    super(init);

    this.type = super.registerCollab(
      "type",
      (init) => new CVar(init, ElementType.Path)
    );
    this.path = super.registerCollab(
      "path",
      (init) =>
        new CVar(init, Skia.Path.Make(), {
          valueSerializer: new SkPathSerializer(),
        })
    );
    this.matrix = super.registerCollab(
      "matrix",
      (init) =>
        new CVar(init, makeMutable(Matrix4()), {
          valueSerializer: new Matrix4Serializer(),
        })
    );
    this.x = super.registerCollab("x", (init) => new CVar(init, 0));
    this.y = super.registerCollab("y", (init) => new CVar(init, 0));
    this.focalX = super.registerCollab("focalX", (init) => new CVar(init, 0));
    this.focalY = super.registerCollab("focalY", (init) => new CVar(init, 0));
    this.width = super.registerCollab("width", (init) => new CVar(init, 0));
    this.height = super.registerCollab("height", (init) => new CVar(init, 0));
  }

  init(props: ElementProperties) {
    this.setType(props.type);
    this.setPos(props.x, props.y);
    this.setFocalPoint(props.focalX, props.focalY);
    this.setSize(props.width, props.height);
    this.setMatrix(props.matrix);
    this.setPath(props.path);
  }

  isStretchable(): boolean {
    return this.isRect();
  }

  isCircle(): boolean {
    return this.type.value === ElementType.Circle;
  }

  isRect(): boolean {
    return this.type.value === ElementType.Rect;
  }

  setPos(x: number, y: number): void {
    this.x.set(x);
    this.y.set(y);
  }

  setFocalPoint(focX: number, focY: number): void {
    this.focalX.set(focX);
    this.focalY.set(focY);
  }

  setSize(width: number, height: number): void {
    this.setWidth(width);
    this.setHeight(height);
  }

  setMatrix(matrix: Matrix4): void {
    this.matrix.set(makeMutable(matrix));
  }

  setPath(path: SkPath): void {
    this.path.set(path);
  }

  setType(type: ElementType): void {
    this.type.set(type);
  }

  // Mutates the CElement array -> must be manually rehydrated
  editRectWidth(newWidth: number, shiftX?: number): void {
    let nw = newWidth;
    if (!this.isRect()) return;
    if (newWidth < 50) {
      nw = 50;
    }
    this.setPos(shiftX ?? this.x.value, this.y.value);
    this.setFocalPoint(this.x.value + nw / 2, this.focalY.value);
    this.setSize(nw, this.height.value);
    this.setPath(
      Skia.Path.Make().addRect(
        rect(this.x.value, this.y.value, this.width.value, this.height.value)
      )
    );
  }

  // Mutates the CElement array -> must be manually rehydrated
  editRectHeight(newHeight: number, shiftY?: number): void {
    let nh = newHeight;
    if (!this.isRect()) return;
    if (newHeight < 50) {
      nh = 50;
    }
    this.setPos(this.x.value, shiftY ?? this.y.value);
    this.setFocalPoint(this.focalX.value, this.y.value + nh / 2);
    this.setSize(this.width.value, nh);
    this.setPath(
      Skia.Path.Make().addRect(
        rect(this.x.value, this.y.value, this.width.value, this.height.value)
      )
    );
  }

  private setWidth(width: number): void {
    this.width.set(width);
  }

  private setHeight(height: number): void {
    this.height.set(height);
  }
}
