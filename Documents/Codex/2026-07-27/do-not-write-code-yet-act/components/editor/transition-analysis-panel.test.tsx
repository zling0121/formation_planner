import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AnalysisResult, Dancer, Stage } from "../../src/domain";
import { TransitionAnalysisPanel } from "./transition-analysis-panel";

const dancers: readonly Dancer[] = [
  { id: "dancer-01", label: "Ari" },
  { id: "dancer-02", label: "Blair" },
];

const stage: Stage = { width: 36, depth: 24, unit: "feet" };

const conflictAnalysis: AnalysisResult = {
  transitionId: "transition-a-to-b",
  safetyThreshold: 3,
  pairSeparations: [],
  conflicts: [
    {
      dancerIds: ["dancer-01", "dancer-02"],
      minimumSeparation: 0.25,
      closestApproachTime: 0.5,
      closestPositions: [
        { x: 0.4, y: 0.5 },
        { x: 0.41, y: 0.5 },
      ],
    },
  ],
  pathIntersections: [
    {
      kind: "point",
      dancerIds: ["dancer-01", "dancer-02"],
      position: { x: 0.4, y: 0.5 },
      pathProgress: [0.5, 0.7],
    },
  ],
  travelDistances: { "dancer-01": 4, "dancer-02": 6 },
  totalTravelDistance: 10,
  maximumIndividualTravelDistance: 6,
  globalMinimumSeparation: 0.25,
};

describe("TransitionAnalysisPanel", () => {
  it("renders live conflict, intersection, travel, dancer, and time results", () => {
    const html = renderToStaticMarkup(
      <TransitionAnalysisPanel
        analysis={conflictAnalysis}
        dancers={dancers}
        isRecommendationDisabled={false}
        onAcceptRecommendation={vi.fn()}
        onPreviewRecommendation={vi.fn()}
        onRejectRecommendation={vi.fn()}
        onRequestRecommendation={vi.fn()}
        onSelectConflict={vi.fn()}
        recommendation={null}
        recommendationState="idle"
        selectedConflictKey="dancer-01::dancer-02"
        stage={stage}
      />,
    );

    expect(html).toContain("Safety conflicts");
    expect(html).toContain("Path intersections");
    expect(html).toContain("Total travel");
    expect(html).toContain("10.00 ft");
    expect(html).toContain("Longest travel");
    expect(html).toContain("6.00 ft");
    expect(html).toContain("Ari and Blair");
    expect(html).toContain("Closest at 50%");
    expect(html).toContain("0.25 ft apart");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("at different times");
  });

  it("renders a clear no-conflict state", () => {
    const html = renderToStaticMarkup(
      <TransitionAnalysisPanel
        analysis={{
          ...conflictAnalysis,
          conflicts: [],
          globalMinimumSeparation: 4,
        }}
        dancers={dancers}
        isRecommendationDisabled={false}
        onAcceptRecommendation={vi.fn()}
        onPreviewRecommendation={vi.fn()}
        onRejectRecommendation={vi.fn()}
        onRequestRecommendation={vi.fn()}
        onSelectConflict={vi.fn()}
        recommendation={null}
        recommendationState="idle"
        selectedConflictKey={null}
        stage={stage}
      />,
    );

    expect(html).toContain("No safety conflicts detected");
    expect(html).toContain("3.00 ft safety threshold");
  });
});
