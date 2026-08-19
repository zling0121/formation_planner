export type ProjectId = string;
export type DancerId = string;
export type FormationId = string;
export type TransitionId = string;
export type RecommendationId = string;

/**
 * A coordinate in the inclusive [0, 1] range.
 *
 * TypeScript cannot enforce numeric ranges, so values entering the domain
 * must be checked with the validation functions in this module.
 */
export type NormalizedCoordinate = number;

export interface NormalizedPoint {
  readonly x: NormalizedCoordinate;
  readonly y: NormalizedCoordinate;
}

export type StageUnit = "feet" | "meters";

export interface Stage {
  readonly width: number;
  readonly depth: number;
  readonly unit: StageUnit;
}

export interface Dancer {
  /**
   * Stable identity that must not change when the dancer is renamed or moved.
   */
  readonly id: DancerId;
  readonly label: string;
}

export interface DancerPosition extends NormalizedPoint {
  readonly dancerId: DancerId;
}

export interface Formation {
  readonly id: FormationId;
  readonly name: string;
  /**
   * Exactly one entry per project dancer, keyed by stable dancer ID.
   * Runtime validation enforces completeness and rejects unknown entries.
   */
  readonly positions: Readonly<Record<DancerId, DancerPosition>>;
}

export interface Transition {
  readonly id: TransitionId;
  readonly fromFormationId: FormationId;
  readonly toFormationId: FormationId;
  readonly durationMs: number;
}

export interface SafetyConflict {
  readonly dancerIds: readonly [DancerId, DancerId];
  readonly minimumSeparation: number;
  readonly closestApproachTime: NormalizedCoordinate;
  readonly closestPositions: readonly [NormalizedPoint, NormalizedPoint];
}

export interface PairSafetyResult extends SafetyConflict {
  readonly isConflict: boolean;
}

export interface PointPathIntersection {
  readonly kind: "point";
  readonly dancerIds: readonly [DancerId, DancerId];
  readonly position: NormalizedPoint;
  /**
   * Individual path parameters for the first and second dancer. Different
   * values mean the dancers pass through the point at different times.
   */
  readonly pathProgress: readonly [NormalizedCoordinate, NormalizedCoordinate];
}

export interface OverlapPathIntersection {
  readonly kind: "overlap";
  readonly dancerIds: readonly [DancerId, DancerId];
  readonly overlapEndpoints: readonly [NormalizedPoint, NormalizedPoint];
}

export type PathIntersection = PointPathIntersection | OverlapPathIntersection;

export interface AnalysisResult {
  readonly transitionId: TransitionId;
  readonly safetyThreshold: number;
  readonly pairSeparations: readonly PairSafetyResult[];
  readonly conflicts: readonly SafetyConflict[];
  readonly pathIntersections: readonly PathIntersection[];
  readonly travelDistances: Readonly<Record<DancerId, number>>;
  readonly totalTravelDistance: number;
  readonly maximumIndividualTravelDistance: number;
  readonly globalMinimumSeparation: number;
}

export interface RecommendationMetrics {
  readonly unsafePairCount: number;
  readonly globalMinimumSeparation: number;
  readonly totalTravelDistance: number;
  readonly maximumIndividualTravelDistance: number;
}

export interface TargetPositionChange {
  readonly dancerId: DancerId;
  readonly from: NormalizedPoint;
  readonly to: NormalizedPoint;
}

export interface DancerTravelDistanceChange {
  readonly dancerId: DancerId;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

export type RecommendationMetricName =
  | "safety-conflicts"
  | "minimum-separation"
  | "total-travel-distance"
  | "maximum-individual-travel-distance";

/**
 * A recommendation is an immutable proposal. Its changes describe a
 * two-dancer target swap but do not mutate the target formation.
 */
export interface Recommendation {
  readonly id: RecommendationId;
  readonly kind: "swap-target-positions";
  readonly transitionId: TransitionId;
  readonly targetFormationId: FormationId;
  readonly dancerIds: readonly [DancerId, DancerId];
  readonly proposedChanges: readonly [
    TargetPositionChange,
    TargetPositionChange,
  ];
  readonly before: RecommendationMetrics;
  readonly after: RecommendationMetrics;
  readonly travelDistanceChanges: readonly [
    DancerTravelDistanceChange,
    DancerTravelDistanceChange,
  ];
  readonly worsenedMetrics: readonly RecommendationMetricName[];
  readonly explanation: string;
}

export interface Project {
  readonly id: ProjectId;
  readonly name: string;
  readonly stage: Stage;
  readonly dancers: readonly Dancer[];
  /**
   * The MVP analyzes exactly two formations. Transition references determine
   * which is the start and which is the target.
   */
  readonly formations: readonly [Formation, Formation];
  readonly transition: Transition;
  readonly safetyThreshold: number;
  /**
   * Locks protect the listed dancers' target-formation assignments.
   * They are project state rather than an intrinsic dancer property.
   */
  readonly lockedDancerIds: readonly DancerId[];
}
