import { analyzeTransitionSafety } from "./safety-engine";
import type {
  AnalysisResult,
  Dancer,
  DancerId,
  DancerPosition,
  Formation,
  Recommendation,
  RecommendationMetricName,
  RecommendationMetrics,
  Stage,
  TransitionId,
} from "./types";

export interface TargetSwapRecommendationInput {
  readonly transitionId: TransitionId;
  readonly stage: Stage;
  readonly dancers: readonly Dancer[];
  readonly formationA: Formation;
  readonly formationB: Formation;
  readonly safetyThreshold: number;
  readonly lockedDancerIds: readonly DancerId[];
}

export interface RecommendationRank extends RecommendationMetrics {
  readonly dancerIds: readonly [DancerId, DancerId];
}

interface EvaluatedCandidate {
  readonly analysis: AnalysisResult;
  readonly dancerIds: readonly [DancerId, DancerId];
  readonly formationB: Formation;
  readonly rank: RecommendationRank;
}

function compareNumberAscending(first: number, second: number): number {
  if (first < second) {
    return -1;
  }
  if (first > second) {
    return 1;
  }
  return 0;
}

function compareNumberDescending(first: number, second: number): number {
  return compareNumberAscending(second, first);
}

function compareDancerIds(first: DancerId, second: DancerId): number {
  if (first < second) {
    return -1;
  }
  if (first > second) {
    return 1;
  }
  return 0;
}

export function compareRecommendationRanks(
  first: RecommendationRank,
  second: RecommendationRank,
): number {
  return (
    compareNumberAscending(first.unsafePairCount, second.unsafePairCount) ||
    compareNumberDescending(
      first.globalMinimumSeparation,
      second.globalMinimumSeparation,
    ) ||
    compareNumberAscending(
      first.totalTravelDistance,
      second.totalTravelDistance,
    ) ||
    compareNumberAscending(
      first.maximumIndividualTravelDistance,
      second.maximumIndividualTravelDistance,
    ) ||
    compareDancerIds(first.dancerIds[0], second.dancerIds[0]) ||
    compareDancerIds(first.dancerIds[1], second.dancerIds[1])
  );
}

function toMetrics(analysis: AnalysisResult): RecommendationMetrics {
  return {
    unsafePairCount: analysis.conflicts.length,
    globalMinimumSeparation: analysis.globalMinimumSeparation,
    totalTravelDistance: analysis.totalTravelDistance,
    maximumIndividualTravelDistance: analysis.maximumIndividualTravelDistance,
  };
}

export function identifyWorsenedRecommendationMetrics(
  before: RecommendationMetrics,
  after: RecommendationMetrics,
): readonly RecommendationMetricName[] {
  const worsenedMetrics: RecommendationMetricName[] = [];

  if (after.unsafePairCount > before.unsafePairCount) {
    worsenedMetrics.push("safety-conflicts");
  }
  if (after.globalMinimumSeparation < before.globalMinimumSeparation) {
    worsenedMetrics.push("minimum-separation");
  }
  if (after.totalTravelDistance > before.totalTravelDistance) {
    worsenedMetrics.push("total-travel-distance");
  }
  if (
    after.maximumIndividualTravelDistance >
    before.maximumIndividualTravelDistance
  ) {
    worsenedMetrics.push("maximum-individual-travel-distance");
  }

  return worsenedMetrics;
}

function swapTargetPositions(
  formationB: Formation,
  dancerIds: readonly [DancerId, DancerId],
): Formation {
  const [firstDancerId, secondDancerId] = dancerIds;
  const firstTarget = formationB.positions[firstDancerId];
  const secondTarget = formationB.positions[secondDancerId];

  if (firstTarget === undefined || secondTarget === undefined) {
    throw new Error("Cannot swap missing Formation B target positions.");
  }

  const swappedFirstTarget: DancerPosition = {
    dancerId: firstDancerId,
    x: secondTarget.x,
    y: secondTarget.y,
  };
  const swappedSecondTarget: DancerPosition = {
    dancerId: secondDancerId,
    x: firstTarget.x,
    y: firstTarget.y,
  };

  return {
    ...formationB,
    positions: {
      ...formationB.positions,
      [firstDancerId]: swappedFirstTarget,
      [secondDancerId]: swappedSecondTarget,
    },
  };
}

function getDancerLabel(
  dancersById: ReadonlyMap<DancerId, Dancer>,
  dancerId: DancerId,
): string {
  const dancer = dancersById.get(dancerId);
  if (dancer === undefined) {
    throw new Error(`Recommendation references unknown dancer "${dancerId}".`);
  }
  return dancer.label;
}

function formatStageUnit(unit: Stage["unit"]): string {
  return unit === "feet" ? "ft" : "m";
}

function formatMetricNames(
  metricNames: readonly RecommendationMetricName[],
): string {
  const labels: Record<RecommendationMetricName, string> = {
    "safety-conflicts": "safety conflicts",
    "minimum-separation": "minimum separation",
    "total-travel-distance": "total travel distance",
    "maximum-individual-travel-distance": "longest individual travel distance",
  };
  return metricNames.map((metricName) => labels[metricName]).join(", ");
}

function createExplanation(
  dancerLabels: readonly [string, string],
  before: RecommendationMetrics,
  after: RecommendationMetrics,
  worsenedMetrics: readonly RecommendationMetricName[],
  stage: Stage,
): string {
  const unit = formatStageUnit(stage.unit);
  const tradeOff =
    worsenedMetrics.length === 0
      ? "No measured ranking metric becomes worse."
      : `Trade-off: ${formatMetricNames(worsenedMetrics)} ${
          worsenedMetrics.length === 1 ? "becomes" : "become"
        } worse.`;

  return `Swap ${dancerLabels[0]} and ${dancerLabels[1]}'s Formation B targets. This reduces modeled safety conflicts from ${before.unsafePairCount} to ${after.unsafePairCount}. Minimum separation changes from ${before.globalMinimumSeparation.toFixed(2)} ${unit} to ${after.globalMinimumSeparation.toFixed(2)} ${unit}, total travel changes from ${before.totalTravelDistance.toFixed(2)} ${unit} to ${after.totalTravelDistance.toFixed(2)} ${unit}, and longest individual travel changes from ${before.maximumIndividualTravelDistance.toFixed(2)} ${unit} to ${after.maximumIndividualTravelDistance.toFixed(2)} ${unit}. ${tradeOff}`;
}

export function recommendTargetPositionSwap({
  transitionId,
  stage,
  dancers,
  formationA,
  formationB,
  safetyThreshold,
  lockedDancerIds,
}: TargetSwapRecommendationInput): Recommendation | null {
  const baselineAnalysis = analyzeTransitionSafety({
    transitionId,
    stage,
    dancers,
    formationA,
    formationB,
    safetyThreshold,
  });
  const baselineMetrics = toMetrics(baselineAnalysis);
  const dancersById = new Map(
    dancers.map((dancer) => [dancer.id, dancer] as const),
  );
  const lockedDancers = new Set(lockedDancerIds);

  for (const lockedDancerId of lockedDancers) {
    if (!dancersById.has(lockedDancerId)) {
      throw new Error(
        `Locked dancer "${lockedDancerId}" is not in the roster.`,
      );
    }
  }

  const unlockedDancerIds = dancers
    .map((dancer) => dancer.id)
    .filter((dancerId) => !lockedDancers.has(dancerId))
    .sort(compareDancerIds);
  let bestCandidate: EvaluatedCandidate | null = null;

  for (
    let firstIndex = 0;
    firstIndex < unlockedDancerIds.length - 1;
    firstIndex += 1
  ) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < unlockedDancerIds.length;
      secondIndex += 1
    ) {
      const dancerIds = [
        unlockedDancerIds[firstIndex],
        unlockedDancerIds[secondIndex],
      ] as const;
      const candidateFormationB = swapTargetPositions(formationB, dancerIds);
      const candidateAnalysis = analyzeTransitionSafety({
        transitionId,
        stage,
        dancers,
        formationA,
        formationB: candidateFormationB,
        safetyThreshold,
      });

      if (
        candidateAnalysis.conflicts.length >= baselineMetrics.unsafePairCount
      ) {
        continue;
      }

      const candidateMetrics = toMetrics(candidateAnalysis);
      const candidate: EvaluatedCandidate = {
        analysis: candidateAnalysis,
        dancerIds,
        formationB: candidateFormationB,
        rank: {
          ...candidateMetrics,
          dancerIds,
        },
      };

      if (
        bestCandidate === null ||
        compareRecommendationRanks(candidate.rank, bestCandidate.rank) < 0
      ) {
        bestCandidate = candidate;
      }
    }
  }

  if (bestCandidate === null) {
    return null;
  }

  const [firstDancerId, secondDancerId] = bestCandidate.dancerIds;
  const firstBeforeTarget = formationB.positions[firstDancerId];
  const secondBeforeTarget = formationB.positions[secondDancerId];
  const firstAfterTarget = bestCandidate.formationB.positions[firstDancerId];
  const secondAfterTarget = bestCandidate.formationB.positions[secondDancerId];

  if (
    firstBeforeTarget === undefined ||
    secondBeforeTarget === undefined ||
    firstAfterTarget === undefined ||
    secondAfterTarget === undefined
  ) {
    throw new Error("Selected recommendation has incomplete target positions.");
  }

  const afterMetrics = toMetrics(bestCandidate.analysis);
  const worsenedMetrics = identifyWorsenedRecommendationMetrics(
    baselineMetrics,
    afterMetrics,
  );
  const dancerLabels = [
    getDancerLabel(dancersById, firstDancerId),
    getDancerLabel(dancersById, secondDancerId),
  ] as const;

  return {
    id: `recommendation:${transitionId}:${firstDancerId}:${secondDancerId}`,
    kind: "swap-target-positions",
    transitionId,
    targetFormationId: formationB.id,
    dancerIds: bestCandidate.dancerIds,
    proposedChanges: [
      {
        dancerId: firstDancerId,
        from: { x: firstBeforeTarget.x, y: firstBeforeTarget.y },
        to: { x: firstAfterTarget.x, y: firstAfterTarget.y },
      },
      {
        dancerId: secondDancerId,
        from: { x: secondBeforeTarget.x, y: secondBeforeTarget.y },
        to: { x: secondAfterTarget.x, y: secondAfterTarget.y },
      },
    ],
    before: baselineMetrics,
    after: afterMetrics,
    travelDistanceChanges: [
      {
        dancerId: firstDancerId,
        before: baselineAnalysis.travelDistances[firstDancerId],
        after: bestCandidate.analysis.travelDistances[firstDancerId],
        delta:
          bestCandidate.analysis.travelDistances[firstDancerId] -
          baselineAnalysis.travelDistances[firstDancerId],
      },
      {
        dancerId: secondDancerId,
        before: baselineAnalysis.travelDistances[secondDancerId],
        after: bestCandidate.analysis.travelDistances[secondDancerId],
        delta:
          bestCandidate.analysis.travelDistances[secondDancerId] -
          baselineAnalysis.travelDistances[secondDancerId],
      },
    ],
    worsenedMetrics,
    explanation: createExplanation(
      dancerLabels,
      baselineMetrics,
      afterMetrics,
      worsenedMetrics,
      stage,
    ),
  };
}
