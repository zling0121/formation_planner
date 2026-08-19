import { describe, expect, it } from "vitest";

import { sampleProject } from "./sample-project";
import {
  loadProjectFromStorage,
  parseStoredProject,
  PROJECT_STORAGE_KEY,
  PROJECT_STORAGE_VERSION,
  saveProjectToStorage,
  serializeStoredProject,
} from "./project-storage";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const savedAt = "2026-07-30T12:00:00.000Z";

describe("project storage", () => {
  it("saves a versioned project envelope", () => {
    const storage = new MemoryStorage();

    saveProjectToStorage(storage, sampleProject, savedAt);

    const serialized = storage.getItem(PROJECT_STORAGE_KEY);
    expect(serialized).not.toBeNull();
    expect(JSON.parse(serialized ?? "")).toMatchObject({
      version: PROJECT_STORAGE_VERSION,
      savedAt,
      project: { id: sampleProject.id },
    });
  });

  it("restores a valid saved project", () => {
    const storage = new MemoryStorage();
    saveProjectToStorage(storage, sampleProject, savedAt);

    const result = loadProjectFromStorage(storage);

    expect(result).toEqual({
      status: "loaded",
      envelope: {
        version: PROJECT_STORAGE_VERSION,
        savedAt,
        project: sampleProject,
      },
      migratedFromVersion: null,
    });
  });

  it("migrates version zero projects by adding an empty lock list", () => {
    const { lockedDancerIds: omitted, ...legacyProject } = sampleProject;
    expect(omitted).toEqual(["dancer-01"]);
    const result = parseStoredProject(
      JSON.stringify({
        version: 0,
        savedAt,
        project: legacyProject,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected the legacy project to migrate.");
    }
    expect(result.migratedFromVersion).toBe(0);
    expect(result.envelope.version).toBe(PROJECT_STORAGE_VERSION);
    expect(result.envelope.project.lockedDancerIds).toEqual([]);
  });

  it("reports malformed JSON without replacing or discarding it", () => {
    const storage = new MemoryStorage();
    storage.setItem(PROJECT_STORAGE_KEY, "{not-json");

    const result = loadProjectFromStorage(storage);

    expect(result).toMatchObject({
      status: "invalid",
      message: expect.stringContaining("not valid JSON"),
    });
    expect(storage.getItem(PROJECT_STORAGE_KEY)).toBe("{not-json");
  });

  it("reports project validation failures with their issue paths", () => {
    const invalidProject = {
      ...sampleProject,
      formations: [
        {
          ...sampleProject.formations[0],
          positions: {
            ...sampleProject.formations[0].positions,
            "dancer-01": {
              ...sampleProject.formations[0].positions["dancer-01"],
              x: 2,
            },
          },
        },
        sampleProject.formations[1],
      ],
    };

    const result = parseStoredProject(
      JSON.stringify({
        version: PROJECT_STORAGE_VERSION,
        savedAt,
        project: invalidProject,
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected invalid project data to be rejected.");
    }
    expect(result.message).toContain("failed FormationFlow project validation");
    expect(result.validationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "formations[0].positions.dancer-01.x",
        }),
      ]),
    );
  });

  it("rejects unsupported storage versions", () => {
    const result = parseStoredProject(
      JSON.stringify({
        version: 99,
        savedAt,
        project: sampleProject,
      }),
    );

    expect(result).toEqual({
      ok: false,
      message: 'Saved project version "99" is not supported.',
      validationIssues: [],
    });
  });

  it("refuses to serialize invalid project data", () => {
    const invalidProject = {
      ...sampleProject,
      lockedDancerIds: ["unknown-dancer"],
    };

    expect(() =>
      serializeStoredProject(invalidProject, { savedAt }),
    ).toThrowError(/Cannot save an invalid project/);
  });
});
