import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Dancer, Recommendation, Stage } from "../../src/domain";
import { RecommendationWorkflow } from "./recommendation-workflow";

const dancers: readonly Dancer[] = [
  { id: "dancer-1", label: "Ari" },
  { id: "dancer-2", label: "Blair" },
];
const stage: Stage = { width: 10, depth: 10, unit: "feet" };
const recommendation: Recommendation = {
  id: "recommendation:test",
  kind: "swap-target-positions",
  transitionId: "transition-test",
  targetFormationId: "formation-b",
  dancerIds: ["dancer-1", "dancer-2"],
  proposedChanges: [
    {
      dancerId: "dancer-1",
      from: { x: 0.8, y: 0.5 },
      to: { x: 0.2, y: 0.5 },
    },
    {
      dancerId: "dancer-2",
      from: { x: 0.2, y: 0.5 },
      to: { x: 0.8, y: 0.5 },
    },
  ],
  before: {
    unsafePairCount: 1,
    globalMinimumSeparation: 0,
    totalTravelDistance: 12,
    maximumIndividualTravelDistance: 6,
  },
  after: {
    unsafePairCount: 0,
    globalMinimumSeparation: 6,
    totalTravelDistance: 14,
    maximumIndividualTravelDistance: 7,
  },
  travelDistanceChanges: [
    { dancerId: "dancer-1", before: 6, after: 7, delta: 1 },
    { dancerId: "dancer-2", before: 6, after: 7, delta: 1 },
  ],
  worsenedMetrics: [
    "total-travel-distance",
    "maximum-individual-travel-distance",
  ],
  explanation: "Swap Ari and Blair to reduce modeled conflicts.",
};

const handlers = {
  onAccept: vi.fn(),
  onPreview: vi.fn(),
  onReject: vi.fn(),
  onRequest: vi.fn(),
};

describe("RecommendationWorkflow", () => {
  it("shows an isolated preview with metrics, tradeoffs, and safety framing", () => {
    const html = renderToStaticMarkup(
      <RecommendationWorkflow
        {...handlers}
        dancers={dancers}
        disabled={false}
        recommendation={recommendation}
        stage={stage}
        state="preview"
      />,
    );

    expect(html).toContain("Recommendation preview");
    expect(html).toContain("Swap Ari and Blair");
    expect(html).toContain("Formation B remain unchanged until you accept");
    expect(html).toContain("Safety conflicts");
    expect(html).toContain("Minimum separation");
    expect(html).toContain("Total travel");
    expect(html).toContain("Longest travel");
    expect(html).toContain("Tradeoffs:");
    expect(html).toContain("Total travel, Longest individual travel");
    expect(html).toContain("not guaranteed to be artistically better");
    expect(html).toContain("Accept swap");
    expect(html).toContain("Reject");
  });

  it("states explicitly when no improving recommendation exists", () => {
    const html = renderToStaticMarkup(
      <RecommendationWorkflow
        {...handlers}
        dancers={dancers}
        disabled={false}
        recommendation={null}
        stage={stage}
        state="no-improvement"
      />,
    );

    expect(html).toContain("No improving swap found");
    expect(html).toContain(
      "No unlocked two-dancer target swap reduces the modeled safety conflict count",
    );
    expect(html).toContain("Formation B was not changed");
  });

  it("names the recommendation preview button for the affected dancers", () => {
    const html = renderToStaticMarkup(
      <RecommendationWorkflow
        {...handlers}
        dancers={dancers}
        disabled={false}
        recommendation={recommendation}
        stage={stage}
        state="available"
      />,
    );

    expect(html).toContain(
      'aria-label="Preview recommendation to swap Ari and Blair"',
    );
  });
});
