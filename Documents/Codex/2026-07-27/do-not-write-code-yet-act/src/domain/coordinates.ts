import type { NormalizedPoint } from "./types";

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface ScreenRectangle {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function assertFinitePoint(point: ScreenPoint, name: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError(`${name} coordinates must be finite numbers.`);
  }
}

function assertValidRectangle(rectangle: ScreenRectangle): void {
  if (
    !Number.isFinite(rectangle.left) ||
    !Number.isFinite(rectangle.top) ||
    !Number.isFinite(rectangle.width) ||
    !Number.isFinite(rectangle.height) ||
    rectangle.width <= 0 ||
    rectangle.height <= 0
  ) {
    throw new RangeError(
      "Screen rectangle must have finite coordinates and positive dimensions.",
    );
  }
}

export function normalizedToScreen(
  point: NormalizedPoint,
  rectangle: ScreenRectangle,
): ScreenPoint {
  assertFinitePoint(point, "Normalized");
  assertValidRectangle(rectangle);

  return {
    x: rectangle.left + point.x * rectangle.width,
    y: rectangle.top + point.y * rectangle.height,
  };
}

export function screenToNormalized(
  point: ScreenPoint,
  rectangle: ScreenRectangle,
): NormalizedPoint {
  assertFinitePoint(point, "Screen");
  assertValidRectangle(rectangle);

  return {
    x: (point.x - rectangle.left) / rectangle.width,
    y: (point.y - rectangle.top) / rectangle.height,
  };
}

export function clampNormalizedCoordinate(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("Normalized coordinate must be a finite number.");
  }

  return Math.min(1, Math.max(0, value));
}

export function clampNormalizedPoint(point: NormalizedPoint): NormalizedPoint {
  return {
    x: clampNormalizedCoordinate(point.x),
    y: clampNormalizedCoordinate(point.y),
  };
}
