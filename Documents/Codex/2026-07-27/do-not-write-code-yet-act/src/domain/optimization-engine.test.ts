import { describe, expect, it } from "vitest";

import {
  compareRecommendationRanks,
  identifyWorsenedRecommendationMetrics,
  recommendTargetPositionSwap,
  type RecommendationRank,
  type TargetSwapRecommendationInput,
} from "./optimization-engine";
import type { Dancer, DancerId, Formation, NormalizedPoint } from "./types";

const dancers: readonly Dancer[] = [
  { id: "dancer-1", label: "Ari" },
  { id: "dancer-2", label: "Blair" },
  { id: "dancer-3", label: "Casey" },
  { id: "dancer-4", label: "Devon" },
  { id: "dancer-5", label: "Emery" },
  { id: "dancer-6", label: "Frankie" },
];

function createFormation(
  id: string,
  points: Readonly<Record<DancerId, NormalizedPoint>>,
): Formation {
  return {
    id,
    name: id === "formation-a" ? "Formation A" : "Formation B",
    positions: Object.fromEntries(
      Object.entries(points).map(([dancerId, point]) => [
        dancerId,
        { dancerId, ...point },
      ]),
    ),
  };
}

const formationA = createFormation("formation-a", {
  "dancer-1": { x: 0.1, y: 0.1 },
  "dancer-2": { x: 0.5, y: 0.1 },
  "dancer-3": { x: 0.9, y: 0.1 },
  "dancer-4": { x: 0.1, y: 0.9 },
  "dancer-5": { x: 0.5, y: 0.9 },
  "dancer-6": { x: 0.9, y: 0.9 },
});

const unsafeFormationB = createFormation("formation-b", {
  "dancer-1": { x: 0.9, y: 0.1 },
  "dancer-2": { x: 0.5, y: 0.1 },
  "dancer-3": { x: 0.1, y: 0.1 },
  "dancer-4": { x: 0.1, y: 0.9 },
  "dancer-5": { x: 0.5, y: 0.9 },
  "dancer-6": { x: 0.9, y: 0.9 },
});

function recommendationInput(
  overrides: Partial<TargetSwapRecommendationInput> = {},
): TargetSwapRecommendationInput {
  return {
    transitionId: "transition-test",
    stage: { width: 10, depth: 10, unit: "feet" },
    dancers,
    formationA,
    formationB: unsafeFormationB,
    safetyThreshold: 0.1,
    lockedDancerIds: [],
    ...overrides,
  };
}

function rank(overrides: Partial<RecommendationRank> = {}): RecommendationRank {
  return {
    unsafePairCount: 2,
    globalMinimumSeparation: 1,
    totalTravelDistance: 20,
    maximumIndividualTravelDistance: 8,
    dancerIds: ["dancer-2", "dancer-3"],
    ...overrides,
  };
}

describe("target-position swap recommendation engine", () => {
  it("exhaustively selects the candidate with the fewest conflicts", () => {
    const originalFormationB = structuredClone(unsafeFormationB);

    const recommendation = recommendTargetPositionSwap(recommendationInput());

    expect(recommendation).not.toBeNull();
    expect(recommendation?.dancerIds).toEqual(["dancer-1", "dancer-3"]);
    expect(recommendation?.before.unsafePairCount).toBe(3);
    expect(recommendation?.after.unsafePairCount).toBe(0);
    expect(recommendation?.before.globalMinimumSeparation).toBe(0);
    expect(recommendation?.after.globalMinimumSeparation).toBe(4);
    expect(recommendation?.before.totalTravelDistance).toBe(16);
    expect(recommendation?.after.totalTravelDistance).toBe(0);
    expect(recommendation?.before.maximumIndividualTravelDistance).toBe(8);
    expect(recommendation?.after.maximumIndividualTravelDistance).toBe(0);
    expect(recommendation?.proposedChanges).toEqual([
      {
        dancerId: "dancer-1",
        from: { x: 0.9, y: 0.1 },
        to: { x: 0.1, y: 0.1 },
      },
      {
        dancerId: "dancer-3",
        from: { x: 0.1, y: 0.1 },
        to: { x: 0.9, y: 0.1 },
      },
    ]);
    expect(recommendation?.travelDistanceChanges).toEqual([
      { dancerId: "dancer-1", before: 8, after: 0, delta: -8 },
      { dancerId: "dancer-3", before: 8, after: 0, delta: -8 },
    ]);
    expect(recommendation?.worsenedMetrics).toEqual([]);
    expect(recommendation?.explanation).toContain(
      "Swap Ari and Casey's Formation B targets.",
    );
    expect(recommendation?.explanation).toContain(
      "reduces modeled safety conflicts from 3 to 0",
    );
    expect(unsafeFormationB).toEqual(originalFormationB);
  });

  it("applies every ranking criterion in the documented order", () => {
    const baseline = rank();

    expect(
      compareRecommendationRanks(
        rank({
          unsafePairCount: 1,
          globalMinimumSeparation: 0,
          totalTravelDistance: 100,
          maximumIndividualTravelDistance: 100,
        }),
        baseline,
      ),
    ).toBeLessThan(0);
    expect(
      compareRecommendationRanks(
        rank({ globalMinimumSeparation: 2, totalTravelDistance: 100 }),
        baseline,
      ),
    ).toBeLessThan(0);
    expect(
      compareRecommendationRanks(
        rank({ totalTravelDistance: 10, maximumIndividualTravelDistance: 100 }),
        baseline,
      ),
    ).toBeLessThan(0);
    expect(
      compareRecommendationRanks(
        rank({ maximumIndividualTravelDistance: 7 }),
        baseline,
      ),
    ).toBeLessThan(0);
  });

  it("uses the sorted dancer-ID pair as a stable final tie-break", () => {
    const first = rank({ dancerIds: ["dancer-1", "dancer-6"] });
    const second = rank({ dancerIds: ["dancer-2", "dancer-3"] });

    expect(compareRecommendationRanks(first, second)).toBeLessThan(0);
    expect(compareRecommendationRanks(second, first)).toBeGreaterThan(0);
    expect(compareRecommendationRanks(first, first)).toBe(0);
  });

  it("excludes locked dancers from candidate swaps", () => {
    const recommendation = recommendTargetPositionSwap(
      recommendationInput({
        lockedDancerIds: ["dancer-1", "dancer-4", "dancer-5", "dancer-6"],
      }),
    );

    expect(recommendation?.dancerIds).toEqual(["dancer-2", "dancer-3"]);
    expect(recommendation?.dancerIds).not.toContain("dancer-1");
    expect(recommendation?.after.unsafePairCount).toBeLessThan(
      recommendation?.before.unsafePairCount ?? 0,
    );
  });

  it("returns no recommendation when no swap reduces conflicts", () => {
    const safeFormationB = createFormation("formation-b", {
      "dancer-1": { x: 0.1, y: 0.1 },
      "dancer-2": { x: 0.5, y: 0.1 },
      "dancer-3": { x: 0.9, y: 0.1 },
      "dancer-4": { x: 0.1, y: 0.9 },
      "dancer-5": { x: 0.5, y: 0.9 },
      "dancer-6": { x: 0.9, y: 0.9 },
    });
    const originalFormationB = structuredClone(safeFormationB);

    const recommendation = recommendTargetPositionSwap(
      recommendationInput({ formationB: safeFormationB }),
    );

    expect(recommendation).toBeNull();
    expect(safeFormationB).toEqual(originalFormationB);
  });

  it("returns no recommendation when fewer than two dancers are unlocked", () => {
    const recommendation = recommendTargetPositionSwap(
      recommendationInput({
        lockedDancerIds: [
          "dancer-2",
          "dancer-3",
          "dancer-4",
          "dancer-5",
          "dancer-6",
        ],
      }),
    );

    expect(recommendation).toBeNull();
  });

  it("reports every measured metric that becomes worse", () => {
    expect(
      identifyWorsenedRecommendationMetrics(
        {
          unsafePairCount: 3,
          globalMinimumSeparation: 2,
          totalTravelDistance: 20,
          maximumIndividualTravelDistance: 8,
        },
        {
          unsafePairCount: 2,
          globalMinimumSeparation: 1,
          totalTravelDistance: 21,
          maximumIndividualTravelDistance: 9,
        },
      ),
    ).toEqual([
      "minimum-separation",
      "total-travel-distance",
      "maximum-individual-travel-distance",
    ]);
  });

  it("rejects a lock that references an unknown dancer", () => {
    expect(() =>
      recommendTargetPositionSwap(
        recommendationInput({ lockedDancerIds: ["missing-dancer"] }),
      ),
    ).toThrow('Locked dancer "missing-dancer" is not in the roster.');
  });
});
