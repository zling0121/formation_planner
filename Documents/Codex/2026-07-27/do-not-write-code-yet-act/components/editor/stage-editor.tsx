"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import {
  acceptTargetSwapRecommendation,
  analyzeTransitionSafety,
  calculateAnimationProgress,
  clampNormalizedPoint,
  clampTransitionProgress,
  copyFormationAToB,
  createFormationEditorState,
  getActiveFormation,
  getRestartedTransitionProgress,
  interpolateFormationPositions,
  isEffectivelyStationaryTransition,
  moveDancer,
  normalizedToScreen,
  parseScrubberProgress,
  previewTargetSwapRecommendation,
  recommendTargetPositionSwap,
  redoAcceptedRecommendation,
  redoPositionChange,
  renameFormation,
  resetFormationPositions,
  screenToNormalized,
  switchFormation,
  undoAcceptedRecommendation,
  undoPositionChange,
  type Dancer,
  type DancerId,
  type Formation,
  type FormationEditorState,
  type FormationId,
  type NormalizedPoint,
  type Recommendation,
  type ScreenRectangle,
  type Stage,
  type TransitionId,
} from "../../src/domain";
import {
  getConflictKey,
  TransitionAnalysisPanel,
} from "./transition-analysis-panel";
import type { RecommendationWorkflowState } from "./recommendation-workflow";

interface StageEditorProps {
  readonly dancers: readonly Dancer[];
  readonly initialFormations: readonly [Formation, Formation];
  readonly lockedDancerIds: readonly DancerId[];
  readonly onDurationChange: (durationMs: number) => void;
  readonly onFormationsChange: (
    formations: readonly [Formation, Formation],
  ) => void;
  readonly stage: Stage;
  readonly durationMs: number;
  readonly safetyThreshold: number;
  readonly transitionId: TransitionId;
}

interface ActiveDrag {
  readonly dancerId: DancerId;
  readonly element: SVGGElement;
  readonly pointerId: number;
  readonly startPosition: NormalizedPoint;
  readonly svg: SVGSVGElement;
  previewPosition: NormalizedPoint;
  animationFrameId: number | null;
}

interface DancerMarkerProps {
  readonly dancer: Dancer;
  readonly isEditable: boolean;
  readonly isConflictAffected: boolean;
  readonly isConflictSelected: boolean;
  readonly isLocked: boolean;
  readonly onKeyDown: (event: KeyboardEvent<SVGGElement>) => void;
  readonly onPointerCancel: (event: PointerEvent<SVGGElement>) => void;
  readonly onPointerDown: (event: PointerEvent<SVGGElement>) => void;
  readonly onPointerMove: (event: PointerEvent<SVGGElement>) => void;
  readonly onPointerUp: (event: PointerEvent<SVGGElement>) => void;
  readonly position: NormalizedPoint;
}

type PlaybackStatus = "complete" | "idle" | "paused" | "playing";

const VIEWBOX_WIDTH = 100;
const VIEWBOX_DEPTH = 66.667;
const STAGE_VIEWPORT: ScreenRectangle = {
  left: 0,
  top: 0,
  width: VIEWBOX_WIDTH,
  height: VIEWBOX_DEPTH,
};
const GRID_MARKS = [0.25, 0.5, 0.75] as const;
const KEYBOARD_STEP = 0.01;
const KEYBOARD_LARGE_STEP = 0.05;
const MIN_DURATION_SECONDS = 1;
const MAX_DURATION_SECONDS = 20;

function subscribeToReducedMotion(onPreferenceChange: () => void): () => void {
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", onPreferenceChange);
  return () => mediaQuery.removeEventListener("change", onPreferenceChange);
}

function getReducedMotionPreference(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getServerReducedMotionPreference(): boolean {
  return false;
}

function formatStageUnit(unit: Stage["unit"]): string {
  return unit === "feet" ? "ft" : "m";
}

function setMarkerPosition(
  marker: SVGGElement,
  position: NormalizedPoint,
): void {
  const screenPosition = normalizedToScreen(position, STAGE_VIEWPORT);
  marker.setAttribute(
    "transform",
    `translate(${screenPosition.x} ${screenPosition.y})`,
  );
  marker.dataset.x = String(position.x);
  marker.dataset.y = String(position.y);
}

function pointerPositionToNormalized(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
): NormalizedPoint {
  const bounds = svg.getBoundingClientRect();

  return clampNormalizedPoint(
    screenToNormalized(
      { x: clientX, y: clientY },
      {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      },
    ),
  );
}

const DancerMarker = memo(function DancerMarker({
  dancer,
  isEditable,
  isConflictAffected,
  isConflictSelected,
  isLocked,
  onKeyDown,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  position,
}: DancerMarkerProps) {
  const screenPosition = normalizedToScreen(position, STAGE_VIEWPORT);
  const initials = dancer.label
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <g
      className={`dancer-marker touch-none outline-none ${
        isEditable ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed"
      }`}
      data-dancer-id={dancer.id}
      data-dancer-label={dancer.label}
      data-testid={`dancer-marker-${dancer.id}`}
      data-conflict-affected={isConflictAffected}
      data-conflict-selected={isConflictSelected}
      data-x={position.x}
      data-y={position.y}
      transform={`translate(${screenPosition.x} ${screenPosition.y})`}
      role="button"
      tabIndex={isEditable ? 0 : -1}
      aria-disabled={!isEditable}
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
      aria-label={`${dancer.label}${isLocked ? ", assignment locked" : ""}. Position ${Math.round(position.x * 100)} percent across and ${Math.round(position.y * 100)} percent downstage.${
        isEditable
          ? " Use arrow keys to move."
          : " Transition preview; editing disabled."
      }`}
      onKeyDown={isEditable ? onKeyDown : undefined}
      onPointerCancel={isEditable ? onPointerCancel : undefined}
      onPointerDown={isEditable ? onPointerDown : undefined}
      onPointerMove={isEditable ? onPointerMove : undefined}
      onPointerUp={isEditable ? onPointerUp : undefined}
    >
      {isConflictSelected ? (
        <circle
          r="6.2"
          fill="none"
          stroke="#b91c1c"
          strokeWidth="1"
          strokeDasharray="1.5 1"
          pointerEvents="none"
          aria-hidden="true"
        />
      ) : null}
      <circle
        className="marker-focus-ring"
        r="5.25"
        fill="none"
        stroke="#2563eb"
        strokeWidth="0.8"
        pointerEvents="none"
      />
      <circle
        data-testid={`dancer-handle-${dancer.id}`}
        r="4"
        fill={isConflictSelected ? "#fef2f2" : isLocked ? "#fff7ed" : "#eff6ff"}
        stroke={
          isConflictSelected ? "#b91c1c" : isLocked ? "#d97706" : "#2563eb"
        }
        strokeWidth={isConflictSelected || isLocked ? "0.8" : "0.55"}
      />
      <text
        y="0.95"
        textAnchor="middle"
        fill={isConflictSelected ? "#991b1b" : isLocked ? "#9a3412" : "#1e3a8a"}
        fontSize="2.8"
        fontWeight="700"
        pointerEvents="none"
        aria-hidden="true"
      >
        {initials}
      </text>
      <text
        y="6.5"
        textAnchor="middle"
        fill="#334155"
        fontSize="2.25"
        fontWeight="600"
        pointerEvents="none"
        aria-hidden="true"
      >
        {dancer.label}
      </text>
    </g>
  );
});

export function StageEditor({
  dancers,
  initialFormations,
  lockedDancerIds,
  onDurationChange,
  onFormationsChange,
  stage,
  durationMs,
  safetyThreshold,
  transitionId,
}: StageEditorProps) {
  const [editorState, setEditorState] = useState<FormationEditorState>(() =>
    createFormationEditorState(initialFormations),
  );
  const [resetBaselineFormations] = useState<readonly [Formation, Formation]>(
    () => structuredClone(initialFormations),
  );
  const [announcement, setAnnouncement] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(() =>
    Math.min(
      MAX_DURATION_SECONDS,
      Math.max(MIN_DURATION_SECONDS, durationMs / 1_000),
    ),
  );
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>("idle");
  const [selectedConflictKey, setSelectedConflictKey] = useState<string | null>(
    null,
  );
  const [recommendation, setRecommendation] = useState<Recommendation | null>(
    null,
  );
  const [recommendationState, setRecommendationState] =
    useState<RecommendationWorkflowState>("idle");
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionPreference,
    getServerReducedMotionPreference,
  );
  const activeDragRef = useRef<ActiveDrag | null>(null);
  const playbackProgressRef = useRef(playbackProgress);
  const editorStateRef = useRef(editorState);
  const activeFormationIdRef = useRef(editorState.activeFormationId);
  const formationsRef = useRef(editorState.formations);
  const lockedDancerKey = lockedDancerIds.join("\u0000");
  const previousLockedDancerKeyRef = useRef(lockedDancerKey);

  useEffect(() => {
    editorStateRef.current = editorState;
  }, [editorState]);

  useEffect(() => {
    activeFormationIdRef.current = editorState.activeFormationId;
  }, [editorState.activeFormationId]);

  useEffect(() => {
    formationsRef.current = editorState.formations;
  }, [editorState.formations]);

  useEffect(() => {
    playbackProgressRef.current = playbackProgress;
  }, [playbackProgress]);

  useEffect(() => {
    if (previousLockedDancerKeyRef.current === lockedDancerKey) {
      return;
    }

    previousLockedDancerKeyRef.current = lockedDancerKey;
    setRecommendation(null);
    setRecommendationState("idle");
    setAnnouncement(
      "Assignment locks updated. Any pending recommendation was cleared.",
    );
  }, [lockedDancerKey]);

  useEffect(() => {
    if (playbackStatus !== "playing") {
      return;
    }

    let animationFrameId: number;

    if (prefersReducedMotion) {
      animationFrameId = requestAnimationFrame(() => {
        playbackProgressRef.current = 1;
        setPlaybackProgress(1);
        setPlaybackStatus("complete");
      });

      return () => cancelAnimationFrame(animationFrameId);
    }

    const durationMilliseconds = durationSeconds * 1_000;
    const startedAt =
      performance.now() - playbackProgressRef.current * durationMilliseconds;

    const updatePlayback = (timestamp: number): void => {
      // The RAF timestamp can describe the frame start just before the
      // performance.now() call above, yielding a tiny negative raw value.
      const nextProgress = calculateAnimationProgress(
        timestamp,
        startedAt,
        durationMilliseconds,
      );
      playbackProgressRef.current = nextProgress;
      setPlaybackProgress(nextProgress);

      if (nextProgress === 1) {
        setPlaybackStatus("complete");
        setAnnouncement(
          "Transition complete at Formation B. Restart or scrub to 0 percent to edit.",
        );
        return;
      }

      animationFrameId = requestAnimationFrame(updatePlayback);
    };

    animationFrameId = requestAnimationFrame(updatePlayback);
    return () => cancelAnimationFrame(animationFrameId);
  }, [durationSeconds, playbackStatus, prefersReducedMotion]);

  const activeFormation = getActiveFormation(editorState);
  const safePlaybackProgress = clampTransitionProgress(playbackProgress);
  const isPlaybackPreview =
    safePlaybackProgress > 0 || playbackStatus === "playing";
  const displayedPositions = useMemo(
    () =>
      isPlaybackPreview
        ? interpolateFormationPositions(
            editorState.formations[0],
            editorState.formations[1],
            safePlaybackProgress,
          )
        : activeFormation.positions,
    [
      activeFormation.positions,
      editorState.formations,
      isPlaybackPreview,
      safePlaybackProgress,
    ],
  );
  const lockedDancers = useMemo(
    () => new Set<DancerId>(lockedDancerIds),
    [lockedDancerIds],
  );
  const dancerLabels = useMemo(
    () => new Map(dancers.map((dancer) => [dancer.id, dancer.label])),
    [dancers],
  );
  const analysis = useMemo(
    () =>
      analyzeTransitionSafety({
        transitionId,
        stage,
        dancers,
        formationA: editorState.formations[0],
        formationB: editorState.formations[1],
        safetyThreshold,
      }),
    [dancers, editorState.formations, safetyThreshold, stage, transitionId],
  );
  const previewFormationB = useMemo(
    () =>
      recommendationState === "preview" && recommendation !== null
        ? previewTargetSwapRecommendation(
            editorState.formations[1],
            recommendation,
          )
        : null,
    [editorState.formations, recommendation, recommendationState],
  );
  const isRecommendationPreview = previewFormationB !== null;
  const isEditorReadOnly = isPlaybackPreview || isRecommendationPreview;
  const conflictAffectedDancerIds = useMemo(
    () => new Set(analysis.conflicts.flatMap((conflict) => conflict.dancerIds)),
    [analysis.conflicts],
  );
  const selectedConflict =
    analysis.conflicts.find(
      (conflict) => getConflictKey(conflict) === selectedConflictKey,
    ) ?? null;
  const selectedConflictDancerIds = useMemo(
    () => new Set(selectedConflict?.dancerIds ?? []),
    [selectedConflict],
  );

  const handleSelectConflict = useCallback(
    (conflictKey: string): void => {
      const conflict = analysis.conflicts.find(
        (item) => getConflictKey(item) === conflictKey,
      );
      if (conflict === undefined) {
        throw new Error(`Cannot select unknown conflict "${conflictKey}".`);
      }

      const firstLabel = dancerLabels.get(conflict.dancerIds[0]);
      const secondLabel = dancerLabels.get(conflict.dancerIds[1]);
      if (firstLabel === undefined || secondLabel === undefined) {
        throw new Error("Cannot focus a conflict with unknown dancers.");
      }

      setSelectedConflictKey(conflictKey);
      setAnnouncement(
        `Focused conflict between ${firstLabel} and ${secondLabel}.`,
      );
    },
    [analysis.conflicts, dancerLabels],
  );

  const updateEditorState = useCallback(
    (
      update: (currentState: FormationEditorState) => FormationEditorState,
    ): FormationEditorState => {
      const currentState = editorStateRef.current;
      const nextState = update(currentState);
      editorStateRef.current = nextState;
      formationsRef.current = nextState.formations;
      activeFormationIdRef.current = nextState.activeFormationId;
      setEditorState(nextState);
      if (nextState.formations !== currentState.formations) {
        onFormationsChange(nextState.formations);
      }
      return nextState;
    },
    [onFormationsChange],
  );

  const invalidateRecommendation = useCallback((): void => {
    setRecommendation(null);
    setRecommendationState("idle");
  }, []);

  const handleRequestRecommendation = useCallback((): void => {
    const currentFormations = editorStateRef.current.formations;
    const result = recommendTargetPositionSwap({
      transitionId,
      stage,
      dancers,
      formationA: currentFormations[0],
      formationB: currentFormations[1],
      safetyThreshold,
      lockedDancerIds,
    });

    setRecommendation(result);
    setRecommendationState(result === null ? "no-improvement" : "available");
    setAnnouncement(
      result === null
        ? "No unlocked two-dancer swap reduces modeled safety conflicts."
        : "A safer modeled target swap is available to preview.",
    );
  }, [dancers, lockedDancerIds, safetyThreshold, stage, transitionId]);

  const handlePreviewRecommendation = useCallback((): void => {
    if (recommendation === null) {
      throw new Error("Cannot preview a missing recommendation.");
    }

    setRecommendationState("preview");
    setAnnouncement(
      "Recommendation preview opened. Saved Formation B is unchanged.",
    );
  }, [recommendation]);

  const handleRejectRecommendation = useCallback((): void => {
    if (recommendation === null) {
      throw new Error("Cannot reject a missing recommendation.");
    }

    setRecommendation(null);
    setRecommendationState("idle");
    setAnnouncement("Recommendation rejected. Formation B was not changed.");
  }, [recommendation]);

  const handleAcceptRecommendation = useCallback((): void => {
    if (recommendation === null) {
      throw new Error("Cannot accept a missing recommendation.");
    }
    if (
      recommendation.dancerIds.some((dancerId) => lockedDancers.has(dancerId))
    ) {
      setRecommendation(null);
      setRecommendationState("idle");
      setAnnouncement(
        "Recommendation cleared because an affected dancer is now locked.",
      );
      return;
    }

    updateEditorState((currentState) =>
      acceptTargetSwapRecommendation(currentState, recommendation),
    );
    setRecommendation(null);
    setRecommendationState("idle");
    setSelectedConflictKey(null);
    setAnnouncement(
      "Recommendation accepted as one formation change. Undo is available.",
    );
  }, [lockedDancers, recommendation, updateEditorState]);

  const handlePlay = useCallback((): void => {
    if (playbackProgressRef.current >= 1) {
      return;
    }

    if (prefersReducedMotion) {
      playbackProgressRef.current = 1;
      setPlaybackProgress(1);
      setPlaybackStatus("complete");
      setAnnouncement(
        "Transition moved to the end without animation because reduced motion is enabled.",
      );
      return;
    }

    setPlaybackStatus("playing");
    setAnnouncement("Transition playback started. Editing is disabled.");
  }, [prefersReducedMotion]);

  const handlePause = useCallback((): void => {
    if (playbackStatus !== "playing") {
      return;
    }

    setPlaybackStatus("paused");
    setAnnouncement(
      `Transition paused at ${Math.round(playbackProgressRef.current * 100)} percent.`,
    );
  }, [playbackStatus]);

  const handleRestart = useCallback((): void => {
    const restartedProgress = getRestartedTransitionProgress();
    playbackProgressRef.current = restartedProgress;
    setPlaybackProgress(restartedProgress);
    setPlaybackStatus("idle");
    setAnnouncement("Transition restarted. Formation editing is available.");
  }, []);

  const handleScrub = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const result = parseScrubberProgress(event.target.value);
      if (!result.ok) {
        setAnnouncement(result.error);
        return;
      }

      const nextProgress = result.progress;
      playbackProgressRef.current = nextProgress;
      setPlaybackProgress(nextProgress);
      setPlaybackStatus(
        nextProgress === 0
          ? "idle"
          : nextProgress === 1
            ? "complete"
            : "paused",
      );
      setAnnouncement(
        `Transition moved to ${Math.round(nextProgress * 100)} percent.`,
      );
    },
    [],
  );

  const handleDurationChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const nextDuration = Number(event.target.value);

      if (
        !Number.isFinite(nextDuration) ||
        nextDuration < MIN_DURATION_SECONDS ||
        nextDuration > MAX_DURATION_SECONDS
      ) {
        return;
      }

      setDurationSeconds(nextDuration);
      onDurationChange(nextDuration * 1_000);
      setAnnouncement(`Transition duration set to ${nextDuration} seconds.`);
    },
    [onDurationChange],
  );

  const commitPosition = useCallback(
    (dancerId: DancerId, position: NormalizedPoint): void => {
      const formationId = activeFormationIdRef.current;
      const currentFormation = formationsRef.current.find(
        (formation) => formation.id === formationId,
      );
      const currentPosition = currentFormation?.positions[dancerId];

      if (currentPosition === undefined) {
        throw new Error(
          `Cannot commit position for unknown dancer "${dancerId}".`,
        );
      }

      updateEditorState((currentState) =>
        moveDancer(currentState, dancerId, position),
      );
      invalidateRecommendation();

      const dancerLabel = dancerLabels.get(dancerId);
      if (dancerLabel === undefined) {
        throw new Error(`Cannot announce unknown dancer "${dancerId}".`);
      }

      setAnnouncement(
        `${dancerLabel} moved to ${Math.round(position.x * 100)} percent across and ${Math.round(position.y * 100)} percent downstage.`,
      );
    },
    [dancerLabels, invalidateRecommendation, updateEditorState],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<SVGGElement>): void => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const dancerId = event.currentTarget.dataset.dancerId;
      const svg = event.currentTarget.ownerSVGElement;
      const formation = formationsRef.current.find(
        (item) => item.id === activeFormationIdRef.current,
      );
      const startPosition =
        dancerId === undefined ? undefined : formation?.positions[dancerId];

      if (
        dancerId === undefined ||
        svg === null ||
        startPosition === undefined
      ) {
        throw new Error("Unable to start dancer drag from invalid stage data.");
      }

      event.preventDefault();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      activeDragRef.current = {
        dancerId,
        element: event.currentTarget,
        pointerId: event.pointerId,
        startPosition,
        svg,
        previewPosition: startPosition,
        animationFrameId: null,
      };
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<SVGGElement>): void => {
      const activeDrag = activeDragRef.current;

      if (activeDrag === null || activeDrag.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      activeDrag.previewPosition = pointerPositionToNormalized(
        event.clientX,
        event.clientY,
        activeDrag.svg,
      );

      if (activeDrag.animationFrameId !== null) {
        return;
      }

      activeDrag.animationFrameId = requestAnimationFrame(() => {
        const currentDrag = activeDragRef.current;
        if (currentDrag === null) {
          return;
        }

        setMarkerPosition(currentDrag.element, currentDrag.previewPosition);
        currentDrag.animationFrameId = null;
      });
    },
    [],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<SVGGElement>): void => {
      const activeDrag = activeDragRef.current;

      if (activeDrag === null || activeDrag.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const finalPosition = pointerPositionToNormalized(
        event.clientX,
        event.clientY,
        activeDrag.svg,
      );

      if (activeDrag.animationFrameId !== null) {
        cancelAnimationFrame(activeDrag.animationFrameId);
      }

      setMarkerPosition(activeDrag.element, finalPosition);
      if (activeDrag.element.hasPointerCapture(event.pointerId)) {
        activeDrag.element.releasePointerCapture(event.pointerId);
      }
      activeDragRef.current = null;
      commitPosition(activeDrag.dancerId, finalPosition);
    },
    [commitPosition],
  );

  const handlePointerCancel = useCallback(
    (event: PointerEvent<SVGGElement>): void => {
      const activeDrag = activeDragRef.current;

      if (activeDrag === null || activeDrag.pointerId !== event.pointerId) {
        return;
      }

      if (activeDrag.animationFrameId !== null) {
        cancelAnimationFrame(activeDrag.animationFrameId);
      }

      setMarkerPosition(activeDrag.element, activeDrag.startPosition);
      if (activeDrag.element.hasPointerCapture(event.pointerId)) {
        activeDrag.element.releasePointerCapture(event.pointerId);
      }
      activeDragRef.current = null;
    },
    [],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<SVGGElement>): void => {
      const movement: Record<
        "ArrowDown" | "ArrowLeft" | "ArrowRight" | "ArrowUp",
        NormalizedPoint
      > = {
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
      };
      const direction = movement[event.key as keyof typeof movement];

      if (direction === undefined) {
        return;
      }

      const dancerId = event.currentTarget.dataset.dancerId;
      const formation = formationsRef.current.find(
        (item) => item.id === activeFormationIdRef.current,
      );
      const currentPosition =
        dancerId === undefined ? undefined : formation?.positions[dancerId];

      if (dancerId === undefined || currentPosition === undefined) {
        throw new Error("Unable to move dancer from invalid stage data.");
      }

      event.preventDefault();
      const step = event.shiftKey ? KEYBOARD_LARGE_STEP : KEYBOARD_STEP;
      commitPosition(
        dancerId,
        clampNormalizedPoint({
          x: currentPosition.x + direction.x * step,
          y: currentPosition.y + direction.y * step,
        }),
      );
    },
    [commitPosition],
  );

  const selectFormation = useCallback(
    (formationId: FormationId): void => {
      const nextState = updateEditorState((currentState) =>
        switchFormation(currentState, formationId),
      );
      setAnnouncement(`${getActiveFormation(nextState).name} selected.`);
    },
    [updateEditorState],
  );

  const handleCopyFormation = useCallback((): void => {
    updateEditorState(copyFormationAToB);
    invalidateRecommendation();
    setAnnouncement("Formation A positions copied into Formation B.");
  }, [invalidateRecommendation, updateEditorState]);

  const handleResetFormation = useCallback((): void => {
    const formationId = activeFormationIdRef.current;
    const currentFormation = formationsRef.current.find(
      (formation) => formation.id === formationId,
    );
    const baselineFormation = resetBaselineFormations.find(
      (formation) => formation.id === formationId,
    );

    if (currentFormation === undefined || baselineFormation === undefined) {
      throw new Error(`Cannot reset unknown formation "${formationId}".`);
    }

    const confirmed = window.confirm(
      `Reset all dancer positions in ${currentFormation.name}? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    updateEditorState((currentState) =>
      resetFormationPositions(currentState, baselineFormation),
    );
    invalidateRecommendation();
    setAnnouncement(`${currentFormation.name} positions reset.`);
  }, [invalidateRecommendation, resetBaselineFormations, updateEditorState]);

  const handleRenameFormation = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      const formationId = activeFormationIdRef.current;
      const submittedName = new FormData(event.currentTarget).get(
        "formationName",
      );

      if (typeof submittedName !== "string") {
        throw new Error("Formation name form value is missing.");
      }

      const normalizedName = submittedName.trim();

      if (normalizedName.length === 0) {
        setAnnouncement("Enter a formation name before saving.");
        return;
      }

      updateEditorState((currentState) =>
        renameFormation(currentState, formationId, normalizedName),
      );
      setAnnouncement(`Formation renamed to ${normalizedName}.`);
    },
    [updateEditorState],
  );

  const handleUndo = useCallback((): void => {
    const currentState = editorStateRef.current;
    const recommendationChange = currentState.undoableRecommendationChange;
    const positionChange = currentState.undoablePositionChange;
    invalidateRecommendation();

    if (recommendationChange !== null) {
      updateEditorState(undoAcceptedRecommendation);
      setAnnouncement("Accepted recommendation undone.");
      return;
    }

    updateEditorState(undoPositionChange);
    if (positionChange !== null) {
      const label = dancerLabels.get(positionChange.dancerId);
      setAnnouncement(`${label ?? "Dancer"} position change undone.`);
    }
  }, [dancerLabels, invalidateRecommendation, updateEditorState]);

  const handleRedo = useCallback((): void => {
    const currentState = editorStateRef.current;
    const recommendationChange = currentState.redoableRecommendationChange;
    const positionChange = currentState.redoablePositionChange;
    invalidateRecommendation();

    if (recommendationChange !== null) {
      updateEditorState(redoAcceptedRecommendation);
      setAnnouncement("Accepted recommendation redone.");
      return;
    }

    updateEditorState(redoPositionChange);
    if (positionChange !== null) {
      const label = dancerLabels.get(positionChange.dancerId);
      setAnnouncement(`${label ?? "Dancer"} position change redone.`);
    }
  }, [dancerLabels, invalidateRecommendation, updateEditorState]);

  return (
    <>
      <section
        className="flex min-w-0 flex-col bg-slate-50 p-4 sm:p-6"
        aria-labelledby="stage-heading"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
              Stage editor
            </p>
            <h2
              id="stage-heading"
              className="mt-1 text-xl font-semibold tracking-tight text-slate-950"
            >
              {isRecommendationPreview
                ? "Recommendation preview"
                : isPlaybackPreview
                  ? "Transition preview"
                  : activeFormation.name}
            </h2>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>
              {stage.width} × {stage.depth} {formatStageUnit(stage.unit)}
            </p>
            <p className="mt-1">
              {isRecommendationPreview
                ? "Saved Formation B is unchanged"
                : isPlaybackPreview
                  ? `${Math.round(safePlaybackProgress * 100)}% from A to B`
                  : editorState.dirtyFormationIds.has(activeFormation.id)
                    ? "Unsaved changes"
                    : "Sample formation"}
            </p>
          </div>
        </div>

        <div className="my-auto">
          <figure className="m-0" aria-labelledby="stage-editor-caption">
            <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-50">
              <svg
                className="block aspect-3/2 w-full select-none"
                data-testid="stage-editor"
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_DEPTH}`}
                role="img"
                aria-labelledby="stage-editor-title stage-editor-description"
              >
                <title id="stage-editor-title">
                  {isRecommendationPreview
                    ? "Recommendation preview with current and proposed movement paths"
                    : isPlaybackPreview
                      ? `Transition preview at ${Math.round(safePlaybackProgress * 100)} percent`
                      : `${activeFormation.name} stage editor`}
                </title>
                <desc id="stage-editor-description">
                  {isRecommendationPreview
                    ? "A normalized top-down stage showing current saved paths and proposed blue dashed paths. Saved formation positions are unchanged."
                    : isPlaybackPreview
                      ? "A normalized top-down stage showing linearly interpolated dancer positions, movement paths, and safety conflicts. Editing is disabled until restart."
                      : "A normalized top-down stage with draggable dancer positions, movement paths, and safety conflicts. Focus a dancer and use the arrow keys for precise movement."}
                </desc>

                <rect
                  x="0"
                  y="0"
                  width={VIEWBOX_WIDTH}
                  height={VIEWBOX_DEPTH}
                  rx="1.5"
                  fill="#ffffff"
                  stroke="#cbd5e1"
                  strokeWidth="0.5"
                />

                {GRID_MARKS.map((mark) => (
                  <g key={mark} aria-hidden="true">
                    <line
                      x1={mark * VIEWBOX_WIDTH}
                      y1="0"
                      x2={mark * VIEWBOX_WIDTH}
                      y2={VIEWBOX_DEPTH}
                      stroke="#e2e8f0"
                      strokeWidth="0.3"
                      strokeDasharray="1.5 1.5"
                    />
                    <line
                      x1="0"
                      y1={mark * VIEWBOX_DEPTH}
                      x2={VIEWBOX_WIDTH}
                      y2={mark * VIEWBOX_DEPTH}
                      stroke="#e2e8f0"
                      strokeWidth="0.3"
                      strokeDasharray="1.5 1.5"
                    />
                  </g>
                ))}

                <line
                  x1={VIEWBOX_WIDTH / 2}
                  y1="0"
                  x2={VIEWBOX_WIDTH / 2}
                  y2={VIEWBOX_DEPTH}
                  stroke="#cbd5e1"
                  strokeWidth="0.4"
                  aria-hidden="true"
                />

                {dancers.map((dancer) => {
                  const start = normalizedToScreen(
                    editorState.formations[0].positions[dancer.id],
                    STAGE_VIEWPORT,
                  );
                  const end = normalizedToScreen(
                    editorState.formations[1].positions[dancer.id],
                    STAGE_VIEWPORT,
                  );
                  const isUnsafe = conflictAffectedDancerIds.has(dancer.id);
                  const isSelected = selectedConflictDancerIds.has(dancer.id);

                  return (
                    <line
                      key={dancer.id}
                      data-testid={`movement-path-${dancer.id}`}
                      data-unsafe={isUnsafe}
                      data-selected={isSelected}
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke={
                        isSelected
                          ? "#991b1b"
                          : isUnsafe
                            ? "#dc2626"
                            : "#94a3b8"
                      }
                      strokeWidth={
                        isSelected ? "1.2" : isUnsafe ? "0.8" : "0.4"
                      }
                      strokeDasharray={isUnsafe ? "2 1.2" : undefined}
                      opacity={isUnsafe ? "0.95" : "0.7"}
                      pointerEvents="none"
                      aria-hidden="true"
                    />
                  );
                })}

                {previewFormationB !== null && recommendation !== null
                  ? recommendation.dancerIds.map((dancerId) => {
                      const startPosition =
                        editorState.formations[0].positions[dancerId];
                      const proposedTargetPosition =
                        previewFormationB.positions[dancerId];
                      const start = normalizedToScreen(
                        startPosition,
                        STAGE_VIEWPORT,
                      );
                      const proposedTarget = normalizedToScreen(
                        proposedTargetPosition,
                        STAGE_VIEWPORT,
                      );
                      const dancerLabel =
                        dancerLabels.get(dancerId) ?? dancerId;
                      const isStationary = isEffectivelyStationaryTransition(
                        startPosition,
                        proposedTargetPosition,
                        stage,
                      );

                      return (
                        <g key={dancerId}>
                          {isStationary ? (
                            <g
                              data-testid={`recommendation-preview-stationary-${dancerId}`}
                              role="img"
                              aria-label={`${dancerLabel} remains stationary in the proposed transition`}
                              pointerEvents="none"
                            >
                              <circle
                                cx={proposedTarget.x}
                                cy={proposedTarget.y}
                                r="6.3"
                                fill="none"
                                stroke="#2563eb"
                                strokeWidth="1.1"
                                strokeDasharray="2.5 1.2"
                              />
                            </g>
                          ) : (
                            <line
                              data-testid={`recommendation-preview-path-${dancerId}`}
                              x1={start.x}
                              y1={start.y}
                              x2={proposedTarget.x}
                              y2={proposedTarget.y}
                              stroke="#2563eb"
                              strokeWidth="1.1"
                              strokeDasharray="2.5 1.2"
                              pointerEvents="none"
                              aria-hidden="true"
                            />
                          )}
                          <circle
                            data-testid={`recommendation-preview-target-${dancerId}`}
                            cx={proposedTarget.x}
                            cy={proposedTarget.y}
                            r="2.3"
                            fill="#dbeafe"
                            stroke="#1d4ed8"
                            strokeWidth="0.7"
                            role="img"
                            aria-label={`Proposed Formation B target for ${dancerLabel}`}
                          />
                        </g>
                      );
                    })
                  : null}

                {analysis.conflicts.map((conflict) => {
                  const conflictKey = getConflictKey(conflict);
                  const firstPosition = conflict.closestPositions[0];
                  const secondPosition = conflict.closestPositions[1];
                  const conflictLocation = normalizedToScreen(
                    {
                      x: (firstPosition.x + secondPosition.x) / 2,
                      y: (firstPosition.y + secondPosition.y) / 2,
                    },
                    STAGE_VIEWPORT,
                  );
                  const isSelected = conflictKey === selectedConflictKey;
                  const firstLabel =
                    dancerLabels.get(conflict.dancerIds[0]) ??
                    conflict.dancerIds[0];
                  const secondLabel =
                    dancerLabels.get(conflict.dancerIds[1]) ??
                    conflict.dancerIds[1];

                  return (
                    <g
                      key={conflictKey}
                      data-testid={`conflict-location-${conflictKey}`}
                      data-selected={isSelected}
                      transform={`translate(${conflictLocation.x} ${conflictLocation.y})`}
                      role="img"
                      aria-label={`Approximate conflict location for ${firstLabel} and ${secondLabel} at ${Math.round(conflict.closestApproachTime * 100)} percent`}
                    >
                      <rect
                        x={isSelected ? -3.6 : -2.8}
                        y={isSelected ? -3.6 : -2.8}
                        width={isSelected ? 7.2 : 5.6}
                        height={isSelected ? 7.2 : 5.6}
                        rx="0.7"
                        fill="#fff1f2"
                        stroke="#be123c"
                        strokeWidth={isSelected ? "1" : "0.7"}
                        transform="rotate(45)"
                      />
                      <text
                        y="1"
                        textAnchor="middle"
                        fill="#9f1239"
                        fontSize="3.2"
                        fontWeight="800"
                        pointerEvents="none"
                        aria-hidden="true"
                      >
                        !
                      </text>
                    </g>
                  );
                })}

                <text
                  x="3"
                  y="4.5"
                  fill="#94a3b8"
                  fontSize="2.2"
                  fontWeight="600"
                  letterSpacing="0.22"
                  aria-hidden="true"
                >
                  UPSTAGE
                </text>

                {dancers.map((dancer) => (
                  <DancerMarker
                    key={dancer.id}
                    dancer={dancer}
                    isEditable={!isEditorReadOnly}
                    isConflictAffected={conflictAffectedDancerIds.has(
                      dancer.id,
                    )}
                    isConflictSelected={selectedConflictDancerIds.has(
                      dancer.id,
                    )}
                    isLocked={lockedDancers.has(dancer.id)}
                    position={displayedPositions[dancer.id]}
                    onKeyDown={handleKeyDown}
                    onPointerCancel={handlePointerCancel}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                ))}

                <text
                  x={VIEWBOX_WIDTH / 2}
                  y={VIEWBOX_DEPTH - 2.2}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="2.2"
                  fontWeight="600"
                  letterSpacing="0.22"
                  aria-hidden="true"
                >
                  AUDIENCE
                </text>
              </svg>
            </div>

            <figcaption
              id="stage-editor-caption"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"
            >
              <span>
                {isRecommendationPreview
                  ? "Current paths remain visible; blue dashed paths show the unaccepted proposal."
                  : isPlaybackPreview
                    ? "Restart or scrub to 0% to return to formation editing."
                    : "Drag markers or use arrow keys. Hold Shift for 5% steps."}
              </span>
              <span
                className="flex items-center gap-3"
                aria-label="Stage legend"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full border border-blue-600 bg-blue-50"
                    aria-hidden="true"
                  />
                  Dancer
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full border-2 border-amber-600 bg-amber-50"
                    aria-hidden="true"
                  />
                  Assignment locked
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-4 border-t-2 border-dashed border-red-600"
                    aria-hidden="true"
                  />
                  Unsafe path
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="grid size-3 rotate-45 place-items-center rounded-[2px] border border-rose-700 bg-rose-50"
                    aria-hidden="true"
                  />
                  Conflict location
                </span>
                {isRecommendationPreview ? (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-4 border-t-2 border-dashed border-blue-600"
                        aria-hidden="true"
                      />
                      Proposed movement
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-3 rounded-full border-2 border-dashed border-blue-600"
                        aria-hidden="true"
                      />
                      Proposed stationary point
                    </span>
                  </>
                ) : null}
              </span>
            </figcaption>
          </figure>
        </div>

        <section
          className="mt-5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
          aria-labelledby="formation-controls-heading"
        >
          <h2 id="formation-controls-heading" className="sr-only">
            Formation controls
          </h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="grid grid-cols-2 rounded-lg bg-slate-100 p-1"
                role="group"
                aria-label="Choose formation"
              >
                {editorState.formations.map((formation, index) => {
                  const isActive = formation.id === activeFormation.id;
                  const slotName = index === 0 ? "A" : "B";

                  return (
                    <button
                      key={formation.id}
                      className={
                        isActive
                          ? "rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm"
                          : "rounded-md px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800"
                      }
                      type="button"
                      aria-label={`View ${formation.name}`}
                      aria-pressed={isActive}
                      disabled={isEditorReadOnly}
                      onClick={() => selectFormation(formation.id)}
                    >
                      <span className="mr-1.5 text-xs text-slate-400">
                        {slotName}
                      </span>
                      {formation.name}
                    </button>
                  );
                })}
              </div>

              <div
                className="flex items-center gap-2"
                role="group"
                aria-label="Position history"
              >
                <button
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
                  type="button"
                  aria-label="Undo last formation change"
                  disabled={
                    isEditorReadOnly ||
                    (editorState.undoablePositionChange === null &&
                      editorState.undoableRecommendationChange === null)
                  }
                  onClick={handleUndo}
                >
                  Undo
                </button>
                <button
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
                  type="button"
                  aria-label="Redo last formation change"
                  disabled={
                    isEditorReadOnly ||
                    (editorState.redoablePositionChange === null &&
                      editorState.redoableRecommendationChange === null)
                  }
                  onClick={handleRedo}
                >
                  Redo
                </button>
              </div>
            </div>

            <div className="grid gap-3 border-t border-slate-200 pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <form
                className="flex min-w-0 flex-col gap-1.5"
                onSubmit={handleRenameFormation}
              >
                <label
                  className="text-xs font-semibold text-slate-600"
                  htmlFor="formation-name"
                >
                  Active formation name
                </label>
                <div className="flex min-w-0 gap-2">
                  <input
                    key={`${activeFormation.id}:${activeFormation.name}`}
                    id="formation-name"
                    className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800"
                    name="formationName"
                    maxLength={40}
                    defaultValue={activeFormation.name}
                    disabled={isEditorReadOnly}
                  />
                  <button
                    className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    type="submit"
                    aria-label="Save formation name"
                    disabled={isEditorReadOnly}
                  >
                    Rename
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap gap-2">
                <button
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  disabled={isEditorReadOnly}
                  onClick={handleCopyFormation}
                >
                  Copy A into B
                </button>
                <button
                  className="min-h-10 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                  type="button"
                  aria-label={`Reset ${activeFormation.name} positions`}
                  disabled={isEditorReadOnly}
                  onClick={handleResetFormation}
                >
                  Reset positions
                </button>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label="Transition playback"
                >
                  <button
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    type="button"
                    aria-label="Play transition preview"
                    disabled={
                      isRecommendationPreview ||
                      playbackStatus === "playing" ||
                      safePlaybackProgress >= 1
                    }
                    onClick={handlePlay}
                  >
                    <span aria-hidden="true">▶</span>
                    Play
                  </button>
                  <button
                    className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
                    type="button"
                    aria-label="Pause transition preview"
                    disabled={
                      isRecommendationPreview || playbackStatus !== "playing"
                    }
                    onClick={handlePause}
                  >
                    Pause
                  </button>
                  <button
                    className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
                    type="button"
                    aria-label="Restart transition preview"
                    disabled={
                      isRecommendationPreview ||
                      (safePlaybackProgress === 0 && playbackStatus === "idle")
                    }
                    onClick={handleRestart}
                  >
                    Restart
                  </button>
                </div>

                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  Duration
                  <input
                    className="w-28 accent-slate-900"
                    type="range"
                    aria-label="Transition duration in seconds"
                    min={MIN_DURATION_SECONDS}
                    max={MAX_DURATION_SECONDS}
                    step={1}
                    value={durationSeconds}
                    disabled={isRecommendationPreview}
                    onChange={handleDurationChange}
                  />
                  <output className="w-8 text-right text-xs text-slate-600 tabular-nums">
                    {durationSeconds}s
                  </output>
                </label>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <label
                    className="font-semibold text-slate-600"
                    htmlFor="transition-progress"
                  >
                    Transition progress
                  </label>
                  <output
                    className="font-bold text-slate-800 tabular-nums"
                    htmlFor="transition-progress"
                    data-testid="transition-progress-output"
                  >
                    {Math.round(safePlaybackProgress * 100)}%
                  </output>
                </div>
                <input
                  id="transition-progress"
                  className="block w-full accent-slate-900"
                  type="range"
                  aria-label="Transition progress"
                  min={0}
                  max={100}
                  step={1}
                  value={safePlaybackProgress * 100}
                  disabled={isRecommendationPreview}
                  onChange={handleScrub}
                />
                <p className="mt-2 text-xs text-slate-500">
                  {prefersReducedMotion
                    ? "Reduced motion is enabled: Play moves directly to Formation B. Scrubbing remains available."
                    : isRecommendationPreview
                      ? "Reject or accept the recommendation to resume editing and playback."
                      : isPlaybackPreview
                        ? "Formation editing is disabled during preview. Restart or scrub to 0% to edit."
                        : "Undo and redo retain only the latest formation change."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <p
          className="mt-2 min-h-4 text-xs text-slate-500"
          role="status"
          aria-live="polite"
        >
          {announcement}
        </p>
      </section>
      <TransitionAnalysisPanel
        analysis={analysis}
        dancers={dancers}
        isRecommendationDisabled={isPlaybackPreview}
        onAcceptRecommendation={handleAcceptRecommendation}
        onPreviewRecommendation={handlePreviewRecommendation}
        onRejectRecommendation={handleRejectRecommendation}
        onRequestRecommendation={handleRequestRecommendation}
        onSelectConflict={handleSelectConflict}
        recommendation={recommendation}
        recommendationState={recommendationState}
        selectedConflictKey={
          selectedConflict === null ? null : selectedConflictKey
        }
        stage={stage}
      />
    </>
  );
}
