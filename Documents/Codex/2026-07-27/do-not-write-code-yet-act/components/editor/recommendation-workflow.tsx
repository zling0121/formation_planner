import type {
  Dancer,
  Recommendation,
  RecommendationMetricName,
  Stage,
} from "../../src/domain";

export type RecommendationWorkflowState =
  "available" | "idle" | "no-improvement" | "preview";

interface RecommendationWorkflowProps {
  readonly dancers: readonly Dancer[];
  readonly disabled: boolean;
  readonly onAccept: () => void;
  readonly onPreview: () => void;
  readonly onReject: () => void;
  readonly onRequest: () => void;
  readonly recommendation: Recommendation | null;
  readonly stage: Stage;
  readonly state: RecommendationWorkflowState;
}

function formatStageUnit(unit: Stage["unit"]): string {
  return unit === "feet" ? "ft" : "m";
}

function formatDistance(value: number, stage: Stage): string {
  return `${value.toFixed(2)} ${formatStageUnit(stage.unit)}`;
}

function getMetricLabel(metric: RecommendationMetricName): string {
  const labels: Record<RecommendationMetricName, string> = {
    "safety-conflicts": "Safety conflicts",
    "minimum-separation": "Minimum separation",
    "total-travel-distance": "Total travel",
    "maximum-individual-travel-distance": "Longest individual travel",
  };
  return labels[metric];
}

export function RecommendationWorkflow({
  dancers,
  disabled,
  onAccept,
  onPreview,
  onReject,
  onRequest,
  recommendation,
  stage,
  state,
}: RecommendationWorkflowProps) {
  const dancerLabels = new Map(
    dancers.map((dancer) => [dancer.id, dancer.label]),
  );
  const getDancerLabel = (dancerId: string): string => {
    const label = dancerLabels.get(dancerId);
    if (label === undefined) {
      throw new Error(
        `Recommendation references unknown dancer "${dancerId}".`,
      );
    }
    return label;
  };
  const requiresRecommendation = state === "available" || state === "preview";

  if (requiresRecommendation && recommendation === null) {
    throw new Error(`Recommendation workflow state "${state}" has no result.`);
  }

  const affectedLabels =
    recommendation === null
      ? null
      : recommendation.dancerIds.map(getDancerLabel);

  return (
    <section
      className="mt-6 border-t border-slate-200 pt-5"
      aria-labelledby="recommendation-heading"
    >
      <p className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
        Decision support
      </p>
      <h3
        id="recommendation-heading"
        className="mt-1 text-sm font-semibold text-slate-950"
      >
        Safer target swap
      </h3>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        A recommendation only reduces modeled conflicts. It is not guaranteed to
        be artistically better or physically safe.
      </p>

      {state === "idle" ? (
        <button
          className="mt-4 min-h-10 w-full rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          type="button"
          disabled={disabled}
          onClick={onRequest}
        >
          Find safer swap
        </button>
      ) : null}

      {state === "no-improvement" ? (
        <div
          className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
          data-testid="no-recommendation-state"
        >
          <h4 className="text-sm font-semibold text-slate-900">
            No improving swap found
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            No unlocked two-dancer target swap reduces the modeled safety
            conflict count. Formation B was not changed.
          </p>
          <button
            className="mt-3 min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            type="button"
            disabled={disabled}
            onClick={onRequest}
          >
            Check again
          </button>
        </div>
      ) : null}

      {state === "available" &&
      recommendation !== null &&
      affectedLabels !== null ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-700 uppercase">
            Recommendation found
          </p>
          <h4 className="mt-1 text-sm font-semibold text-blue-950">
            Swap {affectedLabels[0]} and {affectedLabels[1]}
          </h4>
          <p className="mt-1 text-xs leading-5 text-blue-900">
            Modeled conflicts decrease from{" "}
            {recommendation.before.unsafePairCount} to{" "}
            {recommendation.after.unsafePairCount}.
          </p>
          <button
            className="mt-3 min-h-9 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
            type="button"
            disabled={disabled}
            aria-label={`Preview recommendation to swap ${affectedLabels[0]} and ${affectedLabels[1]}`}
            onClick={onPreview}
          >
            Preview recommendation
          </button>
        </div>
      ) : null}

      {state === "preview" &&
      recommendation !== null &&
      affectedLabels !== null ? (
        <div
          className="mt-4 rounded-xl border border-blue-300 bg-white p-4 shadow-sm"
          data-testid="recommendation-preview"
        >
          <p className="text-xs font-semibold text-blue-700 uppercase">
            Recommendation preview
          </p>
          <h4 className="mt-1 text-sm font-semibold text-slate-950">
            Swap {affectedLabels[0]} and {affectedLabels[1]}
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Blue dashed paths show the proposal. Current saved paths and
            Formation B remain unchanged until you accept.
          </p>

          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-semibold">Metric</th>
                  <th className="px-2 py-2 text-right font-semibold">Before</th>
                  <th className="px-2 py-2 text-right font-semibold">After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                <tr>
                  <th className="px-2 py-2 font-medium">Safety conflicts</th>
                  <td className="px-2 py-2 text-right">
                    {recommendation.before.unsafePairCount}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">
                    {recommendation.after.unsafePairCount}
                  </td>
                </tr>
                <tr>
                  <th className="px-2 py-2 font-medium">Minimum separation</th>
                  <td className="px-2 py-2 text-right">
                    {formatDistance(
                      recommendation.before.globalMinimumSeparation,
                      stage,
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">
                    {formatDistance(
                      recommendation.after.globalMinimumSeparation,
                      stage,
                    )}
                  </td>
                </tr>
                <tr>
                  <th className="px-2 py-2 font-medium">Total travel</th>
                  <td className="px-2 py-2 text-right">
                    {formatDistance(
                      recommendation.before.totalTravelDistance,
                      stage,
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">
                    {formatDistance(
                      recommendation.after.totalTravelDistance,
                      stage,
                    )}
                  </td>
                </tr>
                <tr>
                  <th className="px-2 py-2 font-medium">Longest travel</th>
                  <td className="px-2 py-2 text-right">
                    {formatDistance(
                      recommendation.before.maximumIndividualTravelDistance,
                      stage,
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">
                    {formatDistance(
                      recommendation.after.maximumIndividualTravelDistance,
                      stage,
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            className={`mt-3 rounded-lg border p-3 text-xs leading-5 ${
              recommendation.worsenedMetrics.length === 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-300 bg-amber-50 text-amber-950"
            }`}
          >
            <span className="font-semibold">Tradeoffs: </span>
            {recommendation.worsenedMetrics.length === 0
              ? "No measured ranking metric becomes worse."
              : `${recommendation.worsenedMetrics
                  .map(getMetricLabel)
                  .join(", ")} ${
                  recommendation.worsenedMetrics.length === 1
                    ? "becomes"
                    : "become"
                } worse.`}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              className="min-h-10 rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-800"
              type="button"
              onClick={onAccept}
            >
              Accept swap
            </button>
            <button
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              type="button"
              onClick={onReject}
            >
              Reject
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
