"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

import { StageEditor } from "../components/editor/stage-editor";
import {
  loadProjectFromStorage,
  parseStoredProject,
  sampleProject,
  saveProjectToStorage,
  serializeStoredProject,
  type DancerId,
  type Formation,
  type Project,
  type ValidationIssue,
} from "../src/domain";

function cloneDemoProject(): Project {
  return structuredClone(sampleProject);
}

function formatStorageError(
  message: string,
  validationIssues: readonly ValidationIssue[],
): string {
  if (validationIssues.length === 0) {
    return message;
  }

  const details = validationIssues
    .slice(0, 3)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join(" ");
  const remaining =
    validationIssues.length > 3
      ? ` ${validationIssues.length - 3} more validation issue(s).`
      : "";
  return `${message} ${details}${remaining}`;
}

export default function Home() {
  const [project, setProject] = useState<Project>(cloneDemoProject);
  const [editorInstance, setEditorInstance] = useState(0);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageMessage, setStorageMessage] = useState(
    "Checking for a saved project…",
  );

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const result = loadProjectFromStorage(window.localStorage);

      if (result.status === "invalid") {
        setStorageError(
          formatStorageError(result.message, result.validationIssues),
        );
        setStorageMessage("Saved project needs attention");
        return;
      }

      if (result.status === "loaded") {
        setProject(result.envelope.project);
        setEditorInstance((current) => current + 1);
        setStorageMessage(
          result.migratedFromVersion === null
            ? "Restored saved project"
            : `Migrated saved project from version ${result.migratedFromVersion}`,
        );
      } else {
        setStorageMessage("Demo project ready");
      }

      setPersistenceReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!persistenceReady) {
      return;
    }

    try {
      saveProjectToStorage(window.localStorage, project);
      queueMicrotask(() => {
        setStorageError(null);
        setStorageMessage("Saved locally");
      });
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Unknown browser error.";
      queueMicrotask(() => {
        setPersistenceReady(false);
        setStorageError(`Project could not be saved. ${detail}`);
        setStorageMessage("Local save failed");
      });
    }
  }, [persistenceReady, project]);

  const lockedDancers = useMemo(
    () => new Set(project.lockedDancerIds),
    [project.lockedDancerIds],
  );

  const toggleDancerLock = useCallback((dancerId: DancerId): void => {
    setProject((currentProject) => {
      const isLocked = currentProject.lockedDancerIds.includes(dancerId);
      return {
        ...currentProject,
        lockedDancerIds: isLocked
          ? currentProject.lockedDancerIds.filter(
              (lockedDancerId) => lockedDancerId !== dancerId,
            )
          : [...currentProject.lockedDancerIds, dancerId],
      };
    });
  }, []);

  const handleFormationsChange = useCallback(
    (formations: readonly [Formation, Formation]): void => {
      setProject((currentProject) => ({
        ...currentProject,
        formations,
      }));
    },
    [],
  );

  const handleDurationChange = useCallback((durationMs: number): void => {
    setProject((currentProject) => ({
      ...currentProject,
      transition: {
        ...currentProject.transition,
        durationMs,
      },
    }));
  }, []);

  const handleResetDemo = useCallback((): void => {
    const confirmed = window.confirm(
      "Reset the current project to the original eight-dancer demo? This replaces the locally saved project.",
    );
    if (!confirmed) {
      return;
    }

    const demoProject = cloneDemoProject();
    try {
      saveProjectToStorage(window.localStorage, demoProject);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Unknown browser error.";
      setStorageError(`Demo project could not be saved. ${detail}`);
      setStorageMessage("Local reset failed");
      return;
    }

    setProject(demoProject);
    setEditorInstance((current) => current + 1);
    setPersistenceReady(true);
    setStorageError(null);
    setStorageMessage("Demo project reset and saved locally");
  }, []);

  const handleImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file === undefined) {
        return;
      }

      let serialized: string;
      try {
        serialized = await file.text();
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Unknown file error.";
        setStorageError(`Project file could not be read. ${detail}`);
        return;
      }

      const parsed = parseStoredProject(serialized);
      if (!parsed.ok) {
        setStorageError(
          formatStorageError(parsed.message, parsed.validationIssues),
        );
        setStorageMessage("Imported project is invalid");
        return;
      }

      try {
        saveProjectToStorage(window.localStorage, parsed.envelope.project);
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Unknown browser error.";
        setStorageError(`Imported project could not be saved. ${detail}`);
        setStorageMessage("Import save failed");
        return;
      }

      setProject(parsed.envelope.project);
      setEditorInstance((current) => current + 1);
      setPersistenceReady(true);
      setStorageError(null);
      setStorageMessage(
        parsed.migratedFromVersion === null
          ? "Imported project saved locally"
          : `Imported version ${parsed.migratedFromVersion} project and migrated it`,
      );
    },
    [],
  );

  const handleExport = useCallback((): void => {
    try {
      const serialized = serializeStoredProject(project, { pretty: true });
      const blob = new Blob([serialized], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const download = document.createElement("a");
      download.href = url;
      download.download = `${
        project.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "formationflow-project"
      }.json`;
      document.body.append(download);
      download.click();
      download.remove();
      URL.revokeObjectURL(url);
      setStorageError(null);
      setStorageMessage("Project exported as JSON");
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Unknown export error.";
      setStorageError(`Project could not be exported. ${detail}`);
    }
  }, [project]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <nav
          className="mx-auto flex min-h-16 max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"
          aria-label="Project navigation"
        >
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white"
              aria-hidden="true"
            >
              FF
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                FormationFlow
              </p>
              <h1 className="truncate text-base font-semibold">
                {project.name}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className="hidden items-center gap-2 text-xs text-slate-600 sm:inline-flex"
              role="status"
            >
              <span
                className={`size-2 rounded-full ${
                  storageError === null ? "bg-emerald-500" : "bg-red-500"
                }`}
                aria-hidden="true"
              />
              {storageMessage}
            </span>
            <button
              className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              type="button"
              onClick={handleExport}
            >
              Export JSON
            </button>
            <label className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Import JSON
              <input
                className="sr-only"
                type="file"
                accept="application/json,.json"
                aria-label="Import project JSON"
                onChange={handleImport}
              />
            </label>
            <button
              className="min-h-9 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
              type="button"
              onClick={handleResetDemo}
            >
              Reset demo project
            </button>
          </div>
        </nav>

        {storageError !== null ? (
          <div
            className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:px-6"
            role="alert"
            data-testid="storage-error"
          >
            <div className="mx-auto max-w-[1600px]">
              <p className="font-semibold">Saved project was not changed.</p>
              <p className="mt-1">{storageError}</p>
              <p className="mt-1 text-xs text-red-800">
                Invalid stored or imported data is kept untouched. Import a
                valid FormationFlow JSON file or reset the demo project
                explicitly.
              </p>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-65px)] max-w-[1600px] grid-cols-1 gap-px bg-slate-200 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_300px]">
        <aside
          className="bg-white p-4 sm:p-5"
          aria-labelledby="dancers-heading"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                Roster
              </p>
              <h2
                id="dancers-heading"
                className="mt-1 text-base font-semibold text-slate-900"
              >
                Dancers
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {project.dancers.length}
            </span>
          </div>

          {project.dancers.length > 0 ? (
            <ul className="space-y-1.5" aria-label="Project dancers">
              {project.dancers.map((dancer, index) => {
                const isLocked = lockedDancers.has(dancer.id);

                return (
                  <li
                    key={dancer.id}
                    className="flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2.5 hover:border-slate-200 hover:bg-slate-50"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-800">
                      {dancer.label.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {dancer.label}
                      </span>
                      <span className="block text-xs text-slate-500">
                        Dancer {index + 1}
                      </span>
                    </span>
                    <button
                      className={`min-h-8 rounded-md border px-2 text-[10px] font-bold tracking-wide uppercase ${
                        isLocked
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-800"
                      }`}
                      type="button"
                      aria-label={`${isLocked ? "Unlock" : "Lock"} ${dancer.label}'s Formation B assignment`}
                      aria-pressed={isLocked}
                      onClick={() => toggleDancerLock(dancer.id)}
                    >
                      {isLocked ? "Locked" : "Lock"}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center">
              <p className="text-sm font-medium text-slate-700">
                No dancers yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Dancers will appear here after they are created.
              </p>
            </div>
          )}
        </aside>

        <StageEditor
          key={editorInstance}
          dancers={project.dancers}
          initialFormations={project.formations}
          lockedDancerIds={project.lockedDancerIds}
          stage={project.stage}
          durationMs={project.transition.durationMs}
          safetyThreshold={project.safetyThreshold}
          transitionId={project.transition.id}
          onDurationChange={handleDurationChange}
          onFormationsChange={handleFormationsChange}
        />
      </main>
    </div>
  );
}
