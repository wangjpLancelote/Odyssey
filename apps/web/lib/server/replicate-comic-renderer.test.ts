import { describe, expect, test } from "bun:test";
import { compiledComicSequenceSchema, type CompiledComicSequence } from "@odyssey/shared";
import {
  attachReplicateIllustrations,
  buildReplicateFluxPrompt,
  buildReplicateIdeogramPrompt,
  extractReplicateImageUrl,
  resolveComicImageProvider,
  resolveProviderRuntimeConfig
} from "./replicate-comic-renderer";

function sampleSequence(): CompiledComicSequence {
  return compiledComicSequenceSchema.parse({
    sequenceId: "comic:fire-dawn:ch01:node-1",
    sourceType: "dialogue_node",
    storylineId: "fire-dawn",
    chapterId: "ch01",
    nodeId: "node-1",
    style: "hero_bright",
    panels: [
      {
        panelId: "p1",
        index: 0,
        layout: { x: 0.02, y: 0.02, w: 0.96, h: 0.47 },
        camera: { shot: "wide", angle: "eye" },
        caption: { title: "晨钟", text: "命运在雾中亮起第一束光。" },
        speech: [{ speaker: "旁白", text: "旅程开始了。", bubbleStyle: "normal", anchor: { x: 0.14, y: 0.18 } }],
        sfxTexts: [],
        fxTags: ["halftone"]
      }
    ],
    meta: {
      dslVersion: "1",
      sourceHash: "abc123",
      compiledAt: new Date().toISOString(),
      warnings: []
    }
  });
}

describe("replicate comic renderer", () => {
  test("builds comic prompt with scene details", () => {
    const sequence = sampleSequence();
    const panel = sequence.panels[0];
    expect(panel).toBeDefined();
    const prompt = buildReplicateFluxPrompt(sequence, panel!);
    expect(prompt).toContain("American comic book style");
    expect(prompt).toContain("chapter ch01");
    expect(prompt).toContain("旅程开始了");
  });

  test("builds ideogram prompt with dialogue safe-area constraints", () => {
    const sequence = sampleSequence();
    const panel = sequence.panels[0];
    expect(panel).toBeDefined();
    const prompt = buildReplicateIdeogramPrompt(sequence, panel!);
    expect(prompt).toContain("Comic speech bubble area reserved");
    expect(prompt).toContain("Do not overpaint dialogue safe area");
  });

  test("resolves provider and runtime config with ideogram fallback", () => {
    expect(
      resolveComicImageProvider({ COMIC_IMAGE_PROVIDER: "replicate_ideogram" } as unknown as NodeJS.ProcessEnv)
    ).toBe("replicate_ideogram");

    const runtime = resolveProviderRuntimeConfig({
      COMIC_IMAGE_PROVIDER: "replicate_ideogram"
    } as unknown as NodeJS.ProcessEnv);
    expect(runtime.provider).toBe("replicate_flux");
    expect(runtime.warnings.includes("replicate_ideogram_model_missing_fallback_flux")).toBe(true);
  });

  test("extracts first image url from mixed output", () => {
    const mockFileOutput = { url: () => "https://replicate.delivery/mock-image.png" };
    const output = ["ignore", mockFileOutput];
    expect(extractReplicateImageUrl(output)).toBe("https://replicate.delivery/mock-image.png");
  });

  test("degrades gracefully when token is missing", async () => {
    const backup = process.env.REPLICATE_API_TOKEN;
    delete process.env.REPLICATE_API_TOKEN;
    const sequence = sampleSequence();

    const next = await attachReplicateIllustrations(sequence);
    expect(next.meta.warnings.includes("replicate_disabled_no_token")).toBe(true);
    expect(next.panels[0]?.illustration).toBeUndefined();

    if (backup) {
      process.env.REPLICATE_API_TOKEN = backup;
    }
  });
});
