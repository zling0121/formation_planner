import { describe, expect, it } from "vitest";

import {
  calculateStageTravelDistance,
  isEffectivelyStationaryTransition,
  isEffectivelyStationaryTravelDistance,
  STATIONARY_TRAVEL_DISTANCE_TOLERANCE,
} from "./travel-distance";

describe("travel-distance presentation", () => {
  const stage = { width: 36, depth: 24, unit: "feet" } as const;

  it("calculates physical travel from normalized positions", () => {
    expect(
      calculateStageTravelDistance(
        { x: 0.2, y: 0.25 },
        { x: 0.4, y: 0.25 },
        stage,
      ),
    ).toBeCloseTo(7.2, 12);
  });

  it("treats sub-microscopic endpoint residue as stationary", () => {
    expect(
      isEffectivelyStationaryTransition(
        { x: 0.2, y: 0.25 },
        { x: 0.200000007197542, y: 0.25 },
        stage,
      ),
    ).toBe(true);
  });

  it("treats numerical coordinate residue as stationary", () => {
    expect(
      isEffectivelyStationaryTravelDistance(
        STATIONARY_TRAVEL_DISTANCE_TOLERANCE,
      ),
    ).toBe(true);
  });

  it("preserves movement above the stationary tolerance", () => {
    expect(
      isEffectivelyStationaryTravelDistance(
        STATIONARY_TRAVEL_DISTANCE_TOLERANCE * 2,
      ),
    ).toBe(false);
  });

  it("preserves visible transition movement", () => {
    expect(
      isEffectivelyStationaryTransition(
        { x: 0.2, y: 0.25 },
        { x: 0.4, y: 0.25 },
        stage,
      ),
    ).toBe(false);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.01])(
    "rejects invalid travel distance %s",
    (distance) => {
      expect(() =>
        isEffectivelyStationaryTravelDistance(distance),
      ).toThrowError(
        new RangeError(
          "Travel distance must be a finite, non-negative number.",
        ),
      );
    },
  );
});
