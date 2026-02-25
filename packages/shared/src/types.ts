import { z } from "zod";

export const rankSchema = z.enum(["S", "A", "B", "C", "D"]);
export type Rank = z.infer<typeof rankSchema>;

export const bloodlineSchema = z.object({
  purity: z.number().min(0).max(100),
  stability: z.number().min(0).max(100),
  corruption: z.number().min(0).max(100)
});
export type BloodlineState = z.infer<typeof bloodlineSchema>;

export const wordSpiritSchema = z.object({
  code: z.string(),
  title: z.string(),
  tier: z.number().min(1).max(10),
  cooldownMs: z.number().int().nonnegative(),
  cost: z.number().int().nonnegative()
});
export type WordSpirit = z.infer<typeof wordSpiritSchema>;

export const dialogueChoiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  nextNodeId: z.string(),
  branchTag: z.string().optional()
});
export type DialogueChoice = z.infer<typeof dialogueChoiceSchema>;

export const dialogueNodeSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  content: z.string(),
  sceneId: z.string(),
  choices: z.array(dialogueChoiceSchema),
  checkpoint: z.boolean().default(false)
});
export type DialogueNode = z.infer<typeof dialogueNodeSchema>;

export const chapterSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  introCutsceneId: z.string(),
  sceneOrder: z.array(z.string()),
  startNodeId: z.string()
});
export type Chapter = z.infer<typeof chapterSchema>;

export const plotEdgeSchema = z.object({
  fromNodeId: z.string(),
  toNodeId: z.string(),
  choiceId: z.string(),
  createdAt: z.string()
});
export type PlotEdge = z.infer<typeof plotEdgeSchema>;

export const footprintCheckpointSchema = z.object({
  checkpointId: z.string(),
  sessionId: z.string(),
  nodeId: z.string(),
  plotCursor: z.string(),
  createdAt: z.string(),
  metadata: z.record(z.any()).default({})
});
export type FootprintCheckpoint = z.infer<typeof footprintCheckpointSchema>;

export const footprintMapSchema = z.object({
  sessionId: z.string(),
  playerId: z.string(),
  checkpoints: z.array(footprintCheckpointSchema),
  visitedNodeIds: z.array(z.string())
});
export type FootprintMap = z.infer<typeof footprintMapSchema>;

export const sideQuestStateSchema = z.enum([
  "IDLE",
  "ELIGIBLE",
  "GENERATING",
  "ACTIVE",
  "RESOLVED",
  "FAILED"
]);
export type SideQuestState = z.infer<typeof sideQuestStateSchema>;

export const sideQuestCandidateSchema = z.object({
  questId: z.string(),
  title: z.string(),
  hook: z.string(),
  startNodeId: z.string(),
  resolution: z.string(),
  riskFlags: z.array(z.string()).default([])
});
export type SideQuestCandidate = z.infer<typeof sideQuestCandidateSchema>;

export const audioBusSchema = z.enum(["master", "bgm", "sfx", "voice"]);
export type AudioBus = z.infer<typeof audioBusSchema>;

export const audioCueSchema = z.object({
  id: z.string(),
  bus: audioBusSchema,
  src: z.string(),
  volume: z.number().min(0).max(1),
  fadeInMs: z.number().int().nonnegative().default(0),
  fadeOutMs: z.number().int().nonnegative().default(0),
  atMs: z.number().int().nonnegative()
});
export type AudioCue = z.infer<typeof audioCueSchema>;

export const timelineStepSchema = z.object({
  id: z.string(),
  kind: z.enum(["camera", "layer", "ui", "effect"]),
  target: z.string(),
  durationMs: z.number().int().positive(),
  atMs: z.number().int().nonnegative(),
  priority: z.number().int().default(0),
  ease: z.string().default("power2.out"),
  from: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  to: z.record(z.union([z.string(), z.number(), z.boolean()])).default({})
});
export type TimelineStep = z.infer<typeof timelineStepSchema>;

export const cutsceneTimelineSpecSchema = z.object({
  cutsceneId: z.string(),
  sceneId: z.string(),
  motions: z.array(timelineStepSchema),
  audios: z.array(audioCueSchema),
  meta: z
    .object({
      dslVersion: z.string(),
      compiledAt: z.string(),
      sourceHash: z.string(),
      warnings: z.array(z.string()).default([])
    })
    .default({
      dslVersion: "legacy",
      compiledAt: new Date(0).toISOString(),
      sourceHash: "legacy",
      warnings: []
    })
});
export type CutsceneTimelineSpec = z.infer<typeof cutsceneTimelineSpecSchema>;

export const sceneAvProfileSchema = z.object({
  sceneId: z.string(),
  daylightTheme: z.string(),
  nightTheme: z.string(),
  defaultBgmBusVolume: z.number().min(0).max(1),
  defaultSfxBusVolume: z.number().min(0).max(1),
  defaultVoiceBusVolume: z.number().min(0).max(1)
});
export type SceneAVProfile = z.infer<typeof sceneAvProfileSchema>;

export const conditionAtomSchema = z.object({
  dayNight: z.enum(["DAY", "NIGHT"]).optional(),
  branchTag: z.string().optional()
});
export type ConditionAtom = z.infer<typeof conditionAtomSchema>;

export const overridePatchSchema = z.object({
  atomId: z.string(),
  field: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()])
});
export type OverridePatch = z.infer<typeof overridePatchSchema>;

export const storyboardModuleSchema = z.object({
  moduleId: z.string(),
  motions: z.array(timelineStepSchema),
  audios: z.array(audioCueSchema)
});
export type StoryboardModule = z.infer<typeof storyboardModuleSchema>;

export const moduleInstanceSchema = z.object({
  instanceId: z.string(),
  moduleId: z.string(),
  offsetMs: z.number().int(),
  when: conditionAtomSchema.optional(),
  overrides: z.array(overridePatchSchema).default([])
});
export type ModuleInstance = z.infer<typeof moduleInstanceSchema>;

export const sceneStoryboardPlanSchema = z.object({
  dslVersion: z.string().default("1"),
  sceneId: z.string(),
  cutsceneId: z.string(),
  instances: z.array(moduleInstanceSchema)
});
export type SceneStoryboardPlan = z.infer<typeof sceneStoryboardPlanSchema>;

export const compileContextSchema = z.object({
  dayNight: z.enum(["DAY", "NIGHT"]),
  branchTag: z.string().optional()
});
export type CompileContext = z.infer<typeof compileContextSchema>;

export const compiledSceneTimelineSchema = z.object({
  cutsceneId: z.string(),
  sceneId: z.string(),
  motions: z.array(timelineStepSchema),
  audios: z.array(audioCueSchema),
  meta: z.object({
    dslVersion: z.string(),
    compiledAt: z.string(),
    sourceHash: z.string(),
    warnings: z.array(z.string())
  })
});
export type CompiledSceneTimeline = z.infer<typeof compiledSceneTimelineSchema>;

export const displayNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(12)
  .regex(/^[\u4E00-\u9FFFA-Za-z0-9_]+$/u, "invalid_display_name");
export type DisplayName = z.infer<typeof displayNameSchema>;

export const startSessionRequestSchema = z.object({
  displayName: displayNameSchema,
  chapterSlug: z.string().default("cassell-intro")
});
export type StartSessionRequest = z.infer<typeof startSessionRequestSchema>;

export const sessionTokenSchema = z.object({
  sessionToken: z.string().min(16)
});
export type SessionToken = z.infer<typeof sessionTokenSchema>;

export const nameSuggestResponseSchema = z.object({
  suggestions: z.array(displayNameSchema)
});
export type NameSuggestResponse = z.infer<typeof nameSuggestResponseSchema>;

export const nameConflictResponseSchema = z.object({
  error: z.literal("name_conflict"),
  suggestions: z.array(displayNameSchema)
});
export type NameConflictResponse = z.infer<typeof nameConflictResponseSchema>;

export const advanceDialogueRequestSchema = z.object({
  sessionId: z.string()
});
export type AdvanceDialogueRequest = z.infer<typeof advanceDialogueRequestSchema>;

export const commitChoiceRequestSchema = z.object({
  sessionId: z.string(),
  choiceId: z.string()
});
export type CommitChoiceRequest = z.infer<typeof commitChoiceRequestSchema>;

export const restoreFootprintRequestSchema = z.object({
  sessionId: z.string(),
  checkpointId: z.string()
});
export type RestoreFootprintRequest = z.infer<typeof restoreFootprintRequestSchema>;

export const triggerSideQuestRequestSchema = z.object({
  sessionId: z.string(),
  nodeId: z.string()
});
export type TriggerSideQuestRequest = z.infer<typeof triggerSideQuestRequestSchema>;

export const playCutsceneRequestSchema = z.object({
  sessionId: z.string(),
  cutsceneId: z.string(),
  sceneId: z.string()
});
export type PlayCutsceneRequest = z.infer<typeof playCutsceneRequestSchema>;

export const sideQuestMachineInputSchema = z.object({
  sessionId: z.string(),
  playerId: z.string(),
  chapterId: z.string(),
  nodeId: z.string(),
  rank: rankSchema,
  bloodline: bloodlineSchema,
  prohibitedCanonRules: z.array(z.string())
});
export type SideQuestMachineInput = z.infer<typeof sideQuestMachineInputSchema>;

export const sideQuestMachineOutputSchema = z.object({
  nextState: sideQuestStateSchema,
  candidateBranches: z.array(sideQuestCandidateSchema),
  riskFlags: z.array(z.string()),
  canonChecks: z.array(z.string())
});
export type SideQuestMachineOutput = z.infer<typeof sideQuestMachineOutputSchema>;

export const queueTaskTypeSchema = z.enum([
  "AI_SIDEQUEST_GENERATE",
  "ASSET_PREWARM",
  "TELEMETRY_AGGREGATE"
]);
export type QueueTaskType = z.infer<typeof queueTaskTypeSchema>;

export const queueTaskSchema = z.object({
  id: z.string(),
  type: queueTaskTypeSchema,
  payload: z.record(z.any()),
  dedupeKey: z.string(),
  attempts: z.number().int().nonnegative(),
  status: z.enum(["PENDING", "PROCESSING", "DONE", "FAILED"]),
  createdAt: z.string()
});
export type QueueTask = z.infer<typeof queueTaskSchema>;

export const tuningConfigSchema = z.object({
  sideQuestTriggerRate: z.number().min(0).max(1),
  canonStrictness: z.number().min(0).max(1),
  animationPace: z.number().min(0.5).max(2),
  voiceLineMaxLength: z.number().int().positive()
});
export type TuningConfig = z.infer<typeof tuningConfigSchema>;

export const telemetryEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  playerId: z.string(),
  sessionId: z.string(),
  attributes: z.record(z.any()),
  occurredAt: z.string()
});
export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;

export const gameSessionSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  displayName: displayNameSchema,
  chapterId: z.string(),
  currentNodeId: z.string(),
  status: z.enum(["ACTIVE", "PAUSED", "FINISHED"]),
  dayNight: z.enum(["DAY", "NIGHT"]),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type GameSession = z.infer<typeof gameSessionSchema>;
