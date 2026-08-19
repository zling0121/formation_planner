# FormationFlow MVP Product Specification

## Product Summary

FormationFlow helps student choreographers plan and evaluate the transition between two dance formations. It provides a simple 2D stage editor, animates each dancer along a straight-line path, identifies unsafe proximity during the transition, measures travel, and suggests a limited reassignment of destination positions when that reassignment improves safety.

The MVP is a planning and decision-support tool. It does not generate choreography or replace the choreographer's judgment.

## Target User

### Primary user

A student choreographer managing a dance group of 6–16 people, typically working alone on a laptop or tablet before or during rehearsal.

### User characteristics

- Understands dancers by name, initials, role, or another short label.
- Thinks spatially and needs a fast visual workflow rather than a technical optimization tool.
- May revise formations repeatedly as attendance, ability, or staging constraints change.
- Needs recommendations to remain understandable and reversible because dancer assignments may reflect constraints the software cannot know.

## Problem Statement

Choreographers commonly design two formations independently and then discover during rehearsal that the transition between them creates near-collisions, long travel paths, or impractical crossing patterns. Evaluating every dancer simultaneously is mentally demanding, and manually testing alternative destination assignments is slow.

FormationFlow should let a choreographer model two formations, see how dancers move between them, identify where and when safety problems occur, compare travel demands, and evaluate a simple destination swap without losing control of dancer-specific constraints.

## MVP Definitions and Assumptions

- A **dancer** is a persistent identity with a unique system ID and a user-visible label.
- A **stage** is a bounded 2D rectangular coordinate space shown from above.
- **Formation A** assigns one stage position to each dancer and is the transition's start.
- **Formation B** assigns one stage position to each dancer and is the transition's destination.
- A **transition** moves all dancers simultaneously from A to B in a straight line at a constant normalized rate. Playback duration changes animation speed, not the paths or analysis.
- **Travel distance** is the straight-line distance between a dancer's A and B positions, expressed in stage units.
- The **safety threshold** is the minimum permitted center-to-center distance between any two dancers. The MVP supplies a documented default and lets the user adjust it for the current project.
- An **unsafe proximity event** occurs if two dancers are closer than the safety threshold at any instant during the transition, including at either endpoint.
- A **target-position swap** exchanges the Formation B destinations of exactly two unlocked dancers. It does not change Formation A, dancer identities, or the destination point set.
- A **locked dancer** keeps their current Formation B destination and cannot participate in a recommendation.

## Primary User Journey

1. The choreographer starts a project and creates 6–16 dancers with recognizable labels.
2. They place every dancer on the 2D stage and save those positions as Formation A.
3. They arrange the same dancers at their intended destinations and save those positions as Formation B.
4. FormationFlow validates that both formations are complete.
5. The choreographer previews the straight-line transition using play, pause, restart, and timeline scrubbing.
6. FormationFlow displays each dancer's path and travel distance, highlights unsafe dancer pairs, and shows where and when their closest approach occurs.
7. The choreographer locks any dancers whose destinations must not change.
8. They request a recommendation.
9. If an improving swap exists, FormationFlow previews the proposed exchange and explains its effect on conflicts and travel.
10. The choreographer accepts or rejects the recommendation. If accepted, they can undo it and restore the exact prior Formation B assignments and analysis.
11. They repeat evaluation and revision as needed.

## Functional Requirements

### FR-1: Project and dancer management

- The user can create a project containing a stage, a dancer roster, Formation A, and Formation B.
- The user can add, rename, and remove dancers before or while editing formations.
- Dancer labels must be non-empty and unique within a project after trimming whitespace.
- The UI must preserve dancer identity across both formations; changing a label must not change assignments.
- The supported analyzed roster size is 6–16 dancers.
- Removing a dancer must require confirmation when that dancer has a saved position.
- Adding or removing a dancer makes both formations incomplete until the roster and saved positions are reconciled.

### FR-2: 2D stage editor

- The user can place and reposition dancers within a bounded rectangular stage.
- Each dancer marker must show a recognizable label and remain selectable when markers overlap.
- Placement must support pointer/touch dragging and a more precise adjustment method, such as keyboard nudging or coordinate entry.
- The editor must prevent saving a position outside the stage boundary.
- The user can switch between editing Formation A and Formation B without changing the other formation.
- The UI must clearly indicate which formation is being edited and whether it has unsaved changes.

### FR-3: Formation persistence and validation

- The user can save the current complete layout as Formation A or Formation B.
- A saved formation must contain exactly one position for every dancer in the current roster.
- Saving one formation must not overwrite the other.
- The system must preserve saved formations after refresh or reopening the product on the same supported device/browser.
- Transition analysis and playback must be disabled with a clear explanation until both formations are complete and valid.
- Editing and resaving either formation must invalidate and recompute all derived analysis and any pending recommendation.

### FR-4: Transition visualization and playback

- The system must animate all dancers simultaneously from Formation A to Formation B along straight-line paths.
- The user can play, pause, restart, and scrub the transition timeline.
- The user can change playback duration or speed without changing analysis results.
- The stage can display start points, destination points, and travel paths without obscuring dancer identity.
- Pausing or scrubbing must show each dancer at the mathematically corresponding transition position.

### FR-5: Unsafe proximity detection

- The user can view and adjust the project safety threshold in stage units.
- The system must evaluate proximity continuously along the straight-line transition, not only at sampled animation frames.
- For every dancer pair whose minimum separation is below the threshold, the system must provide:
  - the two dancer labels;
  - their minimum separation;
  - the normalized time or percentage of closest approach; and
  - a visual indication of the closest-approach location or moment.
- The system must distinguish threshold violations from values exactly equal to the threshold. Equality is considered safe.
- Conflict results must update after formation edits, threshold changes, accepted recommendations, or undo.
- Multiple simultaneous or overlapping conflict events must remain independently inspectable.

### FR-6: Travel-distance measurement

- The system must display each dancer's A-to-B straight-line travel distance.
- The system must display total travel distance across all dancers.
- The system should also display the maximum individual travel distance to reveal unusually demanding assignments.
- All distances must use one consistent, clearly labeled stage unit and a consistent rounding convention.
- Analysis and recommendation comparisons must use unrounded values internally.

### FR-7: Target-position swap recommendation

- The user can request a recommendation only when both formations are complete.
- The system must consider every pairwise Formation B destination swap between unlocked dancers.
- The recommendation must preserve all Formation A positions, all Formation B destination coordinates as a set, and every locked dancer's assignment.
- The system must recommend at most one swap per request.
- A swap qualifies as an improvement only if it reduces the number of unsafe dancer pairs. Among swaps tied on that result, the system must prefer, in order:
  1. greater minimum separation across all dancer pairs;
  2. lower total travel distance;
  3. lower maximum individual travel distance; and
  4. a stable deterministic tie-break based on dancer IDs.
- The system must not recommend a swap that leaves the unsafe-pair count unchanged, even if it reduces travel.
- If no qualifying swap exists, the system must say so without altering Formation B.
- The system must show a before/after preview containing:
  - the two dancers and destinations to be exchanged;
  - unsafe-pair counts;
  - global minimum separation;
  - total travel distance; and
  - each swapped dancer's travel-distance change.
- A generated recommendation is a preview and must not mutate the saved formation until accepted.

### FR-8: Dancer locks

- The user can lock or unlock a dancer's Formation B assignment.
- Lock state must be visible in the stage editor and recommendation preview.
- A locked dancer must never be included in a recommended swap.
- Locking, unlocking, or moving a dancer must invalidate any pending recommendation.
- Locks restrict reassignment only; locked dancers must still be animated, measured, and included in safety analysis.

### FR-9: Accept, reject, and undo

- **Accept** applies the previewed swap to Formation B, saves the resulting assignment, recomputes analysis, and creates an undoable action.
- **Reject** dismisses the pending recommendation without changing formations, locks, or analysis.
- **Undo** after acceptance restores the exact Formation B assignment that existed immediately before that acceptance and recomputes analysis.
- Undo must not revert unrelated roster, stage, threshold, or lock changes.
- If an intervening edit makes a safe undo ambiguous, the system must disable that undo and explain why rather than partially restoring state.
- Repeated recommendation requests must never silently stack unaccepted previews.

### FR-10: Feedback and error handling

- The system must provide clear empty, incomplete, processing, success, and no-improvement states.
- User-entered project data must not be lost because analysis or recommendation calculation fails.
- Invalid operations must explain the corrective action, such as placing missing dancers or unlocking at least two dancers.

## Non-Functional Requirements

### Usability

- A first-time user should be able to create an eight-dancer roster, save two formations, and play a transition without documentation.
- Visual encodings must not rely on color alone; conflicts, locks, and formation identity require an icon, label, pattern, or shape in addition to color.
- Common editing actions must support keyboard access, visible focus, and descriptive accessible names.
- The stage and essential controls must remain usable at a minimum viewport of 1024 × 768 CSS pixels. Smaller screens may display a clear unsupported-layout notice in the MVP.

### Performance

- For a valid 16-dancer project, safety analysis and travel metrics should update within 200 ms after a completed edit on a reference modern laptop.
- A swap recommendation across all eligible dancer pairs should return within 1 second for 16 dancers.
- Playback should target 60 frames per second and remain usable at no less than 30 frames per second on the reference device.

### Reliability and data integrity

- Saved project state must survive page refresh and ordinary browser restarts on the same device.
- Formation saves and accepted swaps must be atomic: interruption must leave either the prior valid state or the complete new valid state.
- Recommendation output must be deterministic for identical project state, threshold, and locks.
- Calculations must be independent of animation frame rate and playback speed.

### Privacy and security

- The MVP should not require personally identifying information beyond user-entered dancer labels.
- The product must explain where project data is stored and provide a way to delete the project from that storage.
- User-entered labels and project data must be treated as untrusted input and displayed safely.

### Maintainability and observability

- Safety and recommendation calculations must be isolated from rendering behavior and covered by deterministic tests.
- The product should record privacy-conscious operational events for failures and performance, without capturing dancer labels or exact formation coordinates by default.

## Out of Scope

- Video import, recording, pose tracking, or video analysis
- Automatic choreography or movement-path generation
- Curved, waypoint-based, staggered, or differently timed dancer paths
- 3D stages, elevation, lifts, or vertical clearance
- Real-time or asynchronous multi-user collaboration
- Music upload, playback synchronization, beat mapping, or music editing
- Social profiles, feeds, sharing networks, comments, likes, or discovery
- More than two formations in one analyzed transition
- More than one recommended swap per request or multi-dancer/global reassignment
- Physical attributes such as dancer width, reach, speed, mobility, or skill level
- Obstacles, scenery, stage zones, entrances, and exits
- Native mobile applications
- Production scheduling, attendance, messaging, costumes, or rehearsal management

## Edge Cases

- The roster has fewer than 6 or more than 16 dancers.
- A dancer exists in the roster but is missing from one or both formations.
- A dancer is added, removed, or renamed after both formations were saved.
- Two dancers occupy the same point at Formation A, Formation B, or during the transition.
- Two or more dancer markers overlap and are difficult to select.
- Dancers start or finish exactly at the safety threshold.
- Dancers' paths cross at different times and are therefore safe.
- Dancers' paths do not geometrically cross but still pass within the safety threshold.
- Two dancers have identical parallel movement, making their separation constant throughout the transition.
- A dancer has zero travel distance.
- A closest approach occurs at the start or end rather than between formations.
- Several unsafe pairs share one dancer or reach closest approach simultaneously.
- The safety threshold is zero, negative, non-numeric, or larger than the stage diagonal.
- Fewer than two dancers are unlocked.
- All possible swaps worsen or preserve the unsafe-pair count.
- Several swaps are equally ranked and require deterministic tie-breaking.
- A recommendation becomes stale because the user edits a formation, threshold, roster, or lock state.
- The user rejects a recommendation and immediately requests another with unchanged inputs.
- The user accepts a recommendation, changes unrelated settings, and attempts undo.
- The browser closes or refreshes during a formation save or recommendation acceptance.
- Very long labels collide visually or duplicate after whitespace/case normalization.
- Floating-point values near the safety boundary could otherwise produce inconsistent results.

## Product Risks

| Risk                                                                                    | Impact                                                                  | MVP mitigation                                                                            |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Straight-line, simultaneous movement does not match the choreography used in rehearsal. | Users may interpret warnings as more authoritative than they are.       | Label the transition model clearly and frame results as planning guidance.                |
| Center-point proximity understates body width, reach, turns, and momentum.              | A mathematically safe route may still be physically unsafe.             | Use a conservative adjustable threshold and display a persistent safety disclaimer.       |
| A swap can be mathematically safer but artistically or physically inappropriate.        | Recommendations may reduce trust or disrupt intent.                     | Show exactly what changes, honor locks, require explicit acceptance, and support undo.    |
| Optimizing unsafe-pair count can trade safety for much longer travel.                   | Users may accept a locally safer but impractical result.                | Show travel deltas and secondary ranking metrics before acceptance.                       |
| Stage-unit calibration may be unclear.                                                  | Distances and thresholds may not map meaningfully to rehearsal space.   | Use one documented coordinate system and make the threshold visible and adjustable.       |
| Overlapping markers make editing error-prone.                                           | Users may move or assign the wrong dancer.                              | Preserve labels, selection affordances, and precise adjustment controls.                  |
| Local-only persistence may be mistaken for cloud backup.                                | Users could lose work after clearing browser data or switching devices. | State the storage limitation plainly and avoid implying cross-device availability.        |
| Recommendation language may imply guaranteed collision avoidance.                       | Users may over-rely on the tool for physical safety.                    | Say “reduces modeled conflicts,” never “guarantees safety.”                               |
| The 6–16 dancer limit may exclude edge use cases in student groups.                     | Some users cannot model their full group.                               | Enforce and communicate the limit rather than silently degrading accuracy or performance. |

## Measurable Acceptance Criteria

The MVP is acceptable when all of the following pass on the defined supported browser and reference device:

1. **Roster creation:** A user can create 6, 8, and 16 uniquely labeled dancers. Attempts to analyze 5 or 17 dancers are blocked with a clear roster-limit message.
2. **Formation integrity:** Saving A and B records exactly one in-bounds position per current dancer. Switching formations and refreshing preserves both sets without cross-over or data loss.
3. **Identity preservation:** Renaming a dancer changes the visible label in both formations without changing that dancer's positions or identity.
4. **Animation correctness:** At timeline values 0%, 25%, 50%, 75%, and 100%, every rendered dancer position is within 0.5 screen pixels of the expected linear interpolation under a fixed test viewport.
5. **Playback independence:** Changing playback duration produces identical paths, travel distances, closest-approach times, and conflict results.
6. **Continuous safety accuracy:** Against a test suite including endpoint proximity, mid-transition crossing, parallel paths, zero movement, and near-threshold values, every pair's computed minimum separation and closest-approach time match an analytic reference within `1e-6` stage units and normalized time.
7. **Boundary rule:** A pair at exactly the threshold is reported safe; a pair at least `1e-6` stage units below it is reported unsafe.
8. **Conflict explainability:** Selecting any reported unsafe pair identifies both dancers and displays minimum separation plus the closest-approach time/percentage and location.
9. **Distance accuracy:** Per-dancer, total, and maximum travel values match Euclidean reference calculations within `1e-6` stage units before display rounding.
10. **Recommendation completeness:** For fixtures containing 6–16 dancers, the selected recommendation matches an exhaustive reference evaluation of every eligible pairwise target swap and the documented ranking rules.
11. **Recommendation validity:** A recommendation never changes Formation A, never changes the set of Formation B coordinates, never includes a locked dancer, and always reduces the unsafe-pair count by at least one.
12. **No-improvement behavior:** When no eligible swap reduces the unsafe-pair count, the UI reports that no improving swap was found and Formation B remains byte-for-byte equivalent in stored assignment data.
13. **Preview clarity:** Before acceptance, the UI names both swapped dancers and shows before/after unsafe-pair count, minimum separation, total travel, and individual travel deltas.
14. **Acceptance:** Accepting a preview applies only the proposed two-dancer Formation B exchange, persists it, and refreshes all analysis.
15. **Rejection:** Rejecting a preview changes no stored formation, lock, or analysis input.
16. **Undo:** Immediately undoing an accepted swap restores the exact prior Formation B assignment and derived metrics. If intervening edits make undo unsafe, undo is unavailable with an explanation.
17. **Stale-state safety:** Editing a formation, threshold, roster, or lock state dismisses or invalidates an existing recommendation before it can be accepted.
18. **Performance:** Across 20 runs of a 16-dancer worst-case fixture, at least 95% of completed-edit analyses finish within 200 ms and recommendations within 1 second on the reference device.
19. **Persistence reliability:** In 100 automated save/refresh cycles, all committed formations, locks, threshold values, and accepted swaps reload without corruption.
20. **Accessibility:** All roster, formation, playback, lock, recommendation, accept, reject, and undo controls are operable by keyboard; automated checks report no critical WCAG 2.1 AA violations in the primary journey.
21. **Usability:** In a moderated test, at least 4 of 5 first-time target users complete the eight-dancer primary journey without facilitator intervention in 10 minutes or less.

## MVP Success Signals

These signals guide pilot evaluation but are not launch-blocking functional criteria:

- At least 70% of pilot users complete the primary journey without help.
- At least 60% of projects that contain a modeled conflict result in the user reviewing a recommendation.
- At least 80% of pilot users agree that conflict explanations are understandable.
- Fewer than 5% of accepted recommendations are immediately undone because the proposed change was misunderstood.
- No observed or reported instance presents a non-improving swap as an improving safety recommendation.
