import { describe, expect, it } from "vitest";

import {
  clampNormalizedCoordinate,
  clampNormalizedPoint,
  normalizedToScreen,
  screenToNormalized,
} from "./coordinates";

const screenRectangle = {
  left: 100,
  top: 50,
  width: 800,
  height: 400,
};

describe("coordinate conversion", () => {
  it("converts normalized coordinates to screen coordinates", () => {
    expect(normalizedToScreen({ x: 0.25, y: 0.75 }, screenRectangle)).toEqual({
      x: 300,
      y: 350,
    });
  });

  it("converts screen coordinates to normalized coordinates", () => {
    expect(screenToNormalized({ x: 300, y: 350 }, screenRectangle)).toEqual({
      x: 0.25,
      y: 0.75,
    });
  });

  it("preserves coordinates through a round trip", () => {
    const normalizedPoint = { x: 0.42, y: 0.18 };
    const screenPoint = normalizedToScreen(normalizedPoint, screenRectangle);

    expect(screenToNormalized(screenPoint, screenRectangle)).toEqual(
      normalizedPoint,
    );
  });

  it("clamps coordinates to the stage boundary", () => {
    expect(clampNormalizedCoordinate(-0.2)).toBe(0);
    expect(clampNormalizedCoordinate(0.4)).toBe(0.4);
    expect(clampNormalizedCoordinate(1.2)).toBe(1);
    expect(clampNormalizedPoint({ x: -0.2, y: 1.2 })).toEqual({
      x: 0,
      y: 1,
    });
  });

  it("rejects invalid screen dimensions", () => {
    expect(() =>
      screenToNormalized({ x: 300, y: 350 }, { ...screenRectangle, width: 0 }),
    ).toThrow(RangeError);
  });
});
