# FormationFlow Repository Instructions

These instructions apply to the entire repository. Follow them before making changes.

## Product Scope

1. Read `PRODUCT_SPEC.md` before changing product behavior, user flows, domain rules, safety calculations, or recommendation behavior.
2. Preserve the MVP scope defined in `PRODUCT_SPEC.md`. Do not add out-of-scope features under the guise of infrastructure, convenience, or future-proofing.
3. If `PRODUCT_SPEC.md` is missing, incomplete, or conflicts with a request, stop and explain the conflict. Do not reconstruct product requirements from assumptions.
4. State every material assumption. Put user-facing or domain assumptions in the relevant specification or decision record, and mention implementation assumptions in the handoff.
5. Do not add authentication, a database, or other excluded capabilities unless the user explicitly changes the scope.

## Architecture and Domain Logic

1. Keep TypeScript strict mode enabled. Do not weaken `strict`, add broad type suppressions, or use `any` to bypass modeling work.
2. Keep geometry, safety calculations, travel-distance calculations, and optimization logic separate from React components, hooks, and rendering code.
3. Domain logic must be usable and testable without a browser or React runtime.
4. Prefer deterministic algorithms for all safety and recommendation calculations. Identical inputs must produce identical outputs.
5. Never use an LLM to calculate dancer collisions, proximity, travel distance, geometry, swap rankings, or other safety-related results.
6. Do not make safety calculations depend on animation frames, rendering cadence, playback speed, or DOM measurements.
7. Never silently swallow errors. Handle an error explicitly by returning a typed failure, showing an appropriate user-facing state, logging it at the correct boundary, or rethrowing it with useful context.
8. Avoid empty `catch` blocks and catch-all fallbacks that make corrupted or incomplete state look valid.

## Dependencies

1. Do not add a dependency without a specific, documented justification.
2. Before adding one, consider the platform APIs and existing dependencies.
3. Record dependencies that materially affect architecture, security, bundle size, persistence, or product behavior in `DECISIONS.md`.
4. Pin compatible stable versions and update the lockfile when dependencies change.
5. Do not introduce an authentication provider, database client, analytics SDK, AI service, geometry engine, or optimization library without explicit approval.

## Tests and Verification

1. Add or update tests whenever behavior changes.
2. Put deterministic domain logic under focused unit tests, including boundary conditions, degeneracies, and tie-breaking rules.
3. Add or update Playwright coverage when a user-visible flow changes.
4. Before declaring work complete, run:

   ```sh
   pnpm lint
   pnpm test
   pnpm build
   ```

5. Run `pnpm test:e2e` when user-visible behavior, routing, or application integration changes.
6. Report the exact commands run and their results. If a required command cannot run, state the blocker and do not describe the work as fully validated.

## Working in the Repository

1. Preserve unrelated user changes, including uncommitted changes. Inspect the working tree before editing and avoid broad rewrites.
2. Never discard, reset, overwrite, or reformat unrelated work.
3. Prefer small, reviewable changes that match the existing structure and conventions.
4. Do not change application functionality when a request is limited to documentation, tooling, analysis, or configuration.
5. Update `DECISIONS.md` when making or reversing a major technical decision.
6. Explain assumptions, tradeoffs, validation performed, and any remaining risks in the final handoff.
