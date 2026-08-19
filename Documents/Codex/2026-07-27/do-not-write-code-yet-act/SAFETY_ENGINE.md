# FormationFlow Safety Engine Mathematics

## Purpose

The transition-safety engine evaluates simultaneous straight-line movement from
Formation A to Formation B. It is deterministic, independent of React and
animation frames, and analyzes the continuous transition rather than sampling
selected playback frames.

Formation positions are stored as normalized coordinates, but safety thresholds
and travel distances use physical stage units. For a stage with width `W` and
depth `D`, a normalized point `(x, y)` is converted to physical coordinates:

```text
P = (xW, yD)
```

This scaling is required because one normalized horizontal unit and one
normalized depth unit may represent different physical distances.

## Simultaneous linear motion

For dancer `i`, let:

```text
Si = physical start position
Ei = physical end position
Vi = Ei - Si
Pi(t) = Si + tVi, where 0 <= t <= 1
```

All dancers use the same normalized transition time `t`. Playback duration
changes how quickly the UI traverses `t`; it does not change paths or safety
results.

## Minimum simultaneous separation

For dancers 1 and 2, their relative position is:

```text
R(t) = P1(t) - P2(t)
     = (S1 - S2) + t(V1 - V2)
     = A + tB
```

Their squared separation is the quadratic:

```text
f(t) = ||A + tB||²
     = (A + tB) · (A + tB)
```

Minimizing squared distance avoids an unnecessary square root during
optimization and produces the same minimizing time as distance itself. If the
relative velocity is nonzero, the unconstrained minimizer is:

```text
t* = -(A · B) / (B · B)
```

The transition is limited to the inclusive interval `[0, 1]`, so the evaluated
time is:

```text
t_min = clamp(t*, 0, 1)
```

The minimum separation is:

```text
d_min = sqrt(f(t_min))
```

If `B · B` is effectively zero, the dancers have no relative motion: they may
both be stationary or may move with identical velocity. Their separation is
constant, and the engine deterministically reports the earliest minimizing time,
`t_min = 0`.

A pair is a conflict only when:

```text
d_min < safety threshold
```

Equality is safe. No tolerance is added to this threshold comparison.

This analytic calculation directly handles:

- stationary dancers;
- one stationary and one moving dancer;
- identical start positions;
- identical end positions;
- parallel motion with equal or different velocities;
- endpoint minima; and
- interior closest approaches.

## Travel distance

Each dancer's travel distance is the Euclidean length of their physical
displacement:

```text
travel_i = ||Ei - Si||
```

The engine also returns:

```text
total travel = sum(travel_i)
longest travel = max(travel_i)
```

All calculations use unrounded values. Display rounding belongs to the UI.

## Geometric path intersections

Path intersection is informational and is not a safety result. A geometric
intersection asks whether the two line segments share a point, regardless of
when each dancer reaches it.

For normalized path segments:

```text
L1(a) = P + aR
L2(b) = Q + bS
0 <= a <= 1
0 <= b <= 1
```

Using the two-dimensional scalar cross product:

```text
cross((x1, y1), (x2, y2)) = x1y2 - y1x2
```

For nonparallel segments:

```text
a = cross(Q - P, S) / cross(R, S)
b = cross(Q - P, R) / cross(R, S)
```

The paths intersect when both parameters are in `[0, 1]`. The engine reports the
intersection point and both individual path parameters. If `a != b`, the paths
cross geometrically at different times and that fact alone is not a collision.
Safety still comes from the simultaneous relative-motion calculation above.

Parallel non-collinear paths do not intersect. Collinear paths may touch at one
point or overlap over an interval. A unique touch is reported as a point
intersection; a nonzero shared interval is reported as an overlap with its two
normalized endpoints.

Zero-length paths are treated as points. Two identical stationary points
intersect at that point, while a stationary point on another dancer's segment
is reported with its corresponding segment parameter.

## Numerical policy

The engine uses a numerical tolerance of `1e-12` only for geometric degeneracy:

- deciding whether relative velocity is effectively zero;
- deciding whether lines are parallel or collinear;
- accepting segment parameters infinitesimally outside `[0, 1]` because of
  floating-point arithmetic; and
- distinguishing a point touch from a nonzero collinear overlap.

Accepted segment parameters are clamped back to exact `0` or `1`.

The tolerance is not used to change the safety threshold rule. Minimum
separation is compared directly with the configured threshold, so a value
exactly equal to the threshold is safe.
