import type { Project } from "./types";
import { validateProject, type ValidationIssue } from "./validation";

export const PROJECT_STORAGE_KEY = "formationflow.project";
export const PROJECT_STORAGE_VERSION = 1;

interface ProjectStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface StoredProjectEnvelope {
  readonly version: typeof PROJECT_STORAGE_VERSION;
  readonly savedAt: string;
  readonly project: Project;
}

export type StoredProjectParseResult =
  | {
      readonly ok: true;
      readonly envelope: StoredProjectEnvelope;
      readonly migratedFromVersion: 0 | null;
    }
  | {
      readonly ok: false;
      readonly message: string;
      readonly validationIssues: readonly ValidationIssue[];
    };

export type StoredProjectLoadResult =
  | { readonly status: "missing" }
  | {
      readonly status: "loaded";
      readonly envelope: StoredProjectEnvelope;
      readonly migratedFromVersion: 0 | null;
    }
  | {
      readonly status: "invalid";
      readonly message: string;
      readonly validationIssues: readonly ValidationIssue[];
    };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidSavedAt(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function invalidResult(
  message: string,
  validationIssues: readonly ValidationIssue[] = [],
): StoredProjectParseResult {
  return { ok: false, message, validationIssues };
}

function migrateVersionZeroProject(project: unknown): unknown {
  if (!isRecord(project)) {
    return project;
  }

  return Object.hasOwn(project, "lockedDancerIds")
    ? project
    : { ...project, lockedDancerIds: [] };
}

export function parseStoredProject(
  serialized: string,
): StoredProjectParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    return invalidResult(`Saved project is not valid JSON.${detail}`);
  }

  if (!isRecord(parsed)) {
    return invalidResult("Saved project envelope must be a JSON object.");
  }

  if (parsed.version !== 0 && parsed.version !== PROJECT_STORAGE_VERSION) {
    return invalidResult(
      `Saved project version "${String(parsed.version)}" is not supported.`,
    );
  }

  if (!isValidSavedAt(parsed.savedAt)) {
    return invalidResult(
      'Saved project envelope requires a valid ISO "savedAt" timestamp.',
    );
  }

  const migratedFromVersion = parsed.version === 0 ? 0 : null;
  const candidateProject =
    parsed.version === 0
      ? migrateVersionZeroProject(parsed.project)
      : parsed.project;
  const validation = validateProject(candidateProject);

  if (!validation.valid) {
    return invalidResult(
      "Saved project failed FormationFlow project validation.",
      validation.errors,
    );
  }

  return {
    ok: true,
    envelope: {
      version: PROJECT_STORAGE_VERSION,
      savedAt: parsed.savedAt,
      project: validation.value,
    },
    migratedFromVersion,
  };
}

export function serializeStoredProject(
  project: Project,
  options: {
    readonly pretty?: boolean;
    readonly savedAt?: string;
  } = {},
): string {
  const validation = validateProject(project);
  if (!validation.valid) {
    const details = validation.errors
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("; ");
    throw new Error(`Cannot save an invalid project. ${details}`);
  }

  const savedAt = options.savedAt ?? new Date().toISOString();
  if (!isValidSavedAt(savedAt)) {
    throw new RangeError("Saved project timestamp must be a valid ISO date.");
  }

  const envelope: StoredProjectEnvelope = {
    version: PROJECT_STORAGE_VERSION,
    savedAt,
    project: validation.value,
  };

  return JSON.stringify(envelope, null, options.pretty ? 2 : undefined);
}

export function loadProjectFromStorage(
  storage: ProjectStorageAdapter,
): StoredProjectLoadResult {
  let serialized: string | null;

  try {
    serialized = storage.getItem(PROJECT_STORAGE_KEY);
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    return {
      status: "invalid",
      message: `Browser storage could not be read.${detail}`,
      validationIssues: [],
    };
  }

  if (serialized === null) {
    return { status: "missing" };
  }

  const parsed = parseStoredProject(serialized);
  return parsed.ok
    ? {
        status: "loaded",
        envelope: parsed.envelope,
        migratedFromVersion: parsed.migratedFromVersion,
      }
    : {
        status: "invalid",
        message: parsed.message,
        validationIssues: parsed.validationIssues,
      };
}

export function saveProjectToStorage(
  storage: ProjectStorageAdapter,
  project: Project,
  savedAt?: string,
): void {
  storage.setItem(
    PROJECT_STORAGE_KEY,
    serializeStoredProject(project, { savedAt }),
  );
}
