import type {
  AnalysisResult,
  Dancer,
  Recommendation,
  SafetyConflict,
  Stage,
} from "../../src/domain";
import {
  RecommendationWorkflow,
  type RecommendationWorkflowState,
} from "./recommendation-workflow";

interface TransitionAnalysisPanelProps {
  readonly analysis: AnalysisResult;
  readonly dancers: readonly Dancer[];
  readonly isRecommendationDisabled: boolean;
  readonly onAcceptRecommendation: () => void;
  readonly onPreviewRecommendation: () => void;
  readonly onRejectRecommendation: () => void;
  readonly onRequestRecommendation: () => void;
  readonly onSelectConflict: (conflictKey: string) => void;
  readonly recommendation: Recommendation | null;
  readonly recommendationState: RecommendationWorkflowState;
  readonly selectedConflictKey: string | null;
  readonly stage: Stage;
}

function formatStageUnit(unit: Stage["unit"]): string {
  return unit === "feet" ? "ft" : "m";
}

function formatDistance(distance: number, stage: Stage): string {
  return `${distance.toFixed(2)} ${formatStageUnit(stage.unit)}`;
}

function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function getConflictKey(conflict: SafetyConflict): string {
  return conflict.dancerIds.join("::");
}

export function TransitionAnalysisPanel({
  analysis,
  dancers,
  isRecommendationDisabled,
  onAcceptRecommendation,
  onPreviewRecommendation,
  onRejectRecommendation,
  onRequestRecommendation,
  onSelectConflict,
  recommendation,
  recommendationState,
  selectedConflictKey,
  stage,
}: TransitionAnalysisPanelProps) {
  const dancerLabels = new Map(
    dancers.map((dancer) => [dancer.id, dancer.label]),
  );

  const getDancerLabel = (dancerId: string): string => {
    const label = dancerLabels.get(dancerId);
    if (label === undefined) {
      throw new Error(`Analysis references unknown dancer "${dancerId}".`);
    }
    return label;
  };

  return (
    <aside
      className="bg-white p-4 sm:p-5 md:col-span-2 xl:col-span-1"
      aria-labelledby="analysis-heading"
    >
      <p className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
        Transition
      </p>
      <h2
        id="analysis-heading"
        className="mt-1 text-base font-semibold text-slate-900"
      >
        Transition analysis
      </h2>

      <dl className="mt-5 grid grid-cols-2 gap-2 xl:grid-cols-1">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <dt className="text-xs font-semibold text-slate-500 uppercase">
            Safety conflicts
          </dt>
          <dd
            className="mt-1 text-lg font-semibold text-slate-950"
            data-testid="safety-conflict-count"
          >
            {analysis.conflicts.length}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <dt className="text-xs font-semibold text-slate-500 uppercase">
            Path intersections
          </dt>
          <dd
            className="mt-1 text-lg font-semibold text-slate-950"
            data-testid="path-intersection-count"
          >
            {analysis.pathIntersections.length}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <dt className="text-xs font-semibold text-slate-500 uppercase">
            Total travel
          </dt>
          <dd
            className="mt-1 text-sm font-semibold text-slate-950"
            data-testid="total-travel-distance"
          >
            {formatDistance(analysis.totalTravelDistance, stage)}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <dt className="text-xs font-semibold text-slate-500 uppercase">
            Longest travel
          </dt>
          <dd
            className="mt-1 text-sm font-semibold text-slate-950"
            data-testid="longest-travel-distance"
          >
            {formatDistance(analysis.maximumIndividualTravelDistance, stage)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-950">
        Paths can cross geometrically at different times. A crossing is only a
        safety conflict when dancers are too close at the same transition time.
      </p>

      {analysis.conflicts.length === 0 ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-center">
          <div
            className="mx-auto grid size-9 place-items-center rounded-full border border-emerald-300 bg-white text-sm font-bold text-emerald-700"
            aria-hidden="true"
          >
            ✓
          </div>
          <h3 className="mt-3 text-sm font-semibold text-emerald-950">
            No safety conflicts detected
          </h3>
          <p className="mt-1 text-xs leading-5 text-emerald-800">
            Every dancer pair stays at or above the{" "}
            {formatDistance(analysis.safetyThreshold, stage)} safety threshold.
          </p>
        </div>
      ) : (
        <section className="mt-5" aria-labelledby="conflicts-heading">
          <div className="flex items-end justify-between gap-3">
            <h3
              id="conflicts-heading"
              className="text-sm font-semibold text-slate-900"
            >
              Affected dancers
            </h3>
            <span className="text-xs text-slate-500">
              {formatCount(
                analysis.conflicts.length,
                "unsafe pair",
                "unsafe pairs",
              )}
            </span>
          </div>
          <ul className="mt-2 space-y-2">
            {analysis.conflicts.map((conflict) => {
              const conflictKey = getConflictKey(conflict);
              const firstLabel = getDancerLabel(conflict.dancerIds[0]);
              const secondLabel = getDancerLabel(conflict.dancerIds[1]);
              const isSelected = selectedConflictKey === conflictKey;

              return (
                <li key={conflictKey}>
                  <button
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-red-500 bg-red-50 ring-1 ring-red-500"
                        : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"
                    }`}
                    type="button"
                    aria-label={`Focus conflict between ${firstLabel} and ${secondLabel}`}
                    aria-pressed={isSelected}
                    onClick={() => onSelectConflict(conflictKey)}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-950">
                        {firstLabel} and {secondLabel}
                      </span>
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-red-800 uppercase">
                        Unsafe
                      </span>
                    </span>
                    <span className="mt-1.5 block text-xs text-slate-600">
                      Closest at{" "}
                      {Math.round(conflict.closestApproachTime * 100)}% ·{" "}
                      {formatDistance(conflict.minimumSeparation, stage)} apart
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <RecommendationWorkflow
        dancers={dancers}
        disabled={isRecommendationDisabled}
        onAccept={onAcceptRecommendation}
        onPreview={onPreviewRecommendation}
        onReject={onRejectRecommendation}
        onRequest={onRequestRecommendation}
        recommendation={recommendation}
        stage={stage}
        state={recommendationState}
      />
    </aside>
  );
}
