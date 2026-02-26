import { resolvedAssetRefSchema, type ResolvedAssetRef } from "@odyssey/shared";

export type AssetResolverMode = "local" | "r2";

export type ResolveAssetRefInput = {
  id?: string;
  kind: ResolvedAssetRef["kind"];
  assetPath: string;
  storylineId?: string;
  chapterId?: string;
  baseKey?: string;
};

const AUDIO_BUS_NAMES = new Set(["bgm", "sfx", "voice", "ambient"]);

function trimSlash(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function inferAudioBusByFileName(fileName: string): "bgm" | "sfx" | "voice" | "ambient" {
  const lower = fileName.toLowerCase();
  if (lower.startsWith("bgm-")) return "bgm";
  if (lower.startsWith("voice-")) return "voice";
  if (lower.startsWith("ambient-")) return "ambient";
  return "sfx";
}

function mapLegacyAbsolutePath(assetPath: string): string | null {
  const seg = assetPath.split("/").filter(Boolean);
  if (!seg.length) {
    return null;
  }

  if (seg[0] === "audio" && seg.length >= 4) {
    const storylineId = seg[1];
    const chapterId = seg[2];
    const rest = seg.slice(3);
    const first = rest[0] ?? "";

    if (AUDIO_BUS_NAMES.has(first)) {
      return `/assets/${storylineId}/${chapterId}/audio/${rest.join("/")}`;
    }

    const fileName = rest.join("/");
    const bus = inferAudioBusByFileName(rest.at(-1) ?? "");
    return `/assets/${storylineId}/${chapterId}/audio/${bus}/${fileName}`;
  }

  if (seg[0] === "images" && seg.length >= 4) {
    return `/assets/${seg[1]}/${seg[2]}/image/${seg.slice(3).join("/")}`;
  }

  if (seg[0] === "image" && seg.length >= 4) {
    return `/assets/${seg[1]}/${seg[2]}/image/${seg.slice(3).join("/")}`;
  }

  if (seg[0] === "sprites" && seg.length >= 4) {
    return `/assets/${seg[1]}/${seg[2]}/sprite/${seg.slice(3).join("/")}`;
  }

  if (seg[0] === "sprite" && seg.length >= 4) {
    return `/assets/${seg[1]}/${seg[2]}/sprite/${seg.slice(3).join("/")}`;
  }

  if (seg[0] === "video" && seg.length >= 4) {
    return `/assets/${seg[1]}/${seg[2]}/video/${seg.slice(3).join("/")}`;
  }

  return null;
}

function resolveBaseKey(input: ResolveAssetRefInput): string {
  if (input.baseKey) {
    return trimSlash(input.baseKey);
  }

  if (input.storylineId && input.chapterId) {
    return `${trimSlash(input.storylineId)}/${trimSlash(input.chapterId)}`;
  }

  return "";
}

function resolveLocalAssetPath(input: ResolveAssetRefInput): string {
  const rawPath = input.assetPath.trim();
  if (!rawPath) {
    return "/assets";
  }

  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  if (rawPath.startsWith("/assets/")) {
    return rawPath;
  }

  if (rawPath.startsWith("/")) {
    return mapLegacyAbsolutePath(rawPath) ?? rawPath;
  }

  const baseKey = resolveBaseKey(input);
  const normalized = trimSlash(rawPath);
  if (!baseKey) {
    return `/assets/${normalized}`;
  }

  return `/assets/${baseKey}/${normalized}`;
}

export function getAssetMode(): AssetResolverMode {
  const configured = (process.env.NEXT_PUBLIC_ASSET_MODE ?? process.env.ASSET_MODE ?? "local").toLowerCase();
  return configured === "r2" ? "r2" : "local";
}

export function resolveAssetRef(input: ResolveAssetRefInput): ResolvedAssetRef {
  const localPath = resolveLocalAssetPath(input);
  const mode = getAssetMode();

  if (mode === "local" || /^https?:\/\//i.test(localPath)) {
    return resolvedAssetRefSchema.parse({
      id: input.id ?? input.assetPath,
      kind: input.kind,
      source: "local",
      path: input.assetPath,
      url: localPath
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? process.env.R2_PUBLIC_BASE_URL ?? "";
  const normalizedBase = baseUrl.replace(/\/$/, "");
  if (!normalizedBase) {
    return resolvedAssetRefSchema.parse({
      id: input.id ?? input.assetPath,
      kind: input.kind,
      source: "local",
      path: input.assetPath,
      url: localPath
    });
  }

  const key = localPath.replace(/^\/+/, "");
  return resolvedAssetRefSchema.parse({
    id: input.id ?? input.assetPath,
    kind: input.kind,
    source: "r2",
    path: input.assetPath,
    url: `${normalizedBase}/${key}`
  });
}

export function resolveAssetUrl(input: ResolveAssetRefInput): string {
  return resolveAssetRef(input).url;
}
