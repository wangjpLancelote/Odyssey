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
  nextChapterId: z.string().optional(),
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
  storylineId: z.string(),
  chapterId: z.string(),
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

export const audioBusSchema = z.enum(["master", "bgm", "sfx", "voice", "ambient"]);
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

export const chapterTimelineItemSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  prevId: z.string().nullable(),
  nextId: z.string().nullable(),
  enabled: z.boolean(),
  title: z.string()
});
export type ChapterTimelineItem = z.infer<typeof chapterTimelineItemSchema>;

export const chapterTimelineSchema = z.object({
  storylineId: z.string(),
  chapters: z.array(chapterTimelineItemSchema)
});
export type ChapterTimeline = z.infer<typeof chapterTimelineSchema>;

export const chapterCutsceneMetaSchema = z.object({
  cutsceneId: z.string(),
  sceneId: z.string(),
  planFile: z.string()
});
export type ChapterCutsceneMeta = z.infer<typeof chapterCutsceneMetaSchema>;

export const chapterAssetPreloadPrioritySchema = z.enum(["critical", "high", "normal", "low"]);
export type ChapterAssetPreloadPriority = z.infer<typeof chapterAssetPreloadPrioritySchema>;

export const chapterAssetAudioBusSchema = z.enum(["bgm", "sfx", "voice", "ambient"]);
export type ChapterAssetAudioBus = z.infer<typeof chapterAssetAudioBusSchema>;

export const audioAssetSchema = z.object({
  id: z.string(),
  bus: chapterAssetAudioBusSchema,
  path: z.string(),
  loop: z.boolean().default(false),
  defaultVolume: z.number().min(0).max(1).default(1),
  preloadPriority: chapterAssetPreloadPrioritySchema.default("normal")
});
export type AudioAsset = z.infer<typeof audioAssetSchema>;

export const videoAssetSchema = z.object({
  id: z.string(),
  kind: z.enum(["cutscene", "transition", "scene_bg"]),
  path: z.string(),
  poster: z.string().optional(),
  preloadPriority: chapterAssetPreloadPrioritySchema.default("normal")
});
export type VideoAsset = z.infer<typeof videoAssetSchema>;

export const imageAssetSchema = z.object({
  id: z.string(),
  path: z.string(),
  preloadPriority: chapterAssetPreloadPrioritySchema.default("normal")
});
export type ImageAsset = z.infer<typeof imageAssetSchema>;

export const spriteAssetSchema = z.object({
  id: z.string(),
  path: z.string(),
  preloadPriority: chapterAssetPreloadPrioritySchema.default("normal")
});
export type SpriteAsset = z.infer<typeof spriteAssetSchema>;

export const sceneEnterTriggerSchema = z.object({
  type: z.literal("scene_enter"),
  sceneId: z.string(),
  audioIds: z.array(z.string()).default([]),
  videoIds: z.array(z.string()).default([])
});
export type SceneEnterTrigger = z.infer<typeof sceneEnterTriggerSchema>;

export const nodeEnterTriggerSchema = z.object({
  type: z.literal("node_enter"),
  nodeId: z.string(),
  audioIds: z.array(z.string()).default([]),
  videoIds: z.array(z.string()).default([]),
  dedupeOnce: z.boolean().default(true)
});
export type NodeEnterTrigger = z.infer<typeof nodeEnterTriggerSchema>;

export const timelineCueTriggerSchema = z.object({
  type: z.literal("timeline_cue"),
  cueId: z.string(),
  audioIds: z.array(z.string()).default([]),
  videoIds: z.array(z.string()).default([])
});
export type TimelineCueTrigger = z.infer<typeof timelineCueTriggerSchema>;

export const assetTriggerSchema = z.discriminatedUnion("type", [
  sceneEnterTriggerSchema,
  nodeEnterTriggerSchema,
  timelineCueTriggerSchema
]);
export type AssetTrigger = z.infer<typeof assetTriggerSchema>;

export const chapterAssetManifestV2Schema = z.object({
  version: z.literal("2"),
  baseKey: z.string(),
  audio: z.array(audioAssetSchema).default([]),
  video: z.array(videoAssetSchema).default([]),
  image: z.array(imageAssetSchema).default([]),
  sprite: z.array(spriteAssetSchema).default([]),
  triggers: z
    .object({
      sceneEnter: z.array(sceneEnterTriggerSchema).default([]),
      nodeEnter: z.array(nodeEnterTriggerSchema).default([]),
      timelineCue: z.array(timelineCueTriggerSchema).default([])
    })
    .default({
      sceneEnter: [],
      nodeEnter: [],
      timelineCue: []
    })
});
export type ChapterAssetManifestV2 = z.infer<typeof chapterAssetManifestV2Schema>;

export const chapterAssetLegacyManifestSchema = z.object({
  images: z.array(z.string()).default([]),
  audios: z.array(z.string()).default([]),
  sprites: z.array(z.string()).default([])
});
export type ChapterAssetLegacyManifest = z.infer<typeof chapterAssetLegacyManifestSchema>;

export const assetResolutionSourceSchema = z.enum(["local", "r2"]);
export type AssetResolutionSource = z.infer<typeof assetResolutionSourceSchema>;

export const resolvedAssetRefSchema = z.object({
  id: z.string(),
  kind: z.enum(["audio", "video", "image", "sprite"]),
  source: assetResolutionSourceSchema,
  path: z.string(),
  url: z.string()
});
export type ResolvedAssetRef = z.infer<typeof resolvedAssetRefSchema>;

function assetIdFromPath(assetPath: string, fallbackPrefix: string, index: number): string {
  const normalized = assetPath.split("?")[0]?.split("#")[0] ?? "";
  const fileName = normalized.split("/").filter(Boolean).at(-1) ?? `${fallbackPrefix}-${index + 1}`;
  const withoutExt = fileName.replace(/\.[a-z0-9]+$/i, "");
  return withoutExt || `${fallbackPrefix}-${index + 1}`;
}

function inferBaseKeyFromLegacyPaths(paths: string[]): string {
  for (const rawPath of paths) {
    const seg = rawPath.split("/").filter(Boolean);
    if (seg.length >= 3 && ["images", "audio", "sprites"].includes(seg[0] ?? "")) {
      return `${seg[1] ?? "fire-dawn"}/${seg[2] ?? "ch01"}`;
    }
  }

  return "fire-dawn/ch01";
}

function inferLegacyAudioBus(rawPath: string): ChapterAssetAudioBus {
  const fileName = rawPath.split("/").filter(Boolean).at(-1)?.toLowerCase() ?? "";
  if (fileName.startsWith("bgm-")) return "bgm";
  if (fileName.startsWith("voice-")) return "voice";
  if (fileName.startsWith("ambient-")) return "ambient";
  return "sfx";
}

function toLegacyRelativePath(kind: "audio" | "image" | "sprite", rawPath: string): string {
  const seg = rawPath.split("/").filter(Boolean);
  const fileName = seg.at(-1) ?? rawPath;

  if (kind === "image") return `image/${fileName}`;
  if (kind === "sprite") return `sprite/${fileName}`;

  const bus = inferLegacyAudioBus(rawPath);
  return `audio/${bus}/${fileName}`;
}

export const chapterResourceManifestSchema = z
  .union([chapterAssetManifestV2Schema, chapterAssetLegacyManifestSchema])
  .transform((manifest): ChapterAssetManifestV2 => {
    if ("version" in manifest) {
      return manifest;
    }

    const allPaths = [...manifest.images, ...manifest.audios, ...manifest.sprites];
    const baseKey = inferBaseKeyFromLegacyPaths(allPaths);

    return {
      version: "2",
      baseKey,
      audio: manifest.audios.map((rawPath, index) => ({
        id: assetIdFromPath(rawPath, "audio", index),
        bus: inferLegacyAudioBus(rawPath),
        path: toLegacyRelativePath("audio", rawPath),
        loop: inferLegacyAudioBus(rawPath) === "bgm" || inferLegacyAudioBus(rawPath) === "ambient",
        defaultVolume: inferLegacyAudioBus(rawPath) === "sfx" ? 0.85 : 0.6,
        preloadPriority:
          inferLegacyAudioBus(rawPath) === "bgm" || inferLegacyAudioBus(rawPath) === "ambient" ? "critical" : "high"
      })),
      video: [],
      image: manifest.images.map((rawPath, index) => ({
        id: assetIdFromPath(rawPath, "image", index),
        path: toLegacyRelativePath("image", rawPath),
        preloadPriority: "high"
      })),
      sprite: manifest.sprites.map((rawPath, index) => ({
        id: assetIdFromPath(rawPath, "sprite", index),
        path: toLegacyRelativePath("sprite", rawPath),
        preloadPriority: "high"
      })),
      triggers: {
        sceneEnter: [],
        nodeEnter: [],
        timelineCue: []
      }
    };
  });
export type ChapterResourceManifest = z.infer<typeof chapterResourceManifestSchema>;

export const chapterMetaSchema = z.object({
  storylineId: z.string(),
  chapterId: z.string(),
  slug: z.string(),
  title: z.string(),
  startNodeId: z.string(),
  cutscenes: z.array(chapterCutsceneMetaSchema),
  scenes: z.array(z.string())
});
export type ChapterMeta = z.infer<typeof chapterMetaSchema>;

export const displayNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(12)
  .regex(/^[\u4E00-\u9FFFA-Za-z0-9_]+$/u, "invalid_display_name");
export type DisplayName = z.infer<typeof displayNameSchema>;

export const startSessionRequestSchema = z.object({
  displayName: displayNameSchema,
  storylineId: z.string().default("fire-dawn"),
  chapterId: z.string().default("ch01")
});
export type StartSessionRequest = z.infer<typeof startSessionRequestSchema>;

export const recallSessionRequestSchema = z.object({
  displayName: displayNameSchema
});
export type RecallSessionRequest = z.infer<typeof recallSessionRequestSchema>;

export const recallSessionErrorSchema = z.object({
  error: z.enum(["name_not_found", "no_active_session"])
});
export type RecallSessionError = z.infer<typeof recallSessionErrorSchema>;

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

export const restoreFootprintResponseSchema = z.object({
  session: z.any(),
  node: z.any(),
  resourceReloadedChapter: z.string().nullable().optional()
});
export type RestoreFootprintResponse = z.infer<typeof restoreFootprintResponseSchema>;

export const triggerSideQuestRequestSchema = z.object({
  sessionId: z.string(),
  nodeId: z.string()
});
export type TriggerSideQuestRequest = z.infer<typeof triggerSideQuestRequestSchema>;

export const playCutsceneRequestSchema = z.object({
  sessionId: z.string(),
  cutsceneId: z.string().optional(),
  sceneId: z.string().optional()
});
export type PlayCutsceneRequest = z.infer<typeof playCutsceneRequestSchema>;

export const chapterEnterRequestSchema = z.object({
  sessionId: z.string(),
  toChapterId: z.string()
});
export type ChapterEnterRequest = z.infer<typeof chapterEnterRequestSchema>;

export const chapterTimelineRequestSchema = z.object({
  storylineId: z.string().default("fire-dawn")
});
export type ChapterTimelineRequest = z.infer<typeof chapterTimelineRequestSchema>;

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
  storylineId: z.string(),
  chapterId: z.string(),
  currentNodeId: z.string(),
  status: z.enum(["ACTIVE", "PAUSED", "FINISHED"]),
  dayNight: z.enum(["DAY", "NIGHT"]),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type GameSession = z.infer<typeof gameSessionSchema>;
