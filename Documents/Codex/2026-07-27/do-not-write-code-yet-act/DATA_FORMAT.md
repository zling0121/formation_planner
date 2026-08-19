# FormationFlow Local Data Format

FormationFlow stores the most recently edited project in the browser's local
storage under the key `formationflow.project`.

## Current envelope

The current storage version is `1`. The value is UTF-8 JSON with this shape:

```json
{
  "version": 1,
  "savedAt": "2026-07-30T12:00:00.000Z",
  "project": {
    "id": "project-demo-01",
    "name": "Eight-Dancer Demo",
    "stage": {
      "width": 36,
      "depth": 24,
      "unit": "feet"
    },
    "dancers": [],
    "formations": [],
    "transition": {
      "id": "transition-a-to-b",
      "fromFormationId": "formation-a",
      "toFormationId": "formation-b",
      "durationMs": 8000
    },
    "safetyThreshold": 3,
    "lockedDancerIds": []
  }
}
```

The abbreviated empty arrays above document the envelope, not a valid project.
A valid project must satisfy `PRODUCT_SPEC.md` and the runtime rules enforced by
`validateProject`, including:

- 6–16 dancers with stable, unique IDs and unique non-empty labels;
- exactly two formations, each with one normalized position per dancer;
- normalized `x` and `y` coordinates in the inclusive range `0` through `1`;
- valid formation references in the transition;
- positive stage dimensions, transition duration, and safety threshold; and
- locks that reference existing dancers without duplicates.

## Loading and validation

FormationFlow parses the JSON, validates the envelope version and `savedAt`
timestamp, migrates supported older data, and then validates the complete
project before loading it. Invalid or unsupported data is not loaded,
overwritten, or silently discarded. The editor shows an explicit error so the
user can export or inspect browser storage, import a valid project, or choose
**Reset demo project**.

## Migration

Version `0` is the only legacy version supported by the MVP migration layer. A
version-0 project may omit `lockedDancerIds`; migration adds an empty lock list
and then runs full project validation. Existing lock data is preserved and must
validate. Successful migration is saved back in version-1 format.

Unknown future versions are rejected rather than guessed.

## Import and export

Export downloads the same versioned envelope as formatted JSON. Import accepts
version `1` or supported version `0` envelopes only. Imported data is migrated
and validated before it replaces the current project or browser storage.

Formation histories, pending recommendations, playback progress, and analysis
results are derived session state and are not stored. The two formations,
transition duration, dancer locks, stage, roster, and safety threshold are part
of the persisted `project`.
