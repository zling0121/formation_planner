import { describe, expect, it } from "vitest";

import { sampleProject } from "./sample-project";
import { analyzeTransitionSafety } from "./safety-engine";
import type {
  DancerPosition,
  Formation,
  NormalizedPoint,
  Stage,
} from "./types";

const defaultStage: Stage = {
  width: 10,
  depth: 10,
  unit: "feet",
};

function dancerPosition(
  dancerId: "dancer-1" | "dancer-2",
  point: NormalizedPoint,
): DancerPosition {
  return {
    dancerId,
    ...point,
  };
}

function analyzeTwoDancers({
  start1,
  end1,
  start2,
  end2,
  threshold = 1,
  stage = defaultStage,
}: {
  readonly start1: NormalizedPoint;
  readonly end1: NormalizedPoint;
  readonly start2: NormalizedPoint;
  readonly end2: NormalizedPoint;
  readonly threshold?: number;
  readonly stage?: Stage;
}) {
  const formationA: Formation = {
    id: "formation-a",
    name: "Formation A",
    positions: {
      "dancer-1": dancerPosition("dancer-1", start1),
      "dancer-2": dancerPosition("dancer-2", start2),
    },
  };
  const formationB: Formation = {
    id: "formation-b",
    name: "Formation B",
    positions: {
      "dancer-1": dancerPosition("dancer-1", end1),
      "dancer-2": dancerPosition("dancer-2", end2),
    },
  };

  return analyzeTransitionSafety({
    transitionId: "transition-test",
    stage,
    dancers: [
      { id: "dancer-1", label: "One" },
      { id: "dancer-2", label: "Two" },
    ],
    formationA,
    formationB,
    safetyThreshold: threshold,
  });
}

describe("transition safety engine", () => {
  it("finds a simultaneous perpendicular crossing analytically", () => {
    const result = analyzeTwoDancers({
      start1: { x: 0, y: 0.5 },
      end1: { x: 1, y: 0.5 },
      start2: { x: 0.5, y: 0 },
      end2: { x: 0.5, y: 1 },
      threshold: 0.5,
    });
    const pair = result.pairSeparations[0];

    expect(pair.minimumSeparation).toBe(0);
    expect(pair.closestApproachTime).toBe(0.5);
    expect(pair.closestPositions).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ]);
    expect(pair.isConflict).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.pathIntersections).toEqual([
      {
        kind: "point",
        dancerIds: ["dancer-1", "dancer-2"],
        position: { x: 0.5, y: 0.5 },
        pathProgress: [0.5, 0.5],
      },
    ]);
  });

  it("detects a direct two-dancer position swap as a safety conflict", () => {
    const result = analyzeTwoDancers({
      start1: { x: 0.25, y: 0.5 },
      end1: { x: 0.75, y: 0.5 },
      start2: { x: 0.75, y: 0.5 },
      end2: { x: 0.25, y: 0.5 },
      threshold: 1,
    });
    const pair = result.pairSeparations[0];

    expect(pair.minimumSeparation).toBeCloseTo(0, 12);
    expect(pair.closestApproachTime).toBeCloseTo(0.5, 12);
    expect(pair.closestPositions).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ]);
    expect(pair.isConflict).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].dancerIds).toEqual(["dancer-1", "dancer-2"]);
  });

  it("handles two stationary dancers and reports the earliest constant minimum", () => {
    const result = analyzeTwoDancers({
      start1: { x: 0, y: 0 },
      end1: { x: 0, y: 0 },
      start2: { x: 0.3, y: 0.4 },
      end2: { x: 0.3, y: 0.4 },
      threshold: 5,
    });
    const pair = result.pairSeparations[0];

    expect(pair.minimumSeparation).toBe(5);
    expect(pair.closestApproachTime).toBe(0);
    expect(pair.isConflict).toBe(false);
    expect(result.travelDistances).toEqual({
      "dancer-1": 0,
      "dancer-2": 0,
    });
    expect(result.totalTravelDistance).toBe(0);
    expect(result.maximumIndividualTravelDistance).toBe(0);
    expect(result.pathIntersections).toHaveLength(0);
  });

  it("handles one stationary dancer on another dancer's path", () => {
    const result = analyzeTwoDancers({
      start1: { x: 0.5, y: 0.5 },
      end1: { x: 0.5, y: 0.5 },
      start2: { x: 0, y: 0.5 },
      end2: { x: 1, y: 0.5 },
      threshold: 0.1,
    });
    const pair = result.pairSeparations[0];

    expect(pair.minimumSeparation).toBe(0);
    expect(pair.closestApproachTime).toBe(0.5);
    expect(result.pathIntersections).toEqual([
      {
        kind: "point",
        dancerIds: ["dancer-1", "dancer-2"],
        position: { x: 0.5, y: 0.5 },
        pathProgress: [0, 0.5],
      },
    ]);
  });

  it("reports time 0 for identical start positions", () => {
    const result = analyzeTwoDancers({
      start1: { x: 0.5, y: 0.5 },
      end1: { x: 0, y: 0.5 },
      start2: { x: 0.5, y: 0.5 },
      end2: { x: 1, y: 0.5 },
      threshold: 0.01,
    });

    expect(result.pairSeparations[0]).toMatchObject({
      minimumSeparation: 0,
      closestApproachTime: 0,
      isConflict: true,
    });
  });

  it("reports time 1 for identical end positions", () => {
    const result = analyzeTwoDancers({
      start1: { x: 0, y: 0.5 },
      end1: { x: 0.5, y: 0.5 },
      start2: { x: 1, y: 0.5 },
      end2: { x: 0.5, y: 0.5 },
      threshold: 0.01,
    });

    expect(result.pairSeparations[0]).toMatchObject({
      minimumSeparation: 0,
      closestApproachTime: 1,
      isConflict: true,
    });
  });

  it("handles parallel equal-velocity movement with constant separation", () => {
    const result = analyzeTwoDancers({
      start1: { x: 0, y: 0 },
      end1: { x: 1, y: 0 },
      start2: { x: 0, y: 0.5 },
      end2: { x: 1, y: 0.5 },
      threshold: 3,
      stage: { width: 10, depth: 6, unit: "feet" },
    });
    const pair = result.pairSeparations[0];

    expect(pair.minimumSeparation).toBe(3);
    expect(pair.closestApproachTime).toBe(0);
    expect(pair.isConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);
    expect(result.pathIntersections).toHaveLength(0);
  });

  it("distinguishes geometric crossing at different times from simultaneous proximity", () => {
    const result = analyzeTwoDancers({
      start1: { x: 0, y: 0.5 },
      end1: { x: 1, y: 0.5 },
      start2: { x: 0.5, y: 0 },
      end2: { x: 0.5, y: 0.75 },
      threshold: 0.5,
    });
    const pair = result.pairSeparations[0];
    const intersection = result.pathIntersections[0];

    expect(pair.closestApproachTime).toBeCloseTo(0.56, 12);
    expect(pair.minimumSeparation).toBeCloseTo(1, 12);
    expect(pair.closestPositions[0]).toEqual({ x: 0.56, y: 0.5 });
    expect(pair.closestPositions[1].x).toBe(0.5);
    expect(pair.closestPositions[1].y).toBeCloseTo(0.42, 12);
    expect(pair.isConflict).toBe(false);
    expect(intersection.kind).toBe("point");
    if (intersection.kind === "point") {
      expect(intersection.position).toEqual({ x: 0.5, y: 0.5 });
      expect(intersection.pathProgress[0]).toBe(0.5);
      expect(intersection.pathProgress[1]).toBeCloseTo(2 / 3, 12);
    }
  });

  it("reports collinear path overlap separately", () => {
    const result = analyzeTwoDancers({
      start1: { x: 0, y: 0.5 },
      end1: { x: 0.75, y: 0.5 },
      start2: { x: 0.25, y: 0.5 },
      end2: { x: 1, y: 0.5 },
      threshold: 0,
    });

    expect(result.pathIntersections).toEqual([
      {
        kind: "overlap",
        dancerIds: ["dancer-1", "dancer-2"],
        overlapEndpoints: [
          { x: 0.25, y: 0.5 },
          { x: 0.75, y: 0.5 },
        ],
      },
    ]);
  });

  it("calculates physical travel totals on a non-square stage", () => {
    const result = analyzeTwoDancers({
      start1: { x: 0, y: 0 },
      end1: { x: 1, y: 0 },
      start2: { x: 0, y: 0 },
      end2: { x: 0, y: 1 },
      threshold: 0,
      stage: { width: 12, depth: 5, unit: "feet" },
    });

    expect(result.travelDistances).toEqual({
      "dancer-1": 12,
      "dancer-2": 5,
    });
    expect(result.totalTravelDistance).toBe(17);
    expect(result.maximumIndividualTravelDistance).toBe(12);
  });

  it("evaluates every unique dancer pair", () => {
    const result = analyzeTransitionSafety({
      transitionId: sampleProject.transition.id,
      stage: sampleProject.stage,
      dancers: sampleProject.dancers,
      formationA: sampleProject.formations[0],
      formationB: sampleProject.formations[1],
      safetyThreshold: sampleProject.safetyThreshold,
    });

    expect(result.pairSeparations).toHaveLength(28);
    expect(Object.keys(result.travelDistances)).toHaveLength(8);
  });

  it("rejects invalid safety thresholds", () => {
    expect(() =>
      analyzeTwoDancers({
        start1: { x: 0, y: 0 },
        end1: { x: 0, y: 0 },
        start2: { x: 1, y: 1 },
        end2: { x: 1, y: 1 },
        threshold: -1,
      }),
    ).toThrow(RangeError);
  });
});
