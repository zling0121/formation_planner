import type {
  DancerId,
  DancerPosition,
  Formation,
  FormationId,
  NormalizedPoint,
  Recommendation,
} from "./types";
import { isNormalizedCoordinate } from "./validation";

export interface PositionChange {
  readonly formationId: FormationId;
  readonly dancerId: DancerId;
  readonly before: NormalizedPoint;
  readonly after: NormalizedPoint;
}

export interface AcceptedRecommendationChange {
  readonly recommendation: Recommendation;
}

/**
 * The editor intentionally retains only the most recent position change.
 * This supports one-step undo/redo without introducing an unlimited timeline.
 */
export interface FormationEditorState {
  readonly formations: readonly [Formation, Formation];
  readonly activeFormationId: FormationId;
  readonly dirtyFormationIds: ReadonlySet<FormationId>;
  readonly undoablePositionChange: PositionChange | null;
  readonly redoablePositionChange: PositionChange | null;
  readonly undoableRecommendationChange: AcceptedRecommendationChange | null;
  readonly redoableRecommendationChange: AcceptedRecommendationChange | null;
}

function findFormation(
  formations: readonly [Formation, Formation],
  formationId: FormationId,
): Formation {
  const formation = formations.find((item) => item.id === formationId);

  if (formation === undefined) {
    throw new Error(`Unknown formation "${formationId}".`);
  }

  return formation;
}

function clonePositions(
  positions: Formation["positions"],
): Readonly<Record<DancerId, DancerPosition>> {
  return Object.fromEntries(
    Object.entries(positions).map(([dancerId, position]) => [
      dancerId,
      { ...position },
    ]),
  );
}

function updateFormation(
  formations: readonly [Formation, Formation],
  formationId: FormationId,
  update: (formation: Formation) => Formation,
): readonly [Formation, Formation] {
  if (formations[0].id === formationId) {
    return [update(formations[0]), formations[1]];
  }

  if (formations[1].id === formationId) {
    return [formations[0], update(formations[1])];
  }

  throw new Error(`Unknown formation "${formationId}".`);
}

function updateFormationPosition(
  formations: readonly [Formation, Formation],
  formationId: FormationId,
  dancerId: DancerId,
  position: NormalizedPoint,
): readonly [Formation, Formation] {
  return updateFormation(formations, formationId, (formation) => {
    if (formation.positions[dancerId] === undefined) {
      throw new Error(
        `Unknown dancer "${dancerId}" in formation "${formationId}".`,
      );
    }

    return {
      ...formation,
      positions: {
        ...formation.positions,
        [dancerId]: {
          dancerId,
          ...position,
        },
      },
    };
  });
}

function markDirty(
  dirtyFormationIds: ReadonlySet<FormationId>,
  formationId: FormationId,
): ReadonlySet<FormationId> {
  return new Set([...dirtyFormationIds, formationId]);
}

function assertNormalizedPoint(position: NormalizedPoint): void {
  if (
    !isNormalizedCoordinate(position.x) ||
    !isNormalizedCoordinate(position.y)
  ) {
    throw new RangeError("Dancer position must be within the stage boundary.");
  }
}

function pointsAreEqual(
  first: NormalizedPoint,
  second: NormalizedPoint,
): boolean {
  return first.x === second.x && first.y === second.y;
}

export function createFormationEditorState(
  formations: readonly [Formation, Formation],
): FormationEditorState {
  if (formations[0].id === formations[1].id) {
    throw new Error("Formation A and Formation B must have distinct IDs.");
  }

  return {
    formations,
    activeFormationId: formations[0].id,
    dirtyFormationIds: new Set(),
    undoablePositionChange: null,
    redoablePositionChange: null,
    undoableRecommendationChange: null,
    redoableRecommendationChange: null,
  };
}

export function getActiveFormation(state: FormationEditorState): Formation {
  return findFormation(state.formations, state.activeFormationId);
}

export function switchFormation(
  state: FormationEditorState,
  formationId: FormationId,
): FormationEditorState {
  findFormation(state.formations, formationId);

  if (state.activeFormationId === formationId) {
    return state;
  }

  return {
    ...state,
    activeFormationId: formationId,
  };
}

export function moveDancer(
  state: FormationEditorState,
  dancerId: DancerId,
  position: NormalizedPoint,
): FormationEditorState {
  assertNormalizedPoint(position);
  const activeFormation = getActiveFormation(state);
  const currentPosition = activeFormation.positions[dancerId];

  if (currentPosition === undefined) {
    throw new Error(
      `Unknown dancer "${dancerId}" in formation "${activeFormation.id}".`,
    );
  }

  if (pointsAreEqual(currentPosition, position)) {
    return state;
  }

  const change: PositionChange = {
    formationId: activeFormation.id,
    dancerId,
    before: { x: currentPosition.x, y: currentPosition.y },
    after: { ...position },
  };

  return {
    ...state,
    formations: updateFormationPosition(
      state.formations,
      activeFormation.id,
      dancerId,
      position,
    ),
    dirtyFormationIds: markDirty(state.dirtyFormationIds, activeFormation.id),
    undoablePositionChange: change,
    redoablePositionChange: null,
    undoableRecommendationChange: null,
    redoableRecommendationChange: null,
  };
}

export function copyFormationAToB(
  state: FormationEditorState,
): FormationEditorState {
  const [formationA, formationB] = state.formations;
  const updatedFormationB: Formation = {
    ...formationB,
    positions: clonePositions(formationA.positions),
  };

  return {
    ...state,
    formations: [formationA, updatedFormationB],
    activeFormationId: formationB.id,
    dirtyFormationIds: markDirty(state.dirtyFormationIds, updatedFormationB.id),
    undoablePositionChange: null,
    redoablePositionChange: null,
    undoableRecommendationChange: null,
    redoableRecommendationChange: null,
  };
}

export function resetFormationPositions(
  state: FormationEditorState,
  baselineFormation: Formation,
): FormationEditorState {
  findFormation(state.formations, baselineFormation.id);

  return {
    ...state,
    formations: updateFormation(
      state.formations,
      baselineFormation.id,
      (currentFormation) => ({
        ...currentFormation,
        positions: clonePositions(baselineFormation.positions),
      }),
    ),
    dirtyFormationIds: markDirty(state.dirtyFormationIds, baselineFormation.id),
    undoablePositionChange: null,
    redoablePositionChange: null,
    undoableRecommendationChange: null,
    redoableRecommendationChange: null,
  };
}

export function renameFormation(
  state: FormationEditorState,
  formationId: FormationId,
  name: string,
): FormationEditorState {
  const normalizedName = name.trim();

  if (normalizedName.length === 0) {
    throw new Error("Formation name cannot be empty.");
  }

  const currentFormation = findFormation(state.formations, formationId);
  if (currentFormation.name === normalizedName) {
    return state;
  }

  return {
    ...state,
    formations: updateFormation(state.formations, formationId, (formation) => ({
      ...formation,
      name: normalizedName,
    })),
    dirtyFormationIds: markDirty(state.dirtyFormationIds, formationId),
  };
}

export function undoPositionChange(
  state: FormationEditorState,
): FormationEditorState {
  const change = state.undoablePositionChange;

  if (change === null) {
    return state;
  }

  return {
    ...state,
    formations: updateFormationPosition(
      state.formations,
      change.formationId,
      change.dancerId,
      change.before,
    ),
    activeFormationId: change.formationId,
    dirtyFormationIds: markDirty(state.dirtyFormationIds, change.formationId),
    undoablePositionChange: null,
    redoablePositionChange: change,
  };
}

export function redoPositionChange(
  state: FormationEditorState,
): FormationEditorState {
  const change = state.redoablePositionChange;

  if (change === null) {
    return state;
  }

  return {
    ...state,
    formations: updateFormationPosition(
      state.formations,
      change.formationId,
      change.dancerId,
      change.after,
    ),
    activeFormationId: change.formationId,
    dirtyFormationIds: markDirty(state.dirtyFormationIds, change.formationId),
    undoablePositionChange: change,
    redoablePositionChange: null,
  };
}

function applyRecommendationChanges(
  formation: Formation,
  recommendation: Recommendation,
  direction: "after" | "before",
): Formation {
  if (formation.id !== recommendation.targetFormationId) {
    throw new Error(
      `Recommendation targets formation "${recommendation.targetFormationId}", not "${formation.id}".`,
    );
  }

  const positions = { ...formation.positions };

  for (const change of recommendation.proposedChanges) {
    const currentPosition = positions[change.dancerId];
    if (currentPosition === undefined) {
      throw new Error(
        `Recommendation references unknown dancer "${change.dancerId}".`,
      );
    }

    const expected = direction === "after" ? change.from : change.to;
    const replacement = direction === "after" ? change.to : change.from;
    if (!pointsAreEqual(currentPosition, expected)) {
      throw new Error(
        `Recommendation is stale for dancer "${change.dancerId}".`,
      );
    }

    positions[change.dancerId] = {
      dancerId: change.dancerId,
      ...replacement,
    };
  }

  return {
    ...formation,
    positions,
  };
}

export function previewTargetSwapRecommendation(
  formationB: Formation,
  recommendation: Recommendation,
): Formation {
  return applyRecommendationChanges(formationB, recommendation, "after");
}

export function acceptTargetSwapRecommendation(
  state: FormationEditorState,
  recommendation: Recommendation,
): FormationEditorState {
  const targetFormation = findFormation(
    state.formations,
    recommendation.targetFormationId,
  );
  const updatedTargetFormation = previewTargetSwapRecommendation(
    targetFormation,
    recommendation,
  );
  const change: AcceptedRecommendationChange = { recommendation };

  return {
    ...state,
    formations: updateFormation(
      state.formations,
      targetFormation.id,
      () => updatedTargetFormation,
    ),
    activeFormationId: targetFormation.id,
    dirtyFormationIds: markDirty(state.dirtyFormationIds, targetFormation.id),
    undoablePositionChange: null,
    redoablePositionChange: null,
    undoableRecommendationChange: change,
    redoableRecommendationChange: null,
  };
}

export function undoAcceptedRecommendation(
  state: FormationEditorState,
): FormationEditorState {
  const change = state.undoableRecommendationChange;
  if (change === null) {
    return state;
  }

  const targetFormation = findFormation(
    state.formations,
    change.recommendation.targetFormationId,
  );
  const restoredTargetFormation = applyRecommendationChanges(
    targetFormation,
    change.recommendation,
    "before",
  );

  return {
    ...state,
    formations: updateFormation(
      state.formations,
      targetFormation.id,
      () => restoredTargetFormation,
    ),
    activeFormationId: targetFormation.id,
    dirtyFormationIds: markDirty(state.dirtyFormationIds, targetFormation.id),
    undoableRecommendationChange: null,
    redoableRecommendationChange: change,
  };
}

export function redoAcceptedRecommendation(
  state: FormationEditorState,
): FormationEditorState {
  const change = state.redoableRecommendationChange;
  if (change === null) {
    return state;
  }

  const targetFormation = findFormation(
    state.formations,
    change.recommendation.targetFormationId,
  );
  const updatedTargetFormation = applyRecommendationChanges(
    targetFormation,
    change.recommendation,
    "after",
  );

  return {
    ...state,
    formations: updateFormation(
      state.formations,
      targetFormation.id,
      () => updatedTargetFormation,
    ),
    activeFormationId: targetFormation.id,
    dirtyFormationIds: markDirty(state.dirtyFormationIds, targetFormation.id),
    undoableRecommendationChange: change,
    redoableRecommendationChange: null,
  };
}
