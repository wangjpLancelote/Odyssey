import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chapterIntroPanelSchema,
  comicBubbleThemeSchema,
  comicSourceTypeSchema,
  comicStoryboardPlanSchema,
  comicStyleVariantSchema,
  type ChapterIntroPanel,
  type ComicBubbleTheme,
  type ComicSourceType,
  type ComicStoryboardBeat,
  type ComicStoryboardPlan,
  type ComicStyleVariant
} from "@odyssey/shared";
import { z } from "zod";

const chapterIntroSourceBindingSchema = z.object({
  sourceType: z.literal("chapter_intro")
});

const dialogueNodeSourceBindingSchema = z.object({
  sourceType: z.literal("dialogue_node"),
  nodeIds: z.array(z.string()).min(1)
});

export const comicActSourceBindingSchema = z.union([chapterIntroSourceBindingSchema, dialogueNodeSourceBindingSchema]);
export type ComicActSourceBinding = z.infer<typeof comicActSourceBindingSchema>;

export const comicActSchemaSchema = z.object({
  dslVersion: z.literal("1"),
  storylineId: z.string(),
  chapterId: z.string(),
  actId: z.string(),
  title: z.string(),
  sourceBindings: z.array(comicActSourceBindingSchema).min(1),
  style: comicStyleVariantSchema.default("hero_bright")
});
export type ComicActSchema = z.infer<typeof comicActSchemaSchema>;

export const comicChapterActMapSchema = z.object({
  introActId: z.string(),
  nodeToAct: z.record(z.string()).default({}),
  defaultActId: z.string()
});
export type ComicChapterActMap = z.infer<typeof comicChapterActMapSchema>;

export const comicActStoryboardSchema = z.object({
  sequenceTemplateId: z.string(),
  panelHints: z.array(chapterIntroPanelSchema).default([]),
  rules: comicStoryboardPlanSchema.shape.rules
});
export type ComicActStoryboard = z.infer<typeof comicActStoryboardSchema>;

export type ComicActBundle = {
  schema: ComicActSchema;
  storyboard: ComicActStoryboard;
  bubbleTheme: ComicBubbleTheme;
  storyboardMarkdown: string;
};

export type PrepareComicStoryboardPlanResult = {
  actId: string;
  plan: ComicStoryboardPlan;
  panelHints: ChapterIntroPanel[];
  bubbleTheme: ComicBubbleTheme;
  storyboardMarkdown: string;
  warnings: string[];
};

const chapterActMapCache = new Map<string, Promise<ComicChapterActMap>>();
const actBundleCache = new Map<string, Promise<ComicActBundle>>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveContentRoot(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, "content"),
    path.resolve(process.cwd(), "packages/comic-dsl/src/content"),
    path.resolve(process.cwd(), "../../packages/comic-dsl/src/content"),
    path.resolve(process.cwd(), "src/content")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("comic_content_root_not_found");
}

const contentRoot = resolveContentRoot();

async function readJsonFile<T>(absolutePath: string): Promise<T> {
  const raw = await readFile(absolutePath, "utf8");
  return JSON.parse(raw) as T;
}

function storyboardToBeat(panel: ChapterIntroPanel, index: number): ComicStoryboardBeat {
  return {
    beatId: panel.panelId,
    text: panel.text ?? panel.caption?.text ?? panel.title ?? "命运的帷幕再次掀起。",
    sceneId: panel.sceneId ?? "unknown-scene",
    mood: panel.fxTags?.join(","),
    emphasis: clamp(0.52 + index * 0.12, 0, 1)
  };
}

function beatsFromText(text: string, sceneId: string, beatPrefix: string): ComicStoryboardBeat[] {
  const chunks = text
    .split(/[。！？!?]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const items = (chunks.length ? chunks : [text]).slice(0, 4);
  return items.map((chunk, index) => ({
    beatId: `${beatPrefix}-${index + 1}`,
    text: chunk,
    sceneId,
    emphasis: clamp(0.5 + index * 0.08, 0, 1)
  }));
}

function actSupportsSource(
  schema: ComicActSchema,
  sourceType: ComicSourceType,
  nodeId?: string
): { supported: boolean; warning?: string } {
  const binding = schema.sourceBindings.find((entry) => entry.sourceType === sourceType);
  if (!binding) {
    return { supported: false, warning: `act_source_mismatch:${schema.actId}:${sourceType}` };
  }

  if (binding.sourceType === "dialogue_node" && nodeId && !binding.nodeIds.includes(nodeId)) {
    return { supported: false, warning: `act_node_unbound:${schema.actId}:${nodeId}` };
  }

  return { supported: true };
}

export async function loadChapterActMap(storylineId: string, chapterId: string): Promise<ComicChapterActMap> {
  const cacheKey = `${storylineId}:${chapterId}`;
  const cached = chapterActMapCache.get(cacheKey);
  if (cached) return cached;

  const loader = (async () => {
    const filePath = path.resolve(contentRoot, storylineId, chapterId, "chapter-act-map.json");
    const raw = await readJsonFile<unknown>(filePath);
    return comicChapterActMapSchema.parse(raw);
  })().catch((error) => {
    chapterActMapCache.delete(cacheKey);
    throw error;
  });

  chapterActMapCache.set(cacheKey, loader);
  return loader;
}

export async function resolveComicActId(input: {
  storylineId: string;
  chapterId: string;
  sourceType: ComicSourceType;
  nodeId?: string;
  requestedActId?: string;
}): Promise<string> {
  if (input.requestedActId) {
    return input.requestedActId;
  }

  const map = await loadChapterActMap(input.storylineId, input.chapterId);
  if (input.sourceType === "chapter_intro") {
    return map.introActId;
  }

  if (input.nodeId && map.nodeToAct[input.nodeId]) {
    return map.nodeToAct[input.nodeId]!;
  }

  return map.defaultActId;
}

export async function loadComicActBundle(input: {
  storylineId: string;
  chapterId: string;
  actId: string;
}): Promise<ComicActBundle> {
  const cacheKey = `${input.storylineId}:${input.chapterId}:${input.actId}`;
  const cached = actBundleCache.get(cacheKey);
  if (cached) return cached;

  const loader = (async () => {
    const actRoot = path.resolve(contentRoot, input.storylineId, input.chapterId, "acts", input.actId);
    const [schemaRaw, storyboardRaw, bubbleThemeRaw] = await Promise.all([
      readJsonFile<unknown>(path.resolve(actRoot, "act.schema.json")),
      readJsonFile<unknown>(path.resolve(actRoot, "act.storyboard.json")),
      readJsonFile<unknown>(path.resolve(actRoot, "act.bubble-theme.json"))
    ]);

    const schema = comicActSchemaSchema.parse(schemaRaw);
    const storyboard = comicActStoryboardSchema.parse(storyboardRaw);
    const bubbleTheme = comicBubbleThemeSchema.parse(bubbleThemeRaw);

    if (schema.storylineId !== input.storylineId || schema.chapterId !== input.chapterId || schema.actId !== input.actId) {
      throw new Error("comic_act_identity_mismatch");
    }

    let storyboardMarkdown = "";
    const markdownPath = path.resolve(actRoot, "act.storyboard.md");
    if (existsSync(markdownPath)) {
      storyboardMarkdown = await readFile(markdownPath, "utf8");
    }

    return {
      schema,
      storyboard,
      bubbleTheme,
      storyboardMarkdown
    };
  })().catch((error) => {
    actBundleCache.delete(cacheKey);
    throw error;
  });

  actBundleCache.set(cacheKey, loader);
  return loader;
}

export async function prepareComicStoryboardPlan(input: {
  storylineId: string;
  chapterId: string;
  sourceType: ComicSourceType;
  sequenceId: string;
  nodeId?: string;
  sceneId?: string;
  nodeText?: string;
  fallbackText?: string;
  requestedActId?: string;
  style?: ComicStyleVariant;
}): Promise<PrepareComicStoryboardPlanResult> {
  const actId = await resolveComicActId({
    storylineId: input.storylineId,
    chapterId: input.chapterId,
    sourceType: input.sourceType,
    nodeId: input.nodeId,
    requestedActId: input.requestedActId
  });

  const bundle = await loadComicActBundle({
    storylineId: input.storylineId,
    chapterId: input.chapterId,
    actId
  });

  const warnings: string[] = [];
  const sourceSupport = actSupportsSource(bundle.schema, input.sourceType, input.nodeId);
  if (!sourceSupport.supported && sourceSupport.warning) {
    warnings.push(sourceSupport.warning);
  }

  const panelHints = [...bundle.storyboard.panelHints].sort((a, b) => (a.index ?? 999) - (b.index ?? 999));
  let beats = panelHints.map((panel, index) => storyboardToBeat(panel, index));

  if (input.sourceType === "dialogue_node" && input.nodeText?.trim()) {
    if (beats.length) {
      beats[0] = {
        ...beats[0],
        text: input.nodeText.trim(),
        sceneId: input.sceneId ?? beats[0].sceneId
      };
    } else {
      beats = beatsFromText(
        input.nodeText.trim(),
        input.sceneId ?? input.nodeId ?? "unknown-scene",
        input.nodeId ?? "dialogue"
      );
    }
  }

  if (!beats.length) {
    const fallback = (input.fallbackText ?? input.nodeText ?? "命运在下一格继续。").trim();
    beats = beatsFromText(fallback, input.sceneId ?? "fallback-scene", input.nodeId ?? "fallback");
    warnings.push("act_storyboard_empty_fallback_text");
  }

  const targetPanelCount = beats.length;
  const panelCountMin = Math.max(1, Math.min(bundle.storyboard.rules.panelCountMin, targetPanelCount));
  const panelCountMax = Math.max(panelCountMin, Math.min(bundle.storyboard.rules.panelCountMax, targetPanelCount));

  const plan = comicStoryboardPlanSchema.parse({
    dslVersion: "1",
    sequenceId: input.sequenceId,
    sourceType: input.sourceType,
    style: input.style ?? bundle.schema.style,
    beats,
    rules: {
      panelCountMin,
      panelCountMax,
      readingOrder: bundle.storyboard.rules.readingOrder
    }
  });

  return {
    actId,
    plan,
    panelHints,
    bubbleTheme: bundle.bubbleTheme,
    storyboardMarkdown: bundle.storyboardMarkdown,
    warnings
  };
}
