import type { Project } from "./types";

export const sampleProject = {
  id: "project-demo-01",
  name: "Eight-Dancer Demo",
  stage: {
    width: 36,
    depth: 24,
    unit: "feet",
  },
  dancers: [
    { id: "dancer-01", label: "Ari" },
    { id: "dancer-02", label: "Blair" },
    { id: "dancer-03", label: "Casey" },
    { id: "dancer-04", label: "Devon" },
    { id: "dancer-05", label: "Emery" },
    { id: "dancer-06", label: "Frankie" },
    { id: "dancer-07", label: "Gray" },
    { id: "dancer-08", label: "Harper" },
  ],
  formations: [
    {
      id: "formation-a",
      name: "Formation A",
      positions: {
        "dancer-01": { dancerId: "dancer-01", x: 0.2, y: 0.25 },
        "dancer-02": { dancerId: "dancer-02", x: 0.4, y: 0.25 },
        "dancer-03": { dancerId: "dancer-03", x: 0.6, y: 0.25 },
        "dancer-04": { dancerId: "dancer-04", x: 0.8, y: 0.25 },
        "dancer-05": { dancerId: "dancer-05", x: 0.2, y: 0.75 },
        "dancer-06": { dancerId: "dancer-06", x: 0.4, y: 0.75 },
        "dancer-07": { dancerId: "dancer-07", x: 0.6, y: 0.75 },
        "dancer-08": { dancerId: "dancer-08", x: 0.8, y: 0.75 },
      },
    },
    {
      id: "formation-b",
      name: "Formation B",
      positions: {
        "dancer-01": { dancerId: "dancer-01", x: 0.15, y: 0.2 },
        "dancer-02": { dancerId: "dancer-02", x: 0.35, y: 0.4 },
        "dancer-03": { dancerId: "dancer-03", x: 0.55, y: 0.6 },
        "dancer-04": { dancerId: "dancer-04", x: 0.75, y: 0.8 },
        "dancer-05": { dancerId: "dancer-05", x: 0.25, y: 0.8 },
        "dancer-06": { dancerId: "dancer-06", x: 0.45, y: 0.6 },
        "dancer-07": { dancerId: "dancer-07", x: 0.65, y: 0.4 },
        "dancer-08": { dancerId: "dancer-08", x: 0.85, y: 0.2 },
      },
    },
  ],
  transition: {
    id: "transition-a-to-b",
    fromFormationId: "formation-a",
    toFormationId: "formation-b",
    durationMs: 8_000,
  },
  safetyThreshold: 3,
  lockedDancerIds: ["dancer-01"],
} as const satisfies Project;
