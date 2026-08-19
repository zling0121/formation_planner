import { describe, expect, it } from "vitest";

import { sampleProject } from "./sample-project";
import {
  acceptTargetSwapRecommendation,
  copyFormationAToB,
  createFormationEditorState,
  getActiveFormation,
  moveDancer,
  previewTargetSwapRecommendation,
  redoAcceptedRecommendation,
  redoPositionChange,
  renameFormation,
  resetFormationPositions,
  switchFormation,
  undoAcceptedRecommendation,
  undoPositionChange,
} from "./formation-editor";
import type { Recommendation } from "./types";

const sampleRecommendation: Recommendation = {
  id: "recommendation:test",
  kind: "swap-target-positions",
  transitionId: sampleProject.transition.id,
  targetFormationId: "formation-b",
  dancerIds: ["dancer-02", "dancer-03"],
  proposedChanges: [
    {
      dancerId: "dancer-02",
      from: { x: 0.35, y: 0.4 },
      to: { x: 0.55, y: 0.6 },
    },
    {
      dancerId: "dancer-03",
      from: { x: 0.55, y: 0.6 },
      to: { x: 0.35, y: 0.4 },
    },
  ],
  before: {
    unsafePairCount: 2,
    globalMinimumSeparation: 0,
    totalTravelDistance: 20,
    maximumIndividualTravelDistance: 8,
  },
  after: {
    unsafePairCount: 1,
    globalMinimumSeparation: 2,
    totalTravelDistance: 18,
    maximumIndividualTravelDistance: 7,
  },
  travelDistanceChanges: [
    { dancerId: "dancer-02", before: 4, after: 3, delta: -1 },
    { dancerId: "dancer-03", before: 5, after: 4, delta: -1 },
  ],
  worsenedMetrics: [],
  explanation: "Swap Blair and Casey to reduce modeled safety conflicts.",
};

describe("formation editor", () => {
  it("switches formations without changing either formation", () => {
    const state = createFormationEditorState(sampleProject.formations);
    const switched = switchFormation(state, sampleProject.formations[1].id);

    expect(switched.activeFormationId).toBe("formation-b");
    expect(switched.formations).toBe(state.formations);
    expect(getActiveFormation(switched).name).toBe("Formation B");
  });

  it("preserves independent positions when editing and switching", () => {
    const initialState = createFormationEditorState(sampleProject.formations);
    const originalFormationB = initialState.formations[1];
    const editedA = moveDancer(initialState, "dancer-01", { x: 0.9, y: 0.1 });
    const switchedToB = switchFormation(editedA, "formation-b");

    expect(editedA.formations[0].positions["dancer-01"]).toMatchObject({
      x: 0.9,
      y: 0.1,
    });
    expect(switchedToB.formations[1]).toBe(originalFormationB);
    expect(switchedToB.formations[1].positions["dancer-01"]).toMatchObject({
      x: 0.15,
      y: 0.2,
    });
  });

  it("copies Formation A positions into Formation B without changing A", () => {
    const initialState = createFormationEditorState(sampleProject.formations);
    const editedA = moveDancer(initialState, "dancer-03", { x: 0.91, y: 0.12 });
    const formationABeforeCopy = editedA.formations[0];
    const copied = copyFormationAToB(editedA);

    expect(copied.formations[0]).toBe(formationABeforeCopy);
    expect(copied.formations[1].positions).toEqual(
      copied.formations[0].positions,
    );
    expect(copied.formations[1].positions).not.toBe(
      copied.formations[0].positions,
    );
    expect(copied.activeFormationId).toBe("formation-b");
  });

  it("resets only the selected formation's positions and preserves its name", () => {
    const initialState = createFormationEditorState(sampleProject.formations);
    const renamed = renameFormation(initialState, "formation-a", "Opening");
    const edited = moveDancer(renamed, "dancer-01", { x: 0.9, y: 0.1 });
    const originalFormationB = edited.formations[1];
    const reset = resetFormationPositions(edited, sampleProject.formations[0]);

    expect(reset.formations[0].name).toBe("Opening");
    expect(reset.formations[0].positions).toEqual(
      sampleProject.formations[0].positions,
    );
    expect(reset.formations[1]).toBe(originalFormationB);
    expect(reset.undoablePositionChange).toBeNull();
    expect(reset.redoablePositionChange).toBeNull();
  });

  it("undoes and redoes the most recent position change", () => {
    const initialState = createFormationEditorState(sampleProject.formations);
    const edited = moveDancer(initialState, "dancer-02", { x: 0.72, y: 0.31 });
    const undone = undoPositionChange(edited);
    const redone = redoPositionChange(undone);

    expect(undone.formations[0].positions["dancer-02"]).toEqual(
      sampleProject.formations[0].positions["dancer-02"],
    );
    expect(undone.undoablePositionChange).toBeNull();
    expect(undone.redoablePositionChange).toEqual(
      edited.undoablePositionChange,
    );
    expect(redone.formations[0].positions["dancer-02"]).toMatchObject({
      x: 0.72,
      y: 0.31,
    });
    expect(redone.undoablePositionChange).toEqual(
      edited.undoablePositionChange,
    );
    expect(redone.redoablePositionChange).toBeNull();
  });

  it("keeps only one position change in history", () => {
    const initialState = createFormationEditorState(sampleProject.formations);
    const firstEdit = moveDancer(initialState, "dancer-01", { x: 0.3, y: 0.3 });
    const secondEdit = moveDancer(firstEdit, "dancer-02", { x: 0.7, y: 0.7 });
    const undone = undoPositionChange(secondEdit);

    expect(undone.formations[0].positions["dancer-01"]).toMatchObject({
      x: 0.3,
      y: 0.3,
    });
    expect(undone.formations[0].positions["dancer-02"]).toEqual(
      sampleProject.formations[0].positions["dancer-02"],
    );
  });

  it("previews a target swap without mutating Formation B", () => {
    const originalFormationB = structuredClone(sampleProject.formations[1]);

    const preview = previewTargetSwapRecommendation(
      sampleProject.formations[1],
      sampleRecommendation,
    );

    expect(preview.positions["dancer-02"]).toMatchObject({
      dancerId: "dancer-02",
      x: 0.55,
      y: 0.6,
    });
    expect(preview.positions["dancer-03"]).toMatchObject({
      dancerId: "dancer-03",
      x: 0.35,
      y: 0.4,
    });
    expect(sampleProject.formations[1]).toEqual(originalFormationB);
  });

  it("accepts one recommendation and supports undo and redo", () => {
    const initialState = createFormationEditorState(sampleProject.formations);
    const accepted = acceptTargetSwapRecommendation(
      initialState,
      sampleRecommendation,
    );
    const undone = undoAcceptedRecommendation(accepted);
    const redone = redoAcceptedRecommendation(undone);

    expect(accepted.formations[0]).toBe(initialState.formations[0]);
    expect(accepted.formations[1].positions["dancer-02"]).toMatchObject({
      x: 0.55,
      y: 0.6,
    });
    expect(accepted.undoablePositionChange).toBeNull();
    expect(accepted.undoableRecommendationChange).toEqual({
      recommendation: sampleRecommendation,
    });

    expect(undone.formations[1].positions).toEqual(
      initialState.formations[1].positions,
    );
    expect(undone.undoableRecommendationChange).toBeNull();
    expect(undone.redoableRecommendationChange).toEqual({
      recommendation: sampleRecommendation,
    });

    expect(redone.formations[1].positions).toEqual(
      accepted.formations[1].positions,
    );
    expect(redone.undoableRecommendationChange).toEqual({
      recommendation: sampleRecommendation,
    });
    expect(redone.redoableRecommendationChange).toBeNull();
  });

  it("replaces accepted-recommendation history after a manual move", () => {
    const initialState = createFormationEditorState(sampleProject.formations);
    const accepted = acceptTargetSwapRecommendation(
      initialState,
      sampleRecommendation,
    );
    const moved = moveDancer(accepted, "dancer-01", { x: 0.21, y: 0.25 });

    expect(moved.undoablePositionChange?.dancerId).toBe("dancer-01");
    expect(moved.undoableRecommendationChange).toBeNull();
    expect(moved.redoableRecommendationChange).toBeNull();
  });
});
