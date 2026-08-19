import { describe, expect, it } from "vitest";

import { sampleProject } from "./sample-project";
import type { Formation, Project } from "./types";
import {
  isNormalizedCoordinate,
  validateFormation,
  validateProject,
  validateStage,
} from "./validation";

function withProject(overrides: Partial<Project>): Project {
  return {
    ...sampleProject,
    ...overrides,
  };
}

function expectInvalid(
  project: unknown,
  expectedPath: string,
  expectedCode?: string,
): void {
  const result = validateProject(project);

  expect(result.valid).toBe(false);
  if (result.valid) {
    throw new Error("Expected project validation to fail.");
  }

  expect(result.errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: expectedPath,
        ...(expectedCode ? { code: expectedCode } : {}),
      }),
    ]),
  );
}

describe("domain validation", () => {
  it("accepts the eight-dancer sample project", () => {
    const result = validateProject(sampleProject);

    expect(result).toEqual({
      valid: true,
      value: sampleProject,
      errors: [],
    });
  });

  it("accepts normalized coordinate boundaries", () => {
    expect(isNormalizedCoordinate(0)).toBe(true);
    expect(isNormalizedCoordinate(1)).toBe(true);
    expect(isNormalizedCoordinate(-0.001)).toBe(false);
    expect(isNormalizedCoordinate(1.001)).toBe(false);
    expect(isNormalizedCoordinate(Number.NaN)).toBe(false);
  });

  it("validates stages independently", () => {
    expect(validateStage({ width: 36, depth: 24, unit: "feet" }).valid).toBe(
      true,
    );
    expect(validateStage({ width: 0, depth: 24, unit: "feet" }).valid).toBe(
      false,
    );
  });

  it("validates formations independently", () => {
    expect(
      validateFormation(sampleProject.formations[0], sampleProject.dancers)
        .valid,
    ).toBe(true);
  });

  it("rejects duplicate dancer IDs", () => {
    const dancers = sampleProject.dancers.map((dancer, index) =>
      index === 1 ? { ...dancer, id: "dancer-01" } : dancer,
    );

    expectInvalid(withProject({ dancers }), "dancers[1].id", "duplicate");
  });

  it("rejects rosters outside the MVP size", () => {
    expectInvalid(
      withProject({ dancers: sampleProject.dancers.slice(0, 5) }),
      "dancers",
      "wrong_count",
    );
  });

  it("rejects a formation missing a dancer position", () => {
    const { "dancer-08": omitted, ...positions } =
      sampleProject.formations[0].positions;
    expect(omitted).toBeDefined();

    const incompleteFormation: Formation = {
      ...sampleProject.formations[0],
      positions,
    };

    expectInvalid(
      withProject({
        formations: [incompleteFormation, sampleProject.formations[1]],
      }),
      "formations[0].positions.dancer-08",
      "required",
    );
  });

  it("rejects a position for an unknown dancer", () => {
    const formation: Formation = {
      ...sampleProject.formations[0],
      positions: {
        ...sampleProject.formations[0].positions,
        "dancer-99": { dancerId: "dancer-99", x: 0.5, y: 0.5 },
      },
    };

    expectInvalid(
      withProject({ formations: [formation, sampleProject.formations[1]] }),
      "formations[0].positions.dancer-99",
      "unknown_reference",
    );
  });

  it("rejects coordinates outside the normalized range", () => {
    const formation: Formation = {
      ...sampleProject.formations[0],
      positions: {
        ...sampleProject.formations[0].positions,
        "dancer-01": {
          ...sampleProject.formations[0].positions["dancer-01"],
          x: 1.01,
        },
      },
    };

    expectInvalid(
      withProject({ formations: [formation, sampleProject.formations[1]] }),
      "formations[0].positions.dancer-01.x",
      "out_of_range",
    );
  });

  it("rejects non-positive stage dimensions", () => {
    expectInvalid(
      withProject({
        stage: { ...sampleProject.stage, width: 0 },
      }),
      "stage.width",
      "out_of_range",
    );
  });

  it("rejects non-positive transition durations", () => {
    expectInvalid(
      withProject({
        transition: { ...sampleProject.transition, durationMs: 0 },
      }),
      "transition.durationMs",
      "out_of_range",
    );
  });

  it("rejects locks for unknown dancers", () => {
    expectInvalid(
      withProject({ lockedDancerIds: ["dancer-99"] }),
      "lockedDancerIds[0]",
      "unknown_reference",
    );
  });
});
