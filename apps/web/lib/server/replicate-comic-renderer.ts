import Replicate from "replicate";
import { compiledComicSequenceSchema, type ComicPanel, type CompiledComicSequence } from "@odyssey/shared";

const DEFAULT_REPLICATE_MODEL = "black-forest-labs/flux-schnell";
const DEFAULT_MAX_GENERATED_PANELS = 2;
const DEFAULT_PANEL_TIMEOUT_MS = 8_000;
const DEFAULT_COMIC_IMAGE_PROVIDER = "replicate_flux";

export type ComicImageProvider = "replicate_flux" | "replicate_ideogram";

type ProviderRuntimeConfig = {
  provider: ComicImageProvider;
  model: ReplicateModelRef;
  warnings: string[];
};

type ReplicateModelRef = `${string}/${string}` | `${string}/${string}:${string}`;

function appendWarning(sequence: CompiledComicSequence, warning: string): CompiledComicSequence {
  if (sequence.meta.warnings.includes(warning)) {
    return sequence;
  }

  return compiledComicSequenceSchema.parse({
    ...sequence,
    meta: {
      ...sequence.meta,
      warnings: [...sequence.meta.warnings, warning]
    }
  });
}

function panelPromptText(panel: ComicPanel): string {
  const caption = panel.caption?.text ?? panel.caption?.title ?? "";
  const speechText = panel.speech.map((item) => `${item.speaker} says "${item.text}"`).join("; ");
  const sfxText = panel.sfxTexts.map((item) => item.text).join(", ");
  const moodTags = panel.fxTags.join(", ");
  return [caption, speechText, sfxText, moodTags].filter(Boolean).join(" | ");
}

function tonePromptToken(sequence: CompiledComicSequence): string {
  const tone = sequence.meta.bubbleTheme?.tone;
  if (tone === "heroic") return "heroic momentum, bold confidence";
  if (tone === "tense") return "high tension, compressed framing";
  if (tone === "mystic") return "arcane glow, surreal atmosphere";
  if (tone === "calm") return "quiet rhythm, measured pacing";
  return "heroic adventure tension";
}

export function buildReplicateFluxPrompt(sequence: CompiledComicSequence, panel: ComicPanel): string {
  const camera = `${panel.camera.shot} shot, ${panel.camera.angle} angle`;
  const content = panelPromptText(panel) || "A tense story beat in a fantasy city.";
  return [
    "American comic book style, bold inks, halftone texture, cinematic composition.",
    `Storyline ${sequence.storylineId}, chapter ${sequence.chapterId}, panel ${panel.index + 1}.`,
    `Camera: ${camera}.`,
    `Content: ${content}`,
    "No watermark, no text overlays, single-panel illustration."
  ].join(" ");
}

export function buildReplicateIdeogramPrompt(sequence: CompiledComicSequence, panel: ComicPanel): string {
  const camera = `${panel.camera.shot} shot, ${panel.camera.angle} angle`;
  const content = panelPromptText(panel) || "A tense story beat in a fantasy city.";
  const themeToken = tonePromptToken(sequence);
  return [
    "American comic page panel art, polished inks, screen tone dots, dynamic perspective.",
    `Visual tone: ${themeToken}.`,
    `Storyline ${sequence.storylineId}, chapter ${sequence.chapterId}, panel ${panel.index + 1}.`,
    `Camera: ${camera}.`,
    `Content: ${content}`,
    "Comic speech bubble area reserved.",
    "Do not overpaint dialogue safe area in upper-left and center-right.",
    "No watermark, no typography, one clean panel."
  ].join(" ");
}

export function resolveComicImageProvider(env: NodeJS.ProcessEnv = process.env): ComicImageProvider {
  const configured = env.COMIC_IMAGE_PROVIDER?.trim();
  if (configured === "replicate_ideogram") return "replicate_ideogram";
  return DEFAULT_COMIC_IMAGE_PROVIDER;
}

export function resolveProviderRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ProviderRuntimeConfig {
  const provider = resolveComicImageProvider(env);
  if (provider === "replicate_ideogram") {
    const model = env.REPLICATE_COMIC_IDEOGRAM_MODEL?.trim();
    if (model) {
      return {
        provider,
        model: model as ReplicateModelRef,
        warnings: []
      };
    }

    return {
      provider: "replicate_flux",
      model: (env.REPLICATE_COMIC_MODEL?.trim() || DEFAULT_REPLICATE_MODEL) as ReplicateModelRef,
      warnings: ["replicate_ideogram_model_missing_fallback_flux"]
    };
  }

  return {
    provider: "replicate_flux",
    model: (env.REPLICATE_COMIC_MODEL?.trim() || DEFAULT_REPLICATE_MODEL) as ReplicateModelRef,
    warnings: []
  };
}

export function extractReplicateImageUrl(output: unknown): string | null {
  if (!output) return null;

  if (typeof output === "string") {
    return output.startsWith("http://") || output.startsWith("https://") ? output : null;
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const extracted = extractReplicateImageUrl(item);
      if (extracted) return extracted;
    }
    return null;
  }

  if (typeof output === "object") {
    const maybeFileOutput = output as { url?: () => string };
    if (typeof maybeFileOutput.url === "function") {
      try {
        return maybeFileOutput.url();
      } catch {
        return null;
      }
    }

    const maybeUrlRecord = output as { url?: unknown };
    if (typeof maybeUrlRecord.url === "string") {
      return maybeUrlRecord.url.startsWith("http://") || maybeUrlRecord.url.startsWith("https://")
        ? maybeUrlRecord.url
        : null;
    }
  }

  return null;
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("replicate_timeout")), timeoutMs);
    })
  ]);
}

export async function attachReplicateIllustrations(sequence: CompiledComicSequence): Promise<CompiledComicSequence> {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) {
    return appendWarning(sequence, "replicate_disabled_no_token");
  }

  const runtime = resolveProviderRuntimeConfig(process.env);
  const model = runtime.model;
  const maxPanelsRaw = Number(process.env.REPLICATE_COMIC_MAX_PANELS ?? `${DEFAULT_MAX_GENERATED_PANELS}`);
  const panelTimeoutRaw = Number(process.env.REPLICATE_COMIC_TIMEOUT_MS ?? `${DEFAULT_PANEL_TIMEOUT_MS}`);
  const maxPanels = Number.isFinite(maxPanelsRaw) ? Math.max(1, Math.min(4, Math.floor(maxPanelsRaw))) : DEFAULT_MAX_GENERATED_PANELS;
  const panelTimeoutMs = Number.isFinite(panelTimeoutRaw) ? Math.max(3_000, Math.floor(panelTimeoutRaw)) : DEFAULT_PANEL_TIMEOUT_MS;

  const replicate = new Replicate({
    auth: token,
    useFileOutput: false
  });

  replicate.fetch = (url, options) => fetch(url, { ...options, cache: "no-store" });

  const nextPanels = [...sequence.panels];
  let nextSequence: CompiledComicSequence = sequence;
  for (const warning of runtime.warnings) {
    nextSequence = appendWarning(nextSequence, warning);
  }

  for (let index = 0; index < nextPanels.length && index < maxPanels; index += 1) {
    const panel = nextPanels[index];
    if (!panel) continue;

    const prompt =
      runtime.provider === "replicate_ideogram"
        ? buildReplicateIdeogramPrompt(sequence, panel)
        : buildReplicateFluxPrompt(sequence, panel);
    try {
      const output = await runWithTimeout(
        replicate.run(model, {
          input: {
            prompt
          }
        }),
        panelTimeoutMs
      );

      const imageUrl = extractReplicateImageUrl(output);
      if (!imageUrl) {
        nextSequence = appendWarning(nextSequence, `replicate_no_output:${panel.panelId}`);
        continue;
      }

      nextPanels[index] = {
        ...panel,
        illustration: {
          source: "replicate",
          prompt,
          imageUrl
        }
      };
    } catch {
      nextSequence = appendWarning(nextSequence, `replicate_failed:${panel.panelId}`);
    }
  }

  return compiledComicSequenceSchema.parse({
    ...nextSequence,
    panels: nextPanels
  });
}
