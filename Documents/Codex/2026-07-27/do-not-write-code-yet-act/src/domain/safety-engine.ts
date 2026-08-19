import { interpolatePosition } from "./transition-playback";
import type {
  AnalysisResult,
  Dancer,
  DancerId,
  DancerPosition,
  Formation,
  NormalizedPoint,
  PathIntersection,
  PairSafetyResult,
  SafetyConflict,
  Stage,
  TransitionId,
} from "./types";
import { isNormalizedCoordinate } from "./validation";

export const SAFETY_ENGINE_TOLERANCE = 1e-12;

interface Vector {
  readonly x: number;
  readonly y: number;
}

export interface TransitionSafetyInput {
  readonly transitionId: TransitionId;
  readonly stage: Stage;
  readonly dancers: readonly Dancer[];
  readonly formationA: Formation;
  readonly formationB: Formation;
  readonly safetyThreshold: number;
}

function subtract(first: Vector, second: Vector): Vector {
  return {
    x: first.x - second.x,
    y: first.y - second.y,
  };
}

function add(first: Vector, second: Vector): Vector {
  return {
    x: first.x + second.x,
    y: first.y + second.y,
  };
}

function scale(vector: Vector, scalar: number): Vector {
  return {
    x: vector.x * scalar,
    y: vector.y * scalar,
  };
}

function dot(first: Vector, second: Vector): number {
  return first.x * second.x + first.y * second.y;
}

function cross(first: Vector, second: Vector): number {
  return first.x * second.y - first.y * second.x;
}

function squaredLength(vector: Vector): number {
  return dot(vector, vector);
}

function distance(first: Vector, second: Vector): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function clampUnitInterval(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isWithinSegment(value: number): boolean {
  return (
    value >= -SAFETY_ENGINE_TOLERANCE && value <= 1 + SAFETY_ENGINE_TOLERANCE
  );
}

function toPhysical(point: NormalizedPoint, stage: Stage): Vector {
  return {
    x: point.x * stage.width,
    y: point.y * stage.depth,
  };
}

function assertValidStage(stage: Stage): void {
  if (
    !Number.isFinite(stage.width) ||
    !Number.isFinite(stage.depth) ||
    stage.width <= 0 ||
    stage.depth <= 0
  ) {
    throw new RangeError("Stage width and depth must be positive numbers.");
  }
}

function assertValidPosition(
  position: DancerPosition | undefined,
  dancerId: DancerId,
  formationName: string,
): asserts position is DancerPosition {
  if (position === undefined || position.dancerId !== dancerId) {
    throw new Error(
      `${formationName} must contain a position for dancer "${dancerId}".`,
    );
  }

  if (
    !isNormalizedCoordinate(position.x) ||
    !isNormalizedCoordinate(position.y)
  ) {
    throw new RangeError(
      `${formationName} position for dancer "${dancerId}" must be normalized.`,
    );
  }
}

function analyzePair(
  dancerIds: readonly [DancerId, DancerId],
  starts: readonly [DancerPosition, DancerPosition],
  ends: readonly [DancerPosition, DancerPosition],
  stage: Stage,
  safetyThreshold: number,
): PairSafetyResult {
  const physicalStarts = [
    toPhysical(starts[0], stage),
    toPhysical(starts[1], stage),
  ] as const;
  const physicalEnds = [
    toPhysical(ends[0], stage),
    toPhysical(ends[1], stage),
  ] as const;
  const velocities = [
    subtract(physicalEnds[0], physicalStarts[0]),
    subtract(physicalEnds[1], physicalStarts[1]),
  ] as const;
  const relativeStart = subtract(physicalStarts[0], physicalStarts[1]);
  const relativeVelocity = subtract(velocities[0], velocities[1]);
  const relativeSpeedSquared = squaredLength(relativeVelocity);

  const closestApproachTime =
    relativeSpeedSquared <= SAFETY_ENGINE_TOLERANCE ** 2
      ? 0
      : clampUnitInterval(
          -dot(relativeStart, relativeVelocity) / relativeSpeedSquared,
        );

  const relativeAtClosestApproach = add(
    relativeStart,
    scale(relativeVelocity, closestApproachTime),
  );
  const minimumSeparation = Math.hypot(
    relativeAtClosestApproach.x,
    relativeAtClosestApproach.y,
  );

  return {
    dancerIds,
    minimumSeparation,
    closestApproachTime,
    closestPositions: [
      interpolatePosition(starts[0], ends[0], closestApproachTime),
      interpolatePosition(starts[1], ends[1], closestApproachTime),
    ],
    isConflict: minimumSeparation < safetyThreshold,
  };
}

function parameterForPointOnSegment(
  point: NormalizedPoint,
  start: NormalizedPoint,
  delta: Vector,
): number | null {
  const parameter =
    Math.abs(delta.x) >= Math.abs(delta.y)
      ? (point.x - start.x) / delta.x
      : (point.y - start.y) / delta.y;

  if (!Number.isFinite(parameter) || !isWithinSegment(parameter)) {
    return null;
  }

  const clampedParameter = clampUnitInterval(parameter);
  const projected = add(start, scale(delta, clampedParameter));

  return distance(projected, point) <= SAFETY_ENGINE_TOLERANCE
    ? clampedParameter
    : null;
}

function pointIntersection(
  dancerIds: readonly [DancerId, DancerId],
  firstStart: DancerPosition,
  firstDelta: Vector,
  firstProgress: number,
  secondProgress: number,
): PathIntersection {
  return {
    kind: "point",
    dancerIds,
    position: add(firstStart, scale(firstDelta, firstProgress)),
    pathProgress: [firstProgress, secondProgress],
  };
}

function calculatePathIntersection(
  dancerIds: readonly [DancerId, DancerId],
  starts: readonly [DancerPosition, DancerPosition],
  ends: readonly [DancerPosition, DancerPosition],
): PathIntersection | null {
  const firstDelta = subtract(ends[0], starts[0]);
  const secondDelta = subtract(ends[1], starts[1]);
  const firstLengthSquared = squaredLength(firstDelta);
  const secondLengthSquared = squaredLength(secondDelta);
  const toleranceSquared = SAFETY_ENGINE_TOLERANCE ** 2;

  if (
    firstLengthSquared <= toleranceSquared &&
    secondLengthSquared <= toleranceSquared
  ) {
    return distance(starts[0], starts[1]) <= SAFETY_ENGINE_TOLERANCE
      ? pointIntersection(dancerIds, starts[0], firstDelta, 0, 0)
      : null;
  }

  if (firstLengthSquared <= toleranceSquared) {
    const secondProgress = parameterForPointOnSegment(
      starts[0],
      starts[1],
      secondDelta,
    );
    return secondProgress === null
      ? null
      : pointIntersection(dancerIds, starts[0], firstDelta, 0, secondProgress);
  }

  if (secondLengthSquared <= toleranceSquared) {
    const firstProgress = parameterForPointOnSegment(
      starts[1],
      starts[0],
      firstDelta,
    );
    return firstProgress === null
      ? null
      : pointIntersection(dancerIds, starts[0], firstDelta, firstProgress, 0);
  }

  const startDifference = subtract(starts[1], starts[0]);
  const directionCross = cross(firstDelta, secondDelta);

  if (Math.abs(directionCross) > SAFETY_ENGINE_TOLERANCE) {
    const firstProgress = cross(startDifference, secondDelta) / directionCross;
    const secondProgress = cross(startDifference, firstDelta) / directionCross;

    return isWithinSegment(firstProgress) && isWithinSegment(secondProgress)
      ? pointIntersection(
          dancerIds,
          starts[0],
          firstDelta,
          clampUnitInterval(firstProgress),
          clampUnitInterval(secondProgress),
        )
      : null;
  }

  if (Math.abs(cross(startDifference, firstDelta)) > SAFETY_ENGINE_TOLERANCE) {
    return null;
  }

  const secondStartOnFirst =
    dot(startDifference, firstDelta) / firstLengthSquared;
  const secondEndOnFirst =
    secondStartOnFirst + dot(secondDelta, firstDelta) / firstLengthSquared;
  const overlapStart = Math.max(
    0,
    Math.min(secondStartOnFirst, secondEndOnFirst),
  );
  const overlapEnd = Math.min(
    1,
    Math.max(secondStartOnFirst, secondEndOnFirst),
  );

  if (overlapEnd < overlapStart - SAFETY_ENGINE_TOLERANCE) {
    return null;
  }

  if (overlapEnd - overlapStart <= SAFETY_ENGINE_TOLERANCE) {
    const firstProgress = clampUnitInterval((overlapStart + overlapEnd) / 2);
    const position = add(starts[0], scale(firstDelta, firstProgress));
    const secondProgress = parameterForPointOnSegment(
      position,
      starts[1],
      secondDelta,
    );

    return secondProgress === null
      ? null
      : pointIntersection(
          dancerIds,
          starts[0],
          firstDelta,
          firstProgress,
          secondProgress,
        );
  }

  return {
    kind: "overlap",
    dancerIds,
    overlapEndpoints: [
      add(starts[0], scale(firstDelta, overlapStart)),
      add(starts[0], scale(firstDelta, overlapEnd)),
    ],
  };
}

export function analyzeTransitionSafety({
  transitionId,
  stage,
  dancers,
  formationA,
  formationB,
  safetyThreshold,
}: TransitionSafetyInput): AnalysisResult {
  assertValidStage(stage);

  if (!Number.isFinite(safetyThreshold) || safetyThreshold < 0) {
    throw new RangeError("Safety threshold must be a non-negative number.");
  }

  if (dancers.length < 2) {
    throw new Error("Safety analysis requires at least two dancers.");
  }

  const dancerIds = new Set<DancerId>();
  const starts = new Map<DancerId, DancerPosition>();
  const ends = new Map<DancerId, DancerPosition>();
  const travelDistances: Record<DancerId, number> = {};

  for (const dancer of dancers) {
    if (dancerIds.has(dancer.id)) {
      throw new Error(`Duplicate dancer ID "${dancer.id}".`);
    }
    dancerIds.add(dancer.id);

    const start = formationA.positions[dancer.id];
    const end = formationB.positions[dancer.id];
    assertValidPosition(start, dancer.id, formationA.name);
    assertValidPosition(end, dancer.id, formationB.name);
    starts.set(dancer.id, start);
    ends.set(dancer.id, end);
    travelDistances[dancer.id] = distance(
      toPhysical(start, stage),
      toPhysical(end, stage),
    );
  }

  const pairSeparations: PairSafetyResult[] = [];
  const conflicts: SafetyConflict[] = [];
  const pathIntersections: PathIntersection[] = [];
  let globalMinimumSeparation = Number.POSITIVE_INFINITY;

  for (let firstIndex = 0; firstIndex < dancers.length - 1; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < dancers.length;
      secondIndex += 1
    ) {
      const dancerIds = [
        dancers[firstIndex].id,
        dancers[secondIndex].id,
      ] as const;
      const firstStart = starts.get(dancerIds[0]);
      const secondStart = starts.get(dancerIds[1]);
      const firstEnd = ends.get(dancerIds[0]);
      const secondEnd = ends.get(dancerIds[1]);

      if (
        firstStart === undefined ||
        secondStart === undefined ||
        firstEnd === undefined ||
        secondEnd === undefined
      ) {
        throw new Error("Validated dancer positions became unavailable.");
      }

      const pairStarts = [firstStart, secondStart] as const;
      const pairEnds = [firstEnd, secondEnd] as const;
      const pairResult = analyzePair(
        dancerIds,
        pairStarts,
        pairEnds,
        stage,
        safetyThreshold,
      );
      pairSeparations.push(pairResult);
      globalMinimumSeparation = Math.min(
        globalMinimumSeparation,
        pairResult.minimumSeparation,
      );

      if (pairResult.isConflict) {
        conflicts.push({
          dancerIds: pairResult.dancerIds,
          minimumSeparation: pairResult.minimumSeparation,
          closestApproachTime: pairResult.closestApproachTime,
          closestPositions: pairResult.closestPositions,
        });
      }

      const pathIntersection = calculatePathIntersection(
        dancerIds,
        pairStarts,
        pairEnds,
      );
      if (pathIntersection !== null) {
        pathIntersections.push(pathIntersection);
      }
    }
  }

  const travelValues = Object.values(travelDistances);

  return {
    transitionId,
    safetyThreshold,
    pairSeparations,
    conflicts,
    pathIntersections,
    travelDistances,
    totalTravelDistance: travelValues.reduce(
      (total, travelDistance) => total + travelDistance,
      0,
    ),
    maximumIndividualTravelDistance: Math.max(...travelValues),
    globalMinimumSeparation,
  };
}
