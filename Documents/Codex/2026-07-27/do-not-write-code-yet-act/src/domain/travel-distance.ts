import type { NormalizedPoint, Stage } from "./types";

/**
 * Distances at or below one millionth of a stage unit are treated as
 * stationary for presentation. This absorbs sub-microscopic pointer-coordinate
 * residue without hiding meaningful dancer travel.
 */
export const STATIONARY_TRAVEL_DISTANCE_TOLERANCE = 1e-6;

export function calculateStageTravelDistance(
  start: NormalizedPoint,
  end: NormalizedPoint,
  stage: Stage,
): number {
  if (
    !Number.isFinite(start.x) ||
    !Number.isFinite(start.y) ||
    !Number.isFinite(end.x) ||
    !Number.isFinite(end.y)
  ) {
    throw new RangeError("Travel endpoints must have finite coordinates.");
  }
  if (
    !Number.isFinite(stage.width) ||
    !Number.isFinite(stage.depth) ||
    stage.width <= 0 ||
    stage.depth <= 0
  ) {
    throw new RangeError(
      "Stage width and depth must be finite, positive numbers.",
    );
  }

  return Math.hypot(
    (end.x - start.x) * stage.width,
    (end.y - start.y) * stage.depth,
  );
}

export function isEffectivelyStationaryTravelDistance(
  distance: number,
): boolean {
  if (!Number.isFinite(distance) || distance < 0) {
    throw new RangeError(
      "Travel distance must be a finite, non-negative number.",
    );
  }

  return distance <= STATIONARY_TRAVEL_DISTANCE_TOLERANCE;
}

export function isEffectivelyStationaryTransition(
  start: NormalizedPoint,
  end: NormalizedPoint,
  stage: Stage,
): boolean {
  return isEffectivelyStationaryTravelDistance(
    calculateStageTravelDistance(start, end, stage),
  );
}
