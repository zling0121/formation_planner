import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  PROJECT_STORAGE_KEY,
  sampleProject,
  serializeStoredProject,
} from "../src/domain";

const MIN_MEANINGFUL_SVG_PATH_LENGTH = 1;
const E2E_STORAGE_RESET_MARKER = "formationflow.e2e-storage-reset";

test.beforeEach(async ({ context, page }, testInfo) => {
  await context.clearCookies();
  await page.addInitScript(
    ({ markerKey, storageKey }) => {
      if (window.sessionStorage.getItem(markerKey) !== "complete") {
        window.localStorage.removeItem(storageKey);
        window.sessionStorage.setItem(markerKey, "complete");
      }
    },
    {
      markerKey: `${E2E_STORAGE_RESET_MARKER}:${testInfo.testId}`,
      storageKey: PROJECT_STORAGE_KEY,
    },
  );
  await page.goto("/");
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );

    const databases = await indexedDB.databases();
    await Promise.all(
      databases.map(
        (database) =>
          new Promise<void>((resolve, reject) => {
            if (database.name === undefined) {
              resolve();
              return;
            }

            const request = indexedDB.deleteDatabase(database.name);
            request.onsuccess = () => resolve();
            request.onerror = () =>
              reject(
                request.error ??
                  new Error(`Could not delete IndexedDB "${database.name}".`),
              );
            request.onblocked = () =>
              reject(
                new Error(`Deleting IndexedDB "${database.name}" was blocked.`),
              );
          }),
      ),
    );

    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  });
});

async function dragDancerTo(
  page: Page,
  dancerId: string,
  targetX: number,
  targetY: number,
): Promise<void> {
  const stage = page.getByTestId("stage-editor");
  const stageBounds = await stage.boundingBox();
  if (stageBounds === null) {
    throw new Error("The SVG stage must be visible before dragging a dancer.");
  }

  const marker = page.getByTestId(`dancer-marker-${dancerId}`);
  const currentX = Number(await marker.getAttribute("data-x"));
  const currentY = Number(await marker.getAttribute("data-y"));
  if (!Number.isFinite(currentX) || !Number.isFinite(currentY)) {
    throw new Error(`Dancer "${dancerId}" has invalid stage coordinates.`);
  }

  await page.mouse.move(
    stageBounds.x + stageBounds.width * currentX,
    stageBounds.y + stageBounds.height * currentY,
  );
  await page.mouse.down();
  await page.mouse.move(
    stageBounds.x + stageBounds.width * targetX,
    stageBounds.y + stageBounds.height * targetY,
    { steps: 5 },
  );
  await page.mouse.up();
}

async function expectSvgLineSegment(
  line: Locator,
  options: {
    readonly minimumLength: number;
    readonly unsafe?: boolean;
  },
): Promise<void> {
  await expect(line).toBeAttached();

  const attributes = await line.evaluate((element) => {
    if (element.tagName.toLowerCase() !== "line") {
      throw new Error(
        `Expected an SVG line, received <${element.tagName.toLowerCase()}>.`,
      );
    }

    const readRequiredNumber = (attributeName: string): number => {
      const rawValue = element.getAttribute(attributeName);
      if (rawValue === null) {
        throw new Error(`SVG line is missing "${attributeName}".`);
      }

      const value = Number(rawValue);
      if (!Number.isFinite(value)) {
        throw new Error(
          `SVG line attribute "${attributeName}" must be finite.`,
        );
      }
      return value;
    };

    return {
      opacity: readRequiredNumber("opacity"),
      x1: readRequiredNumber("x1"),
      x2: readRequiredNumber("x2"),
      y1: readRequiredNumber("y1"),
      y2: readRequiredNumber("y2"),
    };
  });

  const segmentLength = Math.hypot(
    attributes.x2 - attributes.x1,
    attributes.y2 - attributes.y1,
  );
  expect(segmentLength).toBeGreaterThan(options.minimumLength);
  expect(attributes.opacity).toBeGreaterThan(0);

  if (options.unsafe !== undefined) {
    await expect(line).toHaveAttribute("data-unsafe", String(options.unsafe));
  }
}

async function getSavedDancerX(
  page: Page,
  formationIndex: number,
  dancerId: string,
): Promise<number | null> {
  return page.evaluate(
    ({
      dancerId: requestedDancerId,
      formationIndex: requestedFormationIndex,
      storageKey,
    }) => {
      const serialized = window.localStorage.getItem(storageKey);
      if (serialized === null) {
        return null;
      }

      const envelope = JSON.parse(serialized) as {
        project?: {
          formations?: Array<{
            positions?: Record<string, { x?: unknown }>;
          }>;
        };
      };
      const x =
        envelope.project?.formations?.[requestedFormationIndex]?.positions?.[
          requestedDancerId
        ]?.x;
      return typeof x === "number" && Number.isFinite(x) ? x : null;
    },
    {
      dancerId,
      formationIndex,
      storageKey: PROJECT_STORAGE_KEY,
    },
  );
}

test("renders the main editor regions on a tablet viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");

  await expect(
    page.getByRole("navigation", { name: "Project navigation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Dancers" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Formation A" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Formation controls" }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Transition analysis" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play transition preview" }),
  ).toBeVisible();
  await expect(
    page.getByText("Safety conflicts", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Path intersections", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Total travel", { exact: true })).toBeVisible();
  await expect(page.getByText("Longest travel", { exact: true })).toBeVisible();
});

test("saves project edits and restores them after refresh", async ({
  page,
}) => {
  await page.goto("/");

  const marker = page.getByTestId("dancer-marker-dancer-02");
  await marker.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => Number(await marker.getAttribute("data-x")))
    .toBeCloseTo(0.41);
  await expect
    .poll(() => getSavedDancerX(page, 0, "dancer-02"))
    .toBeCloseTo(0.41);

  await page.reload();

  await expect
    .poll(async () =>
      Number(
        await page
          .getByTestId("dancer-marker-dancer-02")
          .getAttribute("data-x"),
      ),
    )
    .toBeCloseTo(0.41);
});

test("preserves invalid saved data until the demo is explicitly reset", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    ({ storageKey, value }) => window.localStorage.setItem(storageKey, value),
    { storageKey: PROJECT_STORAGE_KEY, value: "{corrupted-json" },
  );

  await page.reload();

  await expect(page.getByTestId("storage-error")).toContainText(
    "Saved project is not valid JSON",
  );
  await expect
    .poll(() =>
      page.evaluate(
        (storageKey) => window.localStorage.getItem(storageKey),
        PROJECT_STORAGE_KEY,
      ),
    )
    .toBe("{corrupted-json");

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Reset demo project" }).click();

  await expect(page.getByTestId("storage-error")).toHaveCount(0);
  await expect
    .poll(() => getSavedDancerX(page, 0, "dancer-02"))
    .toBeCloseTo(0.4);
});

test("imports and exports a validated versioned project", async ({ page }) => {
  await page.goto("/");
  const importedProject = {
    ...structuredClone(sampleProject),
    name: "Imported Showcase",
    lockedDancerIds: [],
  };
  const importedJson = serializeStoredProject(importedProject, {
    pretty: true,
    savedAt: "2026-07-30T12:00:00.000Z",
  });

  await page.getByLabel("Import project JSON").setInputFiles({
    name: "imported-showcase.json",
    mimeType: "application/json",
    buffer: Buffer.from(importedJson),
  });

  await expect(
    page.getByRole("heading", { name: "Imported Showcase" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Lock Ari's Formation B assignment",
    }),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("imported-showcase.json");

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Imported Showcase" }),
  ).toBeVisible();
});

test("resets to the baseline of an intentionally preloaded project", async ({
  page,
}) => {
  await page.goto("/");
  const preloadedProject = {
    ...sampleProject,
    name: "Preloaded Baseline",
    formations: [
      sampleProject.formations[0],
      {
        ...sampleProject.formations[1],
        positions: {
          ...sampleProject.formations[1].positions,
          "dancer-02": {
            ...sampleProject.formations[1].positions["dancer-02"],
            x: 0.52,
          },
        },
      },
    ] as const,
  };
  const serialized = serializeStoredProject(preloadedProject, {
    savedAt: "2026-07-31T12:00:00.000Z",
  });
  await page.evaluate(
    ({ storageKey, value }) => window.localStorage.setItem(storageKey, value),
    { storageKey: PROJECT_STORAGE_KEY, value: serialized },
  );

  await page.reload();

  const marker = page.getByTestId("dancer-marker-dancer-02");
  await page.getByRole("button", { name: "View Formation B" }).click();
  await expect(marker).toHaveAttribute("data-x", "0.52");

  await page.getByRole("button", { name: "Copy A into B" }).click();
  await expect(marker).toHaveAttribute("data-x", "0.4");

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.accept();
  });
  await page
    .getByRole("button", { name: "Reset Formation B positions" })
    .click();

  await expect(marker).toHaveAttribute("data-x", "0.52");
  await expect
    .poll(() => getSavedDancerX(page, 1, "dancer-02"))
    .toBeCloseTo(0.52);
});

test("locks and unlocks dancer target assignments", async ({ page }) => {
  await page.goto("/");

  const unlockAri = page.getByRole("button", {
    name: "Unlock Ari's Formation B assignment",
  });
  await expect(unlockAri).toHaveAttribute("aria-pressed", "true");
  await unlockAri.click();

  const lockAri = page.getByRole("button", {
    name: "Lock Ari's Formation B assignment",
  });
  await expect(lockAri).toHaveAttribute("aria-pressed", "false");
  await lockAri.click();
  await expect(unlockAri).toHaveAttribute("aria-pressed", "true");
});

test("states explicitly when no target swap improves safety", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Copy A into B" }).click();
  await expect(page.getByTestId("safety-conflict-count")).toHaveText("0");
  await page.getByRole("button", { name: "Find safer swap" }).click();

  await expect(page.getByText("No improving swap found")).toBeVisible();
  await expect(page.getByTestId("no-recommendation-state")).toContainText(
    "Formation B was not changed",
  );
});

test("drags a dancer and commits the new normalized position", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const stage = page.getByTestId("stage-editor");
  const marker = page.getByTestId("dancer-marker-dancer-02");
  const stageBounds = await stage.boundingBox();

  if (stageBounds === null) {
    throw new Error("The SVG stage must be visible before dragging a dancer.");
  }

  await expect(marker).toHaveAttribute("data-x", "0.4");
  await expect(marker).toHaveAttribute("data-y", "0.25");

  const startX = stageBounds.x + stageBounds.width * 0.4;
  const startY = stageBounds.y + stageBounds.height * 0.25;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + stageBounds.width * 0.1, startY, {
    steps: 5,
  });
  await page.mouse.up();

  await expect(marker).toHaveAttribute("data-x", "0.5");
  await expect(marker).toHaveAttribute("data-y", "0.25");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
});

test("recomputes analysis when either formation changes", async ({ page }) => {
  await page.goto("/");

  const marker = page.getByTestId("dancer-marker-dancer-02");
  const totalTravel = page.getByTestId("total-travel-distance");
  const initialTotal = await totalTravel.textContent();
  if (initialTotal === null) {
    throw new Error(
      "Total travel must be rendered before editing a formation.",
    );
  }

  await marker.focus();
  await page.keyboard.press("ArrowRight");
  await expect(totalTravel).not.toHaveText(initialTotal);
  const afterFormationAChange = await totalTravel.textContent();
  if (afterFormationAChange === null) {
    throw new Error(
      "Total travel must remain rendered after editing Formation A.",
    );
  }

  await page.getByRole("button", { name: "View Formation B" }).click();
  await marker.focus();
  await page.keyboard.press("ArrowRight");
  await expect(totalTravel).not.toHaveText(afterFormationAChange);
});

test("updates analysis and focuses dancers in a selected conflict", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "View Formation B" }).click();

  // Formation B becomes a direct target-position swap for Ari and Blair.
  await dragDancerTo(page, "dancer-01", 0.4, 0.25);
  await dragDancerTo(page, "dancer-02", 0.2, 0.25);

  const conflictButton = page.getByRole("button", {
    name: "Focus conflict between Ari and Blair",
  });
  await expect(conflictButton).toBeVisible();
  await expect(conflictButton).toContainText("Closest at 50%");
  await expectSvgLineSegment(page.getByTestId("movement-path-dancer-01"), {
    minimumLength: MIN_MEANINGFUL_SVG_PATH_LENGTH,
    unsafe: true,
  });
  await expectSvgLineSegment(page.getByTestId("movement-path-dancer-02"), {
    minimumLength: MIN_MEANINGFUL_SVG_PATH_LENGTH,
    unsafe: true,
  });
  await expect(
    page.getByTestId("conflict-location-dancer-01::dancer-02"),
  ).toBeVisible();

  await conflictButton.click();

  await expect(conflictButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("dancer-marker-dancer-01")).toHaveAttribute(
    "data-conflict-selected",
    "true",
  );
  await expect(page.getByTestId("dancer-marker-dancer-02")).toHaveAttribute(
    "data-conflict-selected",
    "true",
  );
});

test("previews, rejects, accepts, undoes, and redoes a recommendation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page
    .getByRole("button", {
      name: "Unlock Ari's Formation B assignment",
    })
    .click();
  await page.getByRole("button", { name: "Copy A into B" }).click();

  await dragDancerTo(page, "dancer-01", 0.4, 0.25);
  await dragDancerTo(page, "dancer-02", 0.2, 0.25);
  await expect(page.getByTestId("safety-conflict-count")).toHaveText("1");

  const ari = page.getByTestId("dancer-marker-dancer-01");
  const blair = page.getByTestId("dancer-marker-dancer-02");
  await page.getByRole("button", { name: "Find safer swap" }).click();
  const previewRecommendation = page.getByRole("button", {
    name: "Preview recommendation to swap Ari and Blair",
  });
  await expect(previewRecommendation).toBeVisible();

  await page
    .getByRole("button", { name: "Lock Ari's Formation B assignment" })
    .click();
  await expect(previewRecommendation).toHaveCount(0);
  await page
    .getByRole("button", { name: "Unlock Ari's Formation B assignment" })
    .click();
  await page.getByRole("button", { name: "Find safer swap" }).click();
  await page
    .getByRole("button", {
      name: "Preview recommendation to swap Ari and Blair",
    })
    .click();

  await expect(page.getByTestId("recommendation-preview")).toBeVisible();
  await expect(
    page.getByTestId("recommendation-preview-stationary-dancer-01"),
  ).toBeVisible();
  await expect(
    page.getByTestId("recommendation-preview-stationary-dancer-01"),
  ).toHaveAccessibleName("Ari remains stationary in the proposed transition");
  await expect(
    page.getByTestId("recommendation-preview-stationary-dancer-02"),
  ).toHaveAccessibleName("Blair remains stationary in the proposed transition");
  await expectSvgLineSegment(page.getByTestId("movement-path-dancer-02"), {
    minimumLength: MIN_MEANINGFUL_SVG_PATH_LENGTH,
    unsafe: true,
  });
  await expect(
    page.getByText("No measured ranking metric becomes worse."),
  ).toBeVisible();
  await expect(
    page.getByText(/not guaranteed to be artistically better/),
  ).toBeVisible();
  await expect
    .poll(async () => Number(await ari.getAttribute("data-x")))
    .toBeCloseTo(0.4);
  await expect
    .poll(async () => Number(await blair.getAttribute("data-x")))
    .toBeCloseTo(0.2);

  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByTestId("recommendation-preview")).toHaveCount(0);
  await expect
    .poll(async () => Number(await ari.getAttribute("data-x")))
    .toBeCloseTo(0.4);
  await expect
    .poll(async () => Number(await blair.getAttribute("data-x")))
    .toBeCloseTo(0.2);

  await page.getByRole("button", { name: "Find safer swap" }).click();
  await page
    .getByRole("button", {
      name: "Preview recommendation to swap Ari and Blair",
    })
    .click();
  await page.getByRole("button", { name: "Accept swap" }).click();

  await expect
    .poll(async () => Number(await ari.getAttribute("data-x")))
    .toBeCloseTo(0.2);
  await expect
    .poll(async () => Number(await blair.getAttribute("data-x")))
    .toBeCloseTo(0.4);

  await page
    .getByRole("button", { name: "Undo last formation change" })
    .click();
  await expect
    .poll(async () => Number(await ari.getAttribute("data-x")))
    .toBeCloseTo(0.4);
  await expect
    .poll(async () => Number(await blair.getAttribute("data-x")))
    .toBeCloseTo(0.2);

  await page
    .getByRole("button", { name: "Redo last formation change" })
    .click();
  await expect
    .poll(async () => Number(await ari.getAttribute("data-x")))
    .toBeCloseTo(0.2);
  await expect
    .poll(async () => Number(await blair.getAttribute("data-x")))
    .toBeCloseTo(0.4);
});

test("manages two independent formations with copy, reset, undo, and redo", async ({
  page,
}) => {
  await page.goto("/");

  const marker = page.getByTestId("dancer-marker-dancer-02");
  await marker.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => Number(await marker.getAttribute("data-x")))
    .toBeCloseTo(0.41);

  await page.getByRole("button", { name: "View Formation B" }).click();
  await expect(marker).toHaveAttribute("data-x", "0.35");

  await page.getByRole("button", { name: "View Formation A" }).click();
  await expect
    .poll(async () => Number(await marker.getAttribute("data-x")))
    .toBeCloseTo(0.41);

  await page
    .getByRole("button", { name: "Undo last formation change" })
    .click();
  await expect(marker).toHaveAttribute("data-x", "0.4");

  await page
    .getByRole("button", { name: "Redo last formation change" })
    .click();
  await expect
    .poll(async () => Number(await marker.getAttribute("data-x")))
    .toBeCloseTo(0.41);

  await page.getByRole("button", { name: "Copy A into B" }).click();
  await expect
    .poll(async () => Number(await marker.getAttribute("data-x")))
    .toBeCloseTo(0.41);

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("Reset all dancer positions");
    await dialog.accept();
  });
  await page
    .getByRole("button", { name: "Reset Formation B positions" })
    .click();
  await expect(marker).toHaveAttribute("data-x", "0.35");

  await page.getByLabel("Active formation name").fill("Closing");
  await page.getByRole("button", { name: "Save formation name" }).click();
  await expect(page.getByRole("region", { name: "Closing" })).toBeVisible();
});

test("plays, pauses, restarts, and scrubs the transition without changing formations", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");

  const marker = page.getByTestId("dancer-marker-dancer-02");
  const progress = page.getByLabel("Transition progress");
  const play = page.getByRole("button", { name: "Play transition preview" });
  const pause = page.getByRole("button", {
    name: "Pause transition preview",
  });
  const restart = page.getByRole("button", {
    name: "Restart transition preview",
  });

  await page.getByLabel("Transition duration in seconds").fill("1");
  await progress.fill("50");
  await expect(page.getByTestId("transition-progress-output")).toHaveText(
    "50%",
  );
  await expect(marker).toHaveAttribute("data-x", "0.375");
  await expect(marker).toHaveAttribute("data-y", "0.325");
  await expect(marker).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByRole("button", { name: "View Formation B" }),
  ).toBeDisabled();

  await restart.click();
  await expect(marker).toHaveAttribute("data-x", "0.4");
  await expect(marker).toHaveAttribute("data-y", "0.25");
  await expect(marker).toHaveAttribute("aria-disabled", "false");

  await play.click();
  await expect
    .poll(async () => Number(await progress.inputValue()))
    .toBeGreaterThan(0);
  await pause.click();
  await page.waitForTimeout(50);
  const pausedProgress = await progress.inputValue();
  await page.waitForTimeout(150);
  await expect(progress).toHaveValue(pausedProgress);

  await play.click();
  await expect(page.getByTestId("transition-progress-output")).toHaveText(
    "100%",
    { timeout: 2_000 },
  );
  await expect(marker).toHaveAttribute("data-x", "0.35");
  await expect(marker).toHaveAttribute("data-y", "0.4");

  await restart.click();
  await expect(marker).toHaveAttribute("data-x", "0.4");
  await expect(marker).toHaveAttribute("data-y", "0.25");
  expect(pageErrors).toEqual([]);
});

test("skips continuous animation when reduced motion is preferred", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await page.getByRole("button", { name: "Play transition preview" }).click();

  await expect(page.getByTestId("transition-progress-output")).toHaveText(
    "100%",
  );
  await expect(page.getByText(/Reduced motion is enabled/)).toBeVisible();
});
