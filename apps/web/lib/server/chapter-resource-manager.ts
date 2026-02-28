import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { ChapterRegistry, ChapterTimelineError } from "@odyssey/domain";
import { compileSceneTimeline } from "@odyssey/scene-dsl";
import {
  chapterMetaSchema,
  chapterIntroPanelsSchema,
  chapterResourceManifestSchema,
  chapterTimelineSchema,
  compileContextSchema,
  dialogueChoiceSchema,
  dialogueNodeSchema,
  sceneStoryboardPlanSchema,
  storyboardModuleSchema,
  type ChapterCutsceneMeta,
  type ChapterIntroPanels,
  type ChapterMeta,
  type ChapterResourceManifest,
  type ChapterTimeline,
  type CompiledSceneTimeline,
  type DialogueNode,
  type ResolvedAssetRef,
  type SceneStoryboardPlan,
  type StoryboardModule
} from "@odyssey/shared";
import { resolveAssetRef } from "@/lib/asset-resolver";
import { z } from "zod";

function resolveWorkspaceRoot(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), "../..")];
  for (const candidate of candidates) {
    if (existsSync(path.resolve(candidate, "docs/chapters"))) {
      return candidate;
    }
  }

  return process.cwd();
}

const workspaceRoot = resolveWorkspaceRoot();
const chaptersRoot = path.resolve(workspaceRoot, "docs/chapters");

const rawChapterNodeSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  speaker: z.string(),
  content: z.string(),
  checkpoint: z.boolean().optional()
});

const rawChapterChoiceSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  label: z.string(),
  nextNodeId: z.string(),
  nextChapterId: z.string().optional(),
  branchTag: z.string().optional()
});

type RawChapterNode = z.infer<typeof rawChapterNodeSchema>;
type RawChapterChoice = z.infer<typeof rawChapterChoiceSchema>;

export type ChapterBundle = {
  storylineId: string;
  chapterId: string;
  meta: ChapterMeta;
  resources: ChapterResourceManifest;
  assetManifest: ChapterResourceManifest;
  criticalPreloadAssets: ResolvedAssetRef[];
  nodes: Record<string, DialogueNode>;
  orderedNodeIds: string[];
  modulesById: Map<string, StoryboardModule>;
  plansByCutsceneId: Map<string, SceneStoryboardPlan>;
};

async function readJsonFile<T>(absolutePath: string): Promise<T> {
  const raw = await readFile(absolutePath, "utf8");
  return JSON.parse(raw) as T;
}

function normalizeChapterError(error: unknown): never {
  if (error instanceof ChapterTimelineError) {
    if (error.message.startsWith("chapter_not_found:")) {
      throw new Error("chapter_not_found");
    }
  }

  throw error;
}

function preloadScore(priority: "critical" | "high" | "normal" | "low"): number {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "normal") return 2;
  return 1;
}

function buildCriticalPreloadAssets(params: {
  storylineId: string;
  chapterId: string;
  manifest: ChapterResourceManifest;
}): ResolvedAssetRef[] {
  const { storylineId, chapterId, manifest } = params;
  const byAudioId = new Map(manifest.audio.map((item) => [item.id, item]));
  const byVideoId = new Map(manifest.video.map((item) => [item.id, item]));
  const resolved = new Map<string, ResolvedAssetRef>();

  function pushResolved(ref: ResolvedAssetRef): void {
    resolved.set(`${ref.kind}:${ref.id}`, ref);
  }

  function pushAudioById(id: string): void {
    const item = byAudioId.get(id);
    if (!item) return;
    pushResolved(
      resolveAssetRef({
        id: item.id,
        kind: "audio",
        assetPath: item.path,
        storylineId,
        chapterId,
        baseKey: manifest.baseKey
      })
    );
  }

  function pushVideoById(id: string): void {
    const item = byVideoId.get(id);
    if (!item) return;
    pushResolved(
      resolveAssetRef({
        id: item.id,
        kind: "video",
        assetPath: item.path,
        storylineId,
        chapterId,
        baseKey: manifest.baseKey
      })
    );
  }

  const firstSceneEnter = manifest.triggers.sceneEnter[0];
  for (const audioId of firstSceneEnter?.audioIds ?? []) {
    pushAudioById(audioId);
  }
  for (const videoId of firstSceneEnter?.videoIds ?? []) {
    pushVideoById(videoId);
  }

  for (const item of manifest.audio.filter((asset) => preloadScore(asset.preloadPriority) >= 3)) {
    pushAudioById(item.id);
  }

  for (const item of manifest.video.filter((asset) => preloadScore(asset.preloadPriority) >= 3)) {
    pushVideoById(item.id);
  }

  return [...resolved.values()];
}

export class ChapterResourceManager {
  private readonly registryCache = new Map<string, Promise<ChapterRegistry>>();
  private readonly bundleCache = new Map<string, Promise<ChapterBundle>>();
  private readonly introCache = new Map<string, Promise<ChapterIntroPanels | null>>();

  async getRegistry(storylineId: string): Promise<ChapterRegistry> {
    const cached = this.registryCache.get(storylineId);
    if (cached) {
      return cached;
    }

    const loader = this.loadRegistry(storylineId).catch((error) => {
      this.registryCache.delete(storylineId);
      throw error;
    });

    this.registryCache.set(storylineId, loader);
    return loader;
  }

  async getTimeline(storylineId: string): Promise<ChapterTimeline> {
    const registry = await this.getRegistry(storylineId);
    return registry.timeline;
  }

  async getChapterAssets(
    storylineId: string,
    chapterId: string
  ): Promise<{
    assetManifest: ChapterResourceManifest;
    criticalPreloadAssets: ResolvedAssetRef[];
  }> {
    const bundle = await this.loadChapterBundle(storylineId, chapterId);
    return {
      assetManifest: bundle.assetManifest,
      criticalPreloadAssets: bundle.criticalPreloadAssets
    };
  }

  async getChapterIntro(storylineId: string, chapterId: string): Promise<ChapterIntroPanels | null> {
    const cacheKey = `${storylineId}:${chapterId}`;
    const cached = this.introCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const loader = this.loadChapterIntroInternal(storylineId, chapterId).catch((error) => {
      this.introCache.delete(cacheKey);
      throw error;
    });

    this.introCache.set(cacheKey, loader);
    return loader;
  }

  async assertStartableChapter(storylineId: string, chapterId: string): Promise<void> {
    const registry = await this.getRegistry(storylineId);

    try {
      if (!registry.canStartAt(chapterId)) {
        throw new Error("chapter_disabled");
      }
    } catch (error) {
      normalizeChapterError(error);
    }
  }

  async assertCanEnterNext(storylineId: string, fromChapterId: string, toChapterId: string): Promise<void> {
    const registry = await this.getRegistry(storylineId);

    try {
      if (!registry.canEnterNext(fromChapterId, toChapterId)) {
        throw new Error("chapter_transition_not_allowed");
      }
    } catch (error) {
      normalizeChapterError(error);
    }
  }

  async getNextChapterId(storylineId: string, chapterId: string): Promise<string | null> {
    const registry = await this.getRegistry(storylineId);

    try {
      return registry.getNextChapter(chapterId)?.id ?? null;
    } catch (error) {
      normalizeChapterError(error);
    }
  }

  async loadChapterBundle(storylineId: string, chapterId: string): Promise<ChapterBundle> {
    const cacheKey = `${storylineId}:${chapterId}`;
    const cached = this.bundleCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const loader = this.loadChapterBundleInternal(storylineId, chapterId).catch((error) => {
      this.bundleCache.delete(cacheKey);
      throw error;
    });

    this.bundleCache.set(cacheKey, loader);
    return loader;
  }

  async resolveCutsceneMeta(
    storylineId: string,
    chapterId: string,
    cutsceneId?: string
  ): Promise<ChapterCutsceneMeta> {
    const bundle = await this.loadChapterBundle(storylineId, chapterId);
    if (!bundle.meta.cutscenes.length) {
      throw new Error("cutscene_not_found");
    }

    if (!cutsceneId) {
      return bundle.meta.cutscenes[0];
    }

    const cutsceneMeta = bundle.meta.cutscenes.find((item) => item.cutsceneId === cutsceneId);
    if (!cutsceneMeta) {
      throw new Error("cutscene_not_found");
    }

    return cutsceneMeta;
  }

  async compileCutscene(input: {
    storylineId: string;
    chapterId: string;
    cutsceneId?: string;
    dayNight: "DAY" | "NIGHT";
    branchTag?: string;
  }): Promise<{ cutsceneId: string; sceneId: string; timeline: CompiledSceneTimeline }> {
    const bundle = await this.loadChapterBundle(input.storylineId, input.chapterId);
    const cutscene = await this.resolveCutsceneMeta(input.storylineId, input.chapterId, input.cutsceneId);
    const plan = bundle.plansByCutsceneId.get(cutscene.cutsceneId);

    if (!plan) {
      throw new Error("cutscene_plan_not_found");
    }

    const moduleIds = [...new Set(plan.instances.map((instance) => instance.moduleId))];
    const modules = moduleIds.map((moduleId) => {
      const moduleEntry = bundle.modulesById.get(moduleId);
      if (!moduleEntry) {
        throw new Error("cutscene_module_not_found");
      }
      return moduleEntry;
    });

    const timeline = compileSceneTimeline({
      plan,
      modules,
      context: compileContextSchema.parse({
        dayNight: input.dayNight,
        branchTag: input.branchTag
      })
    });

    return {
      cutsceneId: plan.cutsceneId,
      sceneId: plan.sceneId,
      timeline
    };
  }

  private async loadRegistry(storylineId: string): Promise<ChapterRegistry> {
    const timelinePath = path.resolve(chaptersRoot, storylineId, "timeline.json");
    const timelineRaw = await readJsonFile<unknown>(timelinePath);
    const timeline = chapterTimelineSchema.parse(timelineRaw);
    return new ChapterRegistry(timeline);
  }

  private async loadChapterIntroInternal(storylineId: string, chapterId: string): Promise<ChapterIntroPanels | null> {
    const introPath = path.resolve(chaptersRoot, storylineId, chapterId, "intro/intro-panels.json");
    if (!existsSync(introPath)) {
      return null;
    }

    const introRaw = await readJsonFile<unknown>(introPath);
    return chapterIntroPanelsSchema.parse(introRaw);
  }

  private async loadChapterBundleInternal(storylineId: string, chapterId: string): Promise<ChapterBundle> {
    const registry = await this.getRegistry(storylineId);

    try {
      registry.getChapter(chapterId);
    } catch (error) {
      normalizeChapterError(error);
    }

    const chapterRoot = path.resolve(chaptersRoot, storylineId, chapterId);
    const metaPath = path.resolve(chapterRoot, "chapter.meta.json");
    const nodesPath = path.resolve(chapterRoot, "text/nodes.json");
    const choicesPath = path.resolve(chapterRoot, "text/choices.json");
    const resourcePath = path.resolve(chapterRoot, "resources/manifest.json");
    const moduleDir = path.resolve(chapterRoot, "dsl/modules");

    const [metaRaw, nodeRaw, choiceRaw, resourceRaw, moduleFiles] = await Promise.all([
      readJsonFile<unknown>(metaPath),
      readJsonFile<unknown>(nodesPath),
      readJsonFile<unknown>(choicesPath),
      readJsonFile<unknown>(resourcePath),
      readdir(moduleDir)
    ]);

    const meta = chapterMetaSchema.parse(metaRaw);
    if (meta.storylineId !== storylineId || meta.chapterId !== chapterId) {
      throw new Error("chapter_meta_mismatch");
    }

    const resources = chapterResourceManifestSchema.parse(resourceRaw);
    const criticalPreloadAssets = buildCriticalPreloadAssets({
      storylineId,
      chapterId,
      manifest: resources
    });

    const rawNodes = z.array(rawChapterNodeSchema).parse(nodeRaw) as RawChapterNode[];
    const rawChoices = z.array(rawChapterChoiceSchema).parse(choiceRaw) as RawChapterChoice[];

    const nodeIds = new Set(rawNodes.map((node) => node.id));
    const choicesByNode = new Map<string, RawChapterChoice[]>();

    for (const choice of rawChoices) {
      if (!nodeIds.has(choice.nodeId)) {
        throw new Error(`chapter_choice_node_not_found:${choice.id}`);
      }

      if (!choice.nextChapterId && !nodeIds.has(choice.nextNodeId)) {
        throw new Error(`chapter_choice_target_not_found:${choice.id}`);
      }

      const list = choicesByNode.get(choice.nodeId) ?? [];
      list.push(choice);
      choicesByNode.set(choice.nodeId, list);
    }

    const nodes = Object.fromEntries(
      rawNodes.map((rawNode) => {
        const runtimeNode = dialogueNodeSchema.parse({
          id: rawNode.id,
          sceneId: rawNode.sceneId,
          speaker: rawNode.speaker,
          content: rawNode.content,
          checkpoint: rawNode.checkpoint ?? false,
          choices: (choicesByNode.get(rawNode.id) ?? []).map((choice) =>
            dialogueChoiceSchema.parse({
              id: choice.id,
              label: choice.label,
              nextNodeId: choice.nextNodeId,
              nextChapterId: choice.nextChapterId,
              branchTag: choice.branchTag
            })
          )
        });

        return [rawNode.id, runtimeNode];
      })
    ) as Record<string, DialogueNode>;

    if (!nodes[meta.startNodeId]) {
      throw new Error("chapter_start_node_not_found");
    }

    const moduleJsonFiles = moduleFiles.filter((file) => file.endsWith(".json"));
    const modules = await Promise.all(
      moduleJsonFiles.map(async (file) => {
        const modulePath = path.resolve(moduleDir, file);
        const moduleRaw = await readJsonFile<unknown>(modulePath);
        return storyboardModuleSchema.parse(moduleRaw);
      })
    );

    const modulesById = new Map<string, StoryboardModule>();
    for (const moduleEntry of modules) {
      if (modulesById.has(moduleEntry.moduleId)) {
        throw new Error(`chapter_module_duplicate:${moduleEntry.moduleId}`);
      }
      modulesById.set(moduleEntry.moduleId, moduleEntry);
    }

    const plansByCutsceneId = new Map<string, SceneStoryboardPlan>();
    for (const cutscene of meta.cutscenes) {
      const planPath = path.resolve(chapterRoot, "dsl/plans", cutscene.planFile);
      const planRaw = await readJsonFile<unknown>(planPath);
      const plan = sceneStoryboardPlanSchema.parse(planRaw);

      if (plan.cutsceneId !== cutscene.cutsceneId) {
        throw new Error("cutscene_plan_id_mismatch");
      }

      if (plan.sceneId !== cutscene.sceneId) {
        throw new Error("cutscene_scene_id_mismatch");
      }

      plansByCutsceneId.set(cutscene.cutsceneId, plan);
    }

    return {
      storylineId,
      chapterId,
      meta,
      resources,
      assetManifest: resources,
      criticalPreloadAssets,
      nodes,
      orderedNodeIds: rawNodes.map((item) => item.id),
      modulesById,
      plansByCutsceneId
    };
  }
}

const globalForChapterResourceManager = globalThis as unknown as {
  __odyssey_chapter_resource_manager__?: ChapterResourceManager;
};

export const chapterResourceManager =
  globalForChapterResourceManager.__odyssey_chapter_resource_manager__ ?? new ChapterResourceManager();

if (!globalForChapterResourceManager.__odyssey_chapter_resource_manager__) {
  globalForChapterResourceManager.__odyssey_chapter_resource_manager__ = chapterResourceManager;
}
