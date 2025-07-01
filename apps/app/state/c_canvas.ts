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

export interface ElementProperties {
  path: SkPath;
  type: ElementType;
  stretchable: boolean;
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

  addElement(el: ElementProperties): void {
    const newEl = this.elements.push();
    newEl.setPos(el.x, el.y);
    newEl.setFocalPoint(el.focalX, el.focalY);
    newEl.setSize(el.width, el.height);
    newEl.setMatrix(el.matrix);
    newEl.setPath(el.path);
    newEl.setType(el.type);
    newEl.stretchable.set(el.stretchable);
  }

  removeElement(el: CElement): void {
    const idx = this.elements.indexOf(el);
    if (idx !== -1) {
      this.elements.delete(idx);
    }
  }

  // Keep element?
  // Archive element?

  // TODO: Transfer protocol util functions here (or make them into
  // hooks of their own) !!!
}

export class CElement extends CObject {
  readonly type: CVar<ElementType>;
  readonly path: CVar<SkPath>;
  readonly matrix: CVar<SharedValue<Matrix4>>;
  readonly stretchable: CVar<boolean>;
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
    this.stretchable = super.registerCollab(
      "stretchable",
      (init) => new CVar(init, this._isRect())
    );
  }

  // TODO: Getters not needed

  posX(): number {
    return this.x.value;
  }

  posY(): number {
    return this.y.value;
  }

  focX(): number {
    return this.focalX.value;
  }

  focY(): number {
    return this.focalY.value;
  }

  elementWidth(): number {
    return this.width.value;
  }

  elementHeight(): number {
    return this.height.value;
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
    this.stretchable.set(this._isRect());
  }

  editRectWidth(newWidth: number, shiftX: number = 0): void {
    if (!this._isRect()) return;
    if (newWidth < 50) {
      newWidth = 50;
    }
    this.setPath(
      Skia.Path.Make().addRect(
        rect(shiftX ?? this.posX, this.posY(), newWidth, this.elementHeight())
      )
    );
    this.setPos(shiftX ?? this.posX(), this.posY());
    this.setFocalPoint(this.posX() + newWidth / 2, this.focY());
    this.setSize(newWidth, this.elementHeight());
  }

  editRectHeight(newHeight: number, shiftY: number = 0): void {
    if (!this._isRect()) return;
    if (newHeight < 50) {
      newHeight = 50;
    }
    this.setPath(
      Skia.Path.Make().addRect(
        rect(this.posX(), shiftY ?? this.posY(), this.elementWidth(), newHeight)
      )
    );
    this.setPos(this.posX(), shiftY ?? this.posY());
    this.setFocalPoint(this.focX(), this.posY() + newHeight / 2);
    this.setSize(this.elementWidth(), newHeight);
  }

  isCircle(): boolean {
    return this.type.value === ElementType.Circle;
  }

  private setWidth(width: number): void {
    this.width.set(width);
  }

  private setHeight(height: number): void {
    this.height.set(height);
  }

  private _isRect(): boolean {
    return this.type.value === ElementType.Rect;
  }
}

export class CPathElement extends CElement {}
export class CCircleElement extends CElement {}
export class CRectElement extends CElement {}
