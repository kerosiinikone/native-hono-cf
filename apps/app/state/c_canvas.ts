import {
  AbstractDoc,
  CList,
  CObject,
  CVar,
  DocOptions,
  InitToken,
} from "@collabs/collabs";
import { ElementType } from "@native-hono-cf/shared";
import { Matrix4, rect, Skia, SkPath } from "@shopify/react-native-skia";
import { makeMutable, SharedValue } from "react-native-reanimated";

// AbstractDoc for element array (CanvasDoc) -> this is the state of the canvas,
// Each element is a CObject (element) that can be transformed to/from server state

interface ElementProperties {
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

// TODO
class Matrix4Serializer {}
class SkPathSerializer {}

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

  updateElementMatrix(el: CElement, newMatrix: Matrix4): CElement {
    el.setMatrix(newMatrix);
    return el;
  }
}

// Split into CPathProperties and CElement?
export class CElement extends CObject {
  // Make the rest of these private?
  readonly type: CVar<ElementType>;
  readonly path: CVar<SkPath>;
  readonly matrix: CVar<SharedValue<Matrix4>>;
  readonly stretchable: CVar<boolean>;
  private readonly x: CVar<number>;
  private readonly y: CVar<number>;
  private readonly focalX: CVar<number>;
  private readonly focalY: CVar<number>;
  private readonly width: CVar<number>;
  private readonly height: CVar<number>;

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
          valueSerializer: {
            deserialize(message) {
              return (
                Skia.Path.MakeFromSVGString(
                  new TextDecoder().decode(message)
                ) || Skia.Path.Make()
              );
            },
            serialize(value) {
              return new Uint8Array(
                new TextEncoder().encode(value.toSVGString())
              );
            },
          },
        })
    );
    this.matrix = super.registerCollab(
      "matrix",
      (init) =>
        new CVar(init, makeMutable(Matrix4()), {
          valueSerializer: {
            deserialize(message) {
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
              return makeMutable(
                Array.from(float32Array)
              ) as unknown as SharedValue<Matrix4>;
            },
            serialize(value) {
              if (value.value.length !== 16) {
                throw new Error(
                  "Input array must have 16 elements to represent a Matrix4."
                );
              }
              const float32Array = new Float32Array(value.value);
              return new Uint8Array(float32Array.buffer);
            },
          },
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
