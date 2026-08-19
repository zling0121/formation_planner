export { sampleProject } from "./sample-project";
export {
  clampNormalizedCoordinate,
  clampNormalizedPoint,
  normalizedToScreen,
  screenToNormalized,
} from "./coordinates";
export type { ScreenPoint, ScreenRectangle } from "./coordinates";
export {
  acceptTargetSwapRecommendation,
  copyFormationAToB,
  createFormationEditorState,
  getActiveFormation,
  moveDancer,
  previewTargetSwapRecommendation,
  redoAcceptedRecommendation,
  redoPositionChange,
  renameFormation,
  resetFormationPositions,
  switchFormation,
  undoAcceptedRecommendation,
  undoPositionChange,
} from "./formation-editor";
export type {
  AcceptedRecommendationChange,
  FormationEditorState,
  PositionChange,
} from "./formation-editor";
export {
  compareRecommendationRanks,
  identifyWorsenedRecommendationMetrics,
  recommendTargetPositionSwap,
} from "./optimization-engine";
export type {
  RecommendationRank,
  TargetSwapRecommendationInput,
} from "./optimization-engine";
export {
  loadProjectFromStorage,
  parseStoredProject,
  PROJECT_STORAGE_KEY,
  PROJECT_STORAGE_VERSION,
  saveProjectToStorage,
  serializeStoredProject,
} from "./project-storage";
export type {
  StoredProjectEnvelope,
  StoredProjectLoadResult,
  StoredProjectParseResult,
} from "./project-storage";
export {
  analyzeTransitionSafety,
  SAFETY_ENGINE_TOLERANCE,
} from "./safety-engine";
export type { TransitionSafetyInput } from "./safety-engine";
export {
  calculateAnimationProgress,
  clampTransitionProgress,
  getRestartedTransitionProgress,
  interpolateFormationPositions,
  interpolatePosition,
  parseScrubberProgress,
} from "./transition-playback";
export type { ScrubberProgressResult } from "./transition-playback";
export {
  calculateStageTravelDistance,
  isEffectivelyStationaryTransition,
  isEffectivelyStationaryTravelDistance,
  STATIONARY_TRAVEL_DISTANCE_TOLERANCE,
} from "./travel-distance";
export type {
  AnalysisResult,
  Dancer,
  DancerId,
  DancerPosition,
  DancerTravelDistanceChange,
  Formation,
  FormationId,
  NormalizedCoordinate,
  NormalizedPoint,
  OverlapPathIntersection,
  PairSafetyResult,
  PathIntersection,
  PointPathIntersection,
  Project,
  ProjectId,
  Recommendation,
  RecommendationId,
  RecommendationMetricName,
  RecommendationMetrics,
  SafetyConflict,
  Stage,
  StageUnit,
  TargetPositionChange,
  Transition,
  TransitionId,
} from "./types";
export {
  isNormalizedCoordinate,
  validateFormation,
  validateProject,
  validateStage,
} from "./validation";
export type {
  ValidationIssue,
  ValidationIssueCode,
  ValidationResult,
} from "./validation";
