import { describe, expect, it } from "vitest";

import { sampleProject } from "./sample-project";
import {
  calculateAnimationProgress,
  clampTransitionProgress,
  getRestartedTransitionProgress,
  interpolateFormationPositions,
  interpolatePosition,
  parseScrubberProgress,
} from "./transition-playback";

const start = { x: 0.2, y: 0.8 };
const end = { x: 0.8, y: 0.2 };

describe("transition playback interpolation", () => {
  it("returns the start position at progress 0", () => {
    expect(interpolatePosition(start, end, 0)).toEqual(start);
  });

  it("returns the midpoint at progress 0.5", () => {
    expect(interpolatePosition(start, end, 0.5)).toEqual({
      x: 0.5,
      y: 0.5,
    });
  });

  it("returns the end position at progress 1", () => {
    expect(interpolatePosition(start, end, 1)).toEqual(end);
  });

  it("clamps progress slightly below 0 before interpolation", () => {
    const rawProgress = -Number.EPSILON;

    expect(clampTransitionProgress(rawProgress)).toBe(0);
    expect(() => interpolatePosition(start, end, rawProgress)).toThrow(
      RangeError,
    );
  });

  it("clamps progress slightly above 1 before interpolation", () => {
    const rawProgress = 1 + Number.EPSILON;

    expect(clampTransitionProgress(rawProgress)).toBe(1);
    expect(() => interpolatePosition(start, end, rawProgress)).toThrow(
      RangeError,
    );
  });

  it("returns exactly 1 when animation timing passes completion", () => {
    expect(calculateAnimationProgress(1_000.001, 0, 1_000)).toBe(1);
  });

  it("returns exactly 0 when a frame timestamp slightly precedes playback start", () => {
    expect(calculateAnimationProgress(999.999, 1_000, 1_000)).toBe(0);
  });

  it("returns exactly 0 for restart", () => {
    expect(getRestartedTransitionProgress()).toBe(0);
  });

  it.each(["", "not-a-number", "Infinity", "NaN"])(
    "rejects invalid scrubber input %j",
    (value) => {
      expect(parseScrubberProgress(value)).toEqual({
        ok: false,
        error: "Transition scrub value must be a finite percentage.",
      });
    },
  );

  it("clamps finite scrubber values to the playback boundary", () => {
    expect(parseScrubberProgress("-0.0001")).toEqual({
      ok: true,
      progress: 0,
    });
    expect(parseScrubberProgress("100.0001")).toEqual({
      ok: true,
      progress: 1,
    });
  });

  it("derives formation playback positions without changing saved formations", () => {
    const [formationA, formationB] = sampleProject.formations;
    const originalA = structuredClone(formationA.positions);
    const originalB = structuredClone(formationB.positions);

    const playbackPositions = interpolateFormationPositions(
      formationA,
      formationB,
      0.5,
    );

    expect(playbackPositions["dancer-02"]).toMatchObject({
      x: 0.375,
      y: 0.325,
    });
    expect(formationA.positions).toEqual(originalA);
    expect(formationB.positions).toEqual(originalB);
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid progress %s",
    (progress) => {
      expect(() => interpolatePosition(start, end, progress)).toThrow(
        RangeError,
      );
    },
  );
});
