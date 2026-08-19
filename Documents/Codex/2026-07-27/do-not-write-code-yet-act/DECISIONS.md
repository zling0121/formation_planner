# FormationFlow Technical Decision Log

This log records major technical decisions, alternatives considered, rationale, and consequences. Add a new entry when a decision materially affects architecture, product behavior, safety, dependencies, operations, or long-term maintenance. Do not rewrite prior decisions without recording what superseded them.

## Decision Template

### ADR-NNN: Decision title

- **Status:** Proposed, accepted, superseded, or rejected
- **Date:** YYYY-MM-DD
- **Decision:** What was decided
- **Alternatives considered:** Other credible options
- **Rationale:** Why this option was selected
- **Consequences:** Positive and negative effects, constraints, and follow-up work

## ADR-001: Use Next.js App Router with React and strict TypeScript

- **Status:** Accepted
- **Date:** 2026-07-29
- **Decision:** Build the application with Next.js App Router, React, and TypeScript with `strict` mode enabled.
- **Alternatives considered:** React with Vite; Next.js Pages Router; JavaScript without static typing.
- **Rationale:** The required technology is Next.js, React, and TypeScript. App Router is the current Next.js application model, and strict typing helps make dancer identities, formation state, geometry inputs, and recommendation results explicit.
- **Consequences:** Application routes follow the `app/` convention. Code must satisfy strict type checking. Weakening strict mode or bypassing errors with broad suppressions is not an acceptable shortcut.

## ADR-002: Use Tailwind CSS for presentation and SVG for the future stage editor

- **Status:** Accepted
- **Date:** 2026-07-29
- **Decision:** Use Tailwind CSS for application styling. Build the 2D stage editor with SVG when that functionality enters scope.
- **Alternatives considered:** CSS Modules or CSS-in-JS for presentation; Canvas, WebGL, or absolutely positioned HTML elements for the stage.
- **Rationale:** Tailwind CSS and SVG are explicit technology requirements. SVG provides a coordinate-based, inspectable, and accessible surface suitable for a 2D editor with a small dancer count.
- **Consequences:** Visual components may use Tailwind utilities, while stage geometry must remain independent of SVG rendering. SVG event handling must not become the source of truth for domain coordinates. Canvas, WebGL, and 3D rendering remain out of scope unless this decision is revisited.

## ADR-003: Isolate domain calculations from React

- **Status:** Accepted
- **Date:** 2026-07-29
- **Decision:** Implement geometry, proximity analysis, travel measurement, and swap optimization as pure TypeScript domain modules outside React.
- **Alternatives considered:** Put calculations directly in components or hooks; calculate from rendered SVG or DOM state; perform calculations only on a server.
- **Rationale:** Independent domain modules are easier to test precisely, reuse during animation and recommendation analysis, and reason about without rendering side effects.
- **Consequences:** React is responsible for input, orchestration, and presentation, not mathematical truth. Domain APIs require explicit typed inputs and outputs. UI state must translate to domain values before calculation.

## ADR-004: Use deterministic analytic safety calculations

- **Status:** Accepted
- **Date:** 2026-07-29
- **Decision:** Use deterministic mathematical algorithms for collision and proximity analysis. Do not use an LLM, animation-frame sampling, or visual inference to calculate dancer safety.
- **Alternatives considered:** Frame-by-frame sampling; an LLM-based evaluator; manual-only collision review; a general physics engine.
- **Rationale:** Safety results must be repeatable, testable at boundary conditions, independent of playback performance, and explainable to users. An LLM cannot provide the numerical guarantees required for collision calculations.
- **Consequences:** The implementation must define numeric tolerances and test endpoint, crossing, parallel-motion, overlapping-position, zero-motion, and exact-threshold cases. Identical inputs must return identical conflicts and recommendation rankings.

## ADR-005: Use Vitest for unit tests and Playwright for end-to-end tests

- **Status:** Accepted
- **Date:** 2026-07-29
- **Decision:** Use Vitest for unit and component-level tests and Playwright for browser-level end-to-end tests.
- **Alternatives considered:** Jest; Node's built-in test runner; Cypress; browser testing performed only by hand.
- **Rationale:** Vitest provides fast TypeScript-oriented unit testing, while Playwright validates critical behavior in a real browser. Both are explicit project requirements.
- **Consequences:** Domain behavior belongs primarily in Vitest coverage. User-visible workflows require Playwright coverage in proportion to risk. Browser binaries must be installed in development and CI environments before end-to-end tests run.

## ADR-006: Keep the initial application local and persistence-free

- **Status:** Accepted
- **Date:** 2026-07-29
- **Decision:** Do not add authentication or a database during initialization. The current application contains only a minimal home page and development tooling.
- **Alternatives considered:** Add user accounts immediately; provision a database; create placeholder persistence abstractions.
- **Rationale:** Authentication and database work were explicitly excluded from initialization, and speculative abstractions would add complexity without validated behavior.
- **Consequences:** There is no user identity, server-side persistence, or cross-device data. Any future persistence decision requires explicit scope approval, threat modeling, and a new decision record.

## ADR-007: Minimize and justify dependencies

- **Status:** Accepted
- **Date:** 2026-07-29
- **Decision:** Use the framework and required quality-tool dependencies already selected, and require a concrete justification for every additional package.
- **Alternatives considered:** Adopt broad UI, state-management, geometry, optimization, validation, and utility libraries at project start.
- **Rationale:** The MVP is small, product behavior is not yet implemented, and premature dependencies increase bundle size, maintenance load, security exposure, and architectural coupling.
- **Consequences:** Contributors should prefer platform features and existing packages. Material additions must document the problem solved, alternatives considered, and operational consequences here or in a new ADR.

## ADR-008: Store stage positions as normalized coordinates

- **Status:** Accepted
- **Date:** 2026-07-29
- **Decision:** Store every dancer position as normalized `(x, y)` coordinates in the inclusive range from `0` to `1`. From the audience-facing top-down view, `x = 0` is the stage-left edge, `x = 1` is stage right, `y = 0` is the upstage edge, and `y = 1` is the downstage edge. Store physical stage width, depth, and unit separately.
- **Alternatives considered:** Store SVG pixels; store only physical measurements; use a center-origin coordinate system with negative values; use an unbounded Cartesian plane.
- **Rationale:** Normalized coordinates keep formations independent of viewport size and stage dimensions, map directly to a bounded SVG view box, and make in-bounds validation deterministic. Separate physical dimensions allow distance and safety calculations to scale horizontal and depth deltas correctly.
- **Consequences:** All persisted and domain-boundary coordinates must be validated as finite values in `[0, 1]`. Rendering converts normalized coordinates to SVG coordinates. Physical distance calculations must scale `x` by stage width and `y` by stage depth before measuring distance; they must not treat normalized values as physical distances. Changing stage dimensions preserves formation shape but changes physical travel and separation results.

## ADR-009: Use bounded, position-only formation history

- **Status:** Accepted
- **Date:** 2026-07-29
- **Decision:** Keep exactly one undoable dancer-position change and one corresponding redo slot. Switching and renaming do not alter this position history. Copying Formation A into Formation B or resetting a formation clears it because those operations replace a complete layout. Reset restores the formation positions loaded when the editor opened and preserves the formation's current name.
- **Alternatives considered:** An unlimited command timeline; a larger capped history stack; browser-native state snapshots; treating copy, reset, and rename as undoable position edits.
- **Rationale:** The requested scope explicitly excludes an unlimited timeline, while the MVP needs immediate, understandable recovery from an accidental drag or keyboard nudge. A one-step model is deterministic, small, and avoids ambiguous partial restoration after whole-layout operations.
- **Consequences:** Users can undo and redo only the latest position change. A new position change replaces older history, and copy or reset disables prior undo/redo. Extending history or making whole-layout operations undoable requires a new decision and tests for action ordering and stale state.

## ADR-010: Keep transition playback transient and lock editing during preview

- **Status:** Accepted
- **Date:** 2026-07-29
- **Decision:** Derive every playback frame from immutable Formation A and Formation B positions using pure linear interpolation. Playback progress is transient UI state and never writes interpolated coordinates into either formation. Formation editing and management controls are disabled while progress is above 0% or playback is running; Restart returns to 0% and restores editing. Duration is configurable from 1 to 20 seconds. When the operating system requests reduced motion, Play moves directly to 100% without continuous animation, while manual scrubbing remains available.
- **Alternatives considered:** Mutating the active formation on every animation frame; maintaining a third playback formation; allowing edits against interpolated positions; always animating despite reduced-motion preferences.
- **Rationale:** A derived preview prevents animation state from corrupting saved choreography and keeps calculations independent of rendering cadence. Locking edits avoids ambiguous writes while dancers are shown between saved endpoints. The reduced-motion behavior preserves access to transition states without forcing continuous movement.
- **Consequences:** Pausing or scrubbing at a nonzero value remains read-only until Restart or scrubbing back to 0%. Animation frames update presentation state only. Future playback analysis must continue using saved endpoints and pure progress values, not rendered SVG coordinates.

## ADR-011: Derive live analysis from formation state

- **Status:** Accepted
- **Date:** 2026-07-29
- **Decision:** Run the pure `analyzeTransitionSafety` domain function against the current Formation A and Formation B whenever either formation changes. Pass the resulting immutable analysis into presentation components and use the same result to draw stage paths and conflict markers. Conflict selection is transient UI state and never changes either formation.
- **Alternatives considered:** Calculate safety from rendered SVG coordinates; update analysis on animation frames; copy safety mathematics into React; persist analysis as independently editable state.
- **Rationale:** Formation endpoints are the source of truth, and Step 11 requires live results after edits. Deriving the result with memoization keeps the deterministic engine independent from React and prevents playback or rendering details from affecting safety calculations.
- **Consequences:** Drag, keyboard movement, copy, reset, undo, and redo immediately recompute the full analysis. Playback duration and progress do not change analysis. The current small 6–16 dancer scope makes full pairwise recomputation appropriate; larger rosters would require separate performance evaluation. Conflict focus is cleared visually if its pair is no longer unsafe, without changing formation data.

## ADR-012: Exclude boundary violations and maximum speed from MVP swap ranking

- **Status:** Accepted
- **Date:** 2026-07-29
- **Decision:** Rank target-position swaps only by the metrics defined in `PRODUCT_SPEC.md`: unsafe-pair count, global minimum separation, total travel distance, longest individual travel distance, and a stable dancer-ID tie-break. Do not add boundary-violation or maximum-required-speed metrics to the MVP optimizer.
- **Alternatives considered:** Rank candidates by boundary violations before safety separation; derive maximum speed from travel distance and playback duration; add dancer-specific speed limits or transition timing.
- **Rationale:** Formation positions are constrained to a rectangular stage, and a straight segment between two in-bounds points remains in that rectangle. Swapping existing valid Formation B targets therefore cannot create a boundary violation, so the metric would always tie. The MVP also defines a shared constant normalized transition rate and treats playback duration as presentation speed; it does not define dancer-specific timing, movement profiles, or safe-speed limits. A maximum-speed metric would duplicate longest travel divided by one shared duration while implying unsupported physical guidance.
- **Consequences:** The optimizer remains aligned with the approved product specification and avoids meaningless or misleading criteria. Boundary checks continue at formation validation boundaries. Adding obstacles, non-convex stages, waypoints, staggered timing, or dancer-specific speed constraints would require new product definitions and a superseding decision.

## ADR-013: Keep recommendation preview transient and acceptance one-step undoable

- **Status:** Accepted
- **Date:** 2026-07-30
- **Decision:** Keep an unaccepted recommendation and its proposed paths as transient derived UI state. Only Accept writes the two proposed Formation B targets. Accepted swaps use the editor's bounded one-step history alongside position changes, allowing one undo and redo without introducing an unlimited command timeline.
- **Alternatives considered:** Mutate Formation B when preview opens and restore it on rejection; maintain a separate preview formation as saved state; introduce a general unlimited command stack; provide recommendation-specific controls disconnected from existing undo and redo.
- **Rationale:** A derived preview guarantees that rejection is data-neutral and matches the product requirement that recommendations remain proposals until accepted. Reusing one bounded history model keeps recovery understandable and preserves the existing MVP constraint against an unlimited timeline.
- **Consequences:** Opening and rejecting a preview never changes saved formations. Accepting clears older position history and becomes the single undoable change. A later manual position edit, copy, or reset replaces recommendation history. Lock or formation changes clear any unaccepted recommendation before it can be applied.

## ADR-014: Persist one versioned project locally

- **Status:** Accepted; supersedes the persistence-free portion of ADR-006
- **Date:** 2026-07-30
- **Decision:** Save the most recent complete `Project` in browser local storage as a versioned JSON envelope. Validate and migrate supported data before loading it. Keep formation history, playback, recommendations, and analysis transient.
- **Alternatives considered:** IndexedDB; a server database with accounts; storing separate keys for each project field; persisting the entire React/editor state; silently falling back to the demo when data is corrupted.
- **Rationale:** The MVP requires same-browser restoration and JSON portability without authentication or a database. The project is small enough for local storage, while a single validated envelope makes saves atomic at the browser API boundary and keeps schema evolution explicit.
- **Consequences:** The MVP stores one local project and has no cross-device synchronization or multi-project library. Corrupted or unsupported data remains untouched and produces an explicit error until the user imports valid data or resets the demo. Every schema change requires a version increment, migration or explicit rejection, validation tests, and an update to `DATA_FORMAT.md`.
