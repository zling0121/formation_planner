import type {
  DancerId,
  DancerPosition,
  Formation,
  NormalizedPoint,
} from "./types";

function assertValidProgress(progress: number): void {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new RangeError("Transition progress must be between 0 and 1.");
  }
}

export type ScrubberProgressResult =
  | {
      readonly ok: true;
      readonly progress: number;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

export function clampTransitionProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    throw new RangeError("Raw transition progress must be a finite number.");
  }

  return Math.min(1, Math.max(0, progress));
}

export function calculateAnimationProgress(
  timestampMs: number,
  startedAtMs: number,
  durationMs: number,
): number {
  if (
    !Number.isFinite(timestampMs) ||
    !Number.isFinite(startedAtMs) ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0
  ) {
    throw new RangeError(
      "Playback timing values must be finite and duration must be positive.",
    );
  }

  return clampTransitionProgress((timestampMs - startedAtMs) / durationMs);
}

export function getRestartedTransitionProgress(): 0 {
  return 0;
}

export function parseScrubberProgress(
  percentageValue: string,
): ScrubberProgressResult {
  if (percentageValue.trim().length === 0) {
    return {
      ok: false,
      error: "Transition scrub value must be a finite percentage.",
    };
  }

  const percentage = Number(percentageValue);
  if (!Number.isFinite(percentage)) {
    return {
      ok: false,
      error: "Transition scrub value must be a finite percentage.",
    };
  }

  return {
    ok: true,
    progress: clampTransitionProgress(percentage / 100),
  };
}

function assertFinitePoint(point: NormalizedPoint, name: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError(`${name} position must contain finite coordinates.`);
  }
}

export function interpolatePosition(
  start: NormalizedPoint,
  end: NormalizedPoint,
  progress: number,
): NormalizedPoint {
  assertValidProgress(progress);
  assertFinitePoint(start, "Start");
  assertFinitePoint(end, "End");

  if (progress === 0) {
    return { ...start };
  }

  if (progress === 1) {
    return { ...end };
  }

  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
  };
}

export function interpolateFormationPositions(
  formationA: Formation,
  formationB: Formation,
  progress: number,
): Readonly<Record<DancerId, DancerPosition>> {
  assertValidProgress(progress);

  return Object.fromEntries(
    Object.entries(formationA.positions).map(([dancerId, start]) => {
      const end = formationB.positions[dancerId];

      if (end === undefined) {
        throw new Error(
          `Formation B is missing a position for dancer "${dancerId}".`,
        );
      }

      return [
        dancerId,
        {
          dancerId,
          ...interpolatePosition(start, end, progress),
        },
      ];
    }),
  );
}
