import type {
  Dancer,
  DancerId,
  Formation,
  Project,
  Stage,
  StageUnit,
} from "./types";

export type ValidationIssueCode =
  | "duplicate"
  | "invalid_reference"
  | "invalid_type"
  | "out_of_range"
  | "required"
  | "unknown_reference"
  | "wrong_count";

export interface ValidationIssue {
  readonly code: ValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export type ValidationResult<T> =
  | {
      readonly valid: true;
      readonly value: T;
      readonly errors: readonly [];
    }
  | {
      readonly valid: false;
      readonly errors: readonly ValidationIssue[];
    };

const MIN_DANCERS = 6;
const MAX_DANCERS = 16;
const STAGE_UNITS: readonly StageUnit[] = ["feet", "meters"];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isNormalizedCoordinate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function addIssue(
  errors: ValidationIssue[],
  code: ValidationIssueCode,
  path: string,
  message: string,
): void {
  errors.push({ code, path, message });
}

function collectStageIssues(
  input: unknown,
  path: string,
  errors: ValidationIssue[],
): void {
  if (!isRecord(input)) {
    addIssue(errors, "invalid_type", path, "Stage must be an object.");
    return;
  }

  if (!isPositiveFiniteNumber(input.width)) {
    addIssue(
      errors,
      "out_of_range",
      `${path}.width`,
      "Stage width must be a positive finite number.",
    );
  }

  if (!isPositiveFiniteNumber(input.depth)) {
    addIssue(
      errors,
      "out_of_range",
      `${path}.depth`,
      "Stage depth must be a positive finite number.",
    );
  }

  if (
    typeof input.unit !== "string" ||
    !STAGE_UNITS.includes(input.unit as StageUnit)
  ) {
    addIssue(
      errors,
      "invalid_type",
      `${path}.unit`,
      'Stage unit must be either "feet" or "meters".',
    );
  }
}

export function validateStage(input: unknown): ValidationResult<Stage> {
  const errors: ValidationIssue[] = [];
  collectStageIssues(input, "stage", errors);

  return errors.length === 0
    ? { valid: true, value: input as Stage, errors: [] }
    : { valid: false, errors };
}

function collectDancerIssues(
  input: unknown,
  index: number,
  errors: ValidationIssue[],
): Dancer | null {
  const path = `dancers[${index}]`;

  if (!isRecord(input)) {
    addIssue(errors, "invalid_type", path, "Dancer must be an object.");
    return null;
  }

  if (!isNonEmptyString(input.id)) {
    addIssue(errors, "required", `${path}.id`, "Dancer ID is required.");
  }

  if (!isNonEmptyString(input.label)) {
    addIssue(errors, "required", `${path}.label`, "Dancer label is required.");
  }

  return isNonEmptyString(input.id) && isNonEmptyString(input.label)
    ? { id: input.id, label: input.label }
    : null;
}

function collectPositionIssues(
  input: unknown,
  expectedDancerId: DancerId,
  path: string,
  errors: ValidationIssue[],
): void {
  if (!isRecord(input)) {
    addIssue(
      errors,
      "invalid_type",
      path,
      "Dancer position must be an object.",
    );
    return;
  }

  if (input.dancerId !== expectedDancerId) {
    addIssue(
      errors,
      "invalid_reference",
      `${path}.dancerId`,
      `Position dancer ID must match its "${expectedDancerId}" key.`,
    );
  }

  if (!isNormalizedCoordinate(input.x)) {
    addIssue(
      errors,
      "out_of_range",
      `${path}.x`,
      "X coordinate must be a finite number from 0 to 1.",
    );
  }

  if (!isNormalizedCoordinate(input.y)) {
    addIssue(
      errors,
      "out_of_range",
      `${path}.y`,
      "Y coordinate must be a finite number from 0 to 1.",
    );
  }
}

function collectFormationIssues(
  input: unknown,
  dancerIds: ReadonlySet<DancerId>,
  path: string,
  errors: ValidationIssue[],
): void {
  if (!isRecord(input)) {
    addIssue(errors, "invalid_type", path, "Formation must be an object.");
    return;
  }

  if (!isNonEmptyString(input.id)) {
    addIssue(errors, "required", `${path}.id`, "Formation ID is required.");
  }

  if (!isNonEmptyString(input.name)) {
    addIssue(errors, "required", `${path}.name`, "Formation name is required.");
  }

  if (!isRecord(input.positions)) {
    addIssue(
      errors,
      "invalid_type",
      `${path}.positions`,
      "Formation positions must be an object keyed by dancer ID.",
    );
    return;
  }

  const positionIds = Object.keys(input.positions).sort();
  const expectedIds = [...dancerIds].sort();

  for (const dancerId of expectedIds) {
    if (!Object.hasOwn(input.positions, dancerId)) {
      addIssue(
        errors,
        "required",
        `${path}.positions.${dancerId}`,
        `Formation is missing a position for dancer "${dancerId}".`,
      );
      continue;
    }

    collectPositionIssues(
      input.positions[dancerId],
      dancerId,
      `${path}.positions.${dancerId}`,
      errors,
    );
  }

  for (const dancerId of positionIds) {
    if (!dancerIds.has(dancerId)) {
      addIssue(
        errors,
        "unknown_reference",
        `${path}.positions.${dancerId}`,
        `Formation contains a position for unknown dancer "${dancerId}".`,
      );
    }
  }
}

export function validateFormation(
  input: unknown,
  dancers: readonly Dancer[],
): ValidationResult<Formation> {
  const errors: ValidationIssue[] = [];
  collectFormationIssues(
    input,
    new Set(dancers.map(({ id }) => id)),
    "formation",
    errors,
  );

  return errors.length === 0
    ? { valid: true, value: input as Formation, errors: [] }
    : { valid: false, errors };
}

function collectTransitionIssues(
  input: unknown,
  formationIds: ReadonlySet<string>,
  errors: ValidationIssue[],
): void {
  const path = "transition";

  if (!isRecord(input)) {
    addIssue(errors, "invalid_type", path, "Transition must be an object.");
    return;
  }

  if (!isNonEmptyString(input.id)) {
    addIssue(errors, "required", `${path}.id`, "Transition ID is required.");
  }

  for (const key of ["fromFormationId", "toFormationId"] as const) {
    const value = input[key];
    if (!isNonEmptyString(value)) {
      addIssue(errors, "required", `${path}.${key}`, `${key} is required.`);
    } else if (!formationIds.has(value)) {
      addIssue(
        errors,
        "unknown_reference",
        `${path}.${key}`,
        `Transition references unknown formation "${value}".`,
      );
    }
  }

  if (
    isNonEmptyString(input.fromFormationId) &&
    input.fromFormationId === input.toFormationId
  ) {
    addIssue(
      errors,
      "invalid_reference",
      path,
      "Transition start and target formations must be different.",
    );
  }

  if (
    typeof input.durationMs !== "number" ||
    !Number.isInteger(input.durationMs) ||
    input.durationMs <= 0
  ) {
    addIssue(
      errors,
      "out_of_range",
      `${path}.durationMs`,
      "Transition duration must be a positive integer in milliseconds.",
    );
  }
}

function collectLockIssues(
  input: unknown,
  dancerIds: ReadonlySet<DancerId>,
  errors: ValidationIssue[],
): void {
  if (!Array.isArray(input)) {
    addIssue(
      errors,
      "invalid_type",
      "lockedDancerIds",
      "Locked dancer IDs must be an array.",
    );
    return;
  }

  const seen = new Set<string>();

  input.forEach((value, index) => {
    const path = `lockedDancerIds[${index}]`;
    if (!isNonEmptyString(value)) {
      addIssue(errors, "invalid_type", path, "Locked dancer ID is required.");
      return;
    }

    if (seen.has(value)) {
      addIssue(
        errors,
        "duplicate",
        path,
        `Locked dancer "${value}" is listed more than once.`,
      );
    }
    seen.add(value);

    if (!dancerIds.has(value)) {
      addIssue(
        errors,
        "unknown_reference",
        path,
        `Lock references unknown dancer "${value}".`,
      );
    }
  });
}

export function validateProject(input: unknown): ValidationResult<Project> {
  const errors: ValidationIssue[] = [];

  if (!isRecord(input)) {
    return {
      valid: false,
      errors: [
        {
          code: "invalid_type",
          path: "project",
          message: "Project must be an object.",
        },
      ],
    };
  }

  if (!isNonEmptyString(input.id)) {
    addIssue(errors, "required", "id", "Project ID is required.");
  }

  if (!isNonEmptyString(input.name)) {
    addIssue(errors, "required", "name", "Project name is required.");
  }

  collectStageIssues(input.stage, "stage", errors);

  const validDancers: Dancer[] = [];
  if (!Array.isArray(input.dancers)) {
    addIssue(
      errors,
      "invalid_type",
      "dancers",
      "Project dancers must be an array.",
    );
  } else {
    if (
      input.dancers.length < MIN_DANCERS ||
      input.dancers.length > MAX_DANCERS
    ) {
      addIssue(
        errors,
        "wrong_count",
        "dancers",
        `Project must contain between ${MIN_DANCERS} and ${MAX_DANCERS} dancers.`,
      );
    }

    input.dancers.forEach((dancer, index) => {
      const validDancer = collectDancerIssues(dancer, index, errors);
      if (validDancer) {
        validDancers.push(validDancer);
      }
    });
  }

  const dancerIds = new Set<DancerId>();
  const dancerLabels = new Set<string>();
  validDancers.forEach((dancer, index) => {
    if (dancerIds.has(dancer.id)) {
      addIssue(
        errors,
        "duplicate",
        `dancers[${index}].id`,
        `Dancer ID "${dancer.id}" must be unique.`,
      );
    }
    dancerIds.add(dancer.id);

    const normalizedLabel = dancer.label.trim();
    if (dancerLabels.has(normalizedLabel)) {
      addIssue(
        errors,
        "duplicate",
        `dancers[${index}].label`,
        `Dancer label "${normalizedLabel}" must be unique after trimming.`,
      );
    }
    dancerLabels.add(normalizedLabel);
  });

  const formationIds = new Set<string>();
  if (!Array.isArray(input.formations)) {
    addIssue(
      errors,
      "invalid_type",
      "formations",
      "Project formations must be an array.",
    );
  } else {
    if (input.formations.length !== 2) {
      addIssue(
        errors,
        "wrong_count",
        "formations",
        "The MVP project must contain exactly two formations.",
      );
    }

    input.formations.forEach((formation, index) => {
      const path = `formations[${index}]`;
      collectFormationIssues(formation, dancerIds, path, errors);

      if (isRecord(formation) && isNonEmptyString(formation.id)) {
        if (formationIds.has(formation.id)) {
          addIssue(
            errors,
            "duplicate",
            `${path}.id`,
            `Formation ID "${formation.id}" must be unique.`,
          );
        }
        formationIds.add(formation.id);
      }
    });
  }

  collectTransitionIssues(input.transition, formationIds, errors);
  collectLockIssues(input.lockedDancerIds, dancerIds, errors);

  if (!isPositiveFiniteNumber(input.safetyThreshold)) {
    addIssue(
      errors,
      "out_of_range",
      "safetyThreshold",
      "Safety threshold must be a positive finite number.",
    );
  } else if (
    isRecord(input.stage) &&
    isPositiveFiniteNumber(input.stage.width) &&
    isPositiveFiniteNumber(input.stage.depth) &&
    input.safetyThreshold > Math.hypot(input.stage.width, input.stage.depth)
  ) {
    addIssue(
      errors,
      "out_of_range",
      "safetyThreshold",
      "Safety threshold cannot exceed the stage diagonal.",
    );
  }

  return errors.length === 0
    ? { valid: true, value: input as unknown as Project, errors: [] }
    : { valid: false, errors };
}
