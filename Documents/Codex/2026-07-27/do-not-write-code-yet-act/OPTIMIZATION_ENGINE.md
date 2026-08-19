# FormationFlow Optimization Engine

## Purpose

The optimization engine evaluates one narrowly defined change: exchanging the
Formation B target positions of exactly two unlocked dancers. It returns at
most one immutable recommendation preview. It never applies the swap.

The engine is deterministic, implemented in pure TypeScript, and delegates all
proximity and travel calculations to the existing analytical transition-safety
engine. It does not use an LLM, animation frames, rendered SVG coordinates, or
sampling.

## Inputs

The engine receives:

- the transition ID;
- physical stage dimensions and unit;
- the dancer roster;
- Formation A and Formation B;
- the safety threshold; and
- the dancer IDs whose Formation B assignments are locked.

Both formations must contain a valid normalized position for every dancer.
The safety engine enforces these invariants. A lock referencing an unknown
dancer is rejected explicitly.

## Exhaustive candidate generation

The engine sorts unlocked dancer IDs lexicographically and enumerates every
unique pair `(i, j)` where `i < j`. For `u` unlocked dancers, this creates:

`u × (u - 1) / 2`

candidates.

For each candidate, the engine creates a new in-memory Formation B value. The
two dancers retain their stable IDs, but their target `(x, y)` coordinates are
exchanged. All other assignments are shared unchanged. The original Formation
B object and its nested positions are never mutated.

Every candidate is passed to `analyzeTransitionSafety`. A candidate is eligible
only when its unsafe-pair count is strictly lower than the baseline count.
Travel-only improvements are deliberately rejected.

## Lexicographic ranking

Eligible candidates are compared using unrounded values in this exact order:

1. fewer safety conflicts;
2. greater global minimum separation;
3. lower total travel distance;
4. lower longest individual travel distance; and
5. lexicographically smaller sorted dancer-ID pair.

The first unequal metric decides the result. The dancer-ID comparison makes
otherwise identical results stable regardless of input roster ordering. Display
rounding is used only in the explanation and never affects ranking.

## Recommendation output

The returned preview contains:

- the affected dancer IDs;
- each dancer's current and proposed Formation B target;
- before-and-after conflict count, global minimum separation, total travel, and
  longest individual travel;
- each swapped dancer's before-and-after travel distance and signed delta;
- a list of measured metrics that become worse; and
- a deterministic plain-language explanation.

Reducing the conflict count is the eligibility gate, but secondary metrics can
still worsen. Those trade-offs are surfaced rather than hidden.

## Complexity

Safety analysis evaluates every dancer pair, so it is `O(n²)`. The optimizer
evaluates `O(u²)` swaps, producing an overall worst-case complexity of `O(n⁴)`
when all dancers are unlocked. With the MVP limit of 16 dancers, this is at
most 120 candidate analyses and remains intentionally simpler and more
auditable than a heuristic search.

## Limitations

- The engine considers exactly one two-dancer target swap.
- It models simultaneous constant-rate straight-line motion between two
  formations.
- It does not account for body size, momentum, dancer ability, role,
  orientation, obstacles, staggered timing, or artistic intent.
- It optimizes modeled unsafe-pair count, not guaranteed real-world safety.
- It does not apply, accept, reject, persist, or undo recommendations; those are
  separate product interactions.
- Boundary violations are not ranked because normalized in-bounds endpoints and
  straight-line interpolation on a rectangular stage cannot leave that stage.
- Maximum required speed is not ranked because the MVP defines only a shared
  playback duration, not dancer-specific timing or safe-speed limits.
