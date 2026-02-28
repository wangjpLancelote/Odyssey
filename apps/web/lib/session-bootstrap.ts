import type { CompiledSceneTimeline, DialogueNode, GameSession } from "@odyssey/shared";

const MEMORY_BOOTSTRAP_KEY = "odyssey.memory_bootstrap";
const DEFAULT_MAX_AGE_MS = 60_000;

export type BootstrapTTLPolicy = {
  maxAgeMs: number;
};

export type BootstrapVideoCue = {
  src: string;
  poster?: string;
  loop?: boolean;
};

export type BootstrapCutscenePayload = {
  timeline: CompiledSceneTimeline;
  videoCueMap: Record<string, BootstrapVideoCue>;
};

export type MemoryBootstrapSessionPayload = {
  session: GameSession;
  sessionToken: string;
  node: DialogueNode;
};

export type MemoryBootstrapPayload = {
  source: "memories";
  createdAt: number;
  sessionPayload: MemoryBootstrapSessionPayload;
  cutscene?: BootstrapCutscenePayload;
};

type SessionIdentity = {
  sessionId: string;
  sessionToken: string;
};

function isLikelyBootstrapPayload(value: unknown): value is MemoryBootstrapPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<MemoryBootstrapPayload>;
  if (payload.source !== "memories") return false;
  if (typeof payload.createdAt !== "number") return false;
  if (!payload.sessionPayload) return false;
  if (typeof payload.sessionPayload.sessionToken !== "string") return false;
  if (typeof payload.sessionPayload.session?.id !== "string") return false;
  if (typeof payload.sessionPayload.node?.id !== "string") return false;
  return true;
}

export function setMemoryBootstrap(payload: MemoryBootstrapPayload): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(MEMORY_BOOTSTRAP_KEY, JSON.stringify(payload));
}

export function clearMemoryBootstrap(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(MEMORY_BOOTSTRAP_KEY);
}

export function consumeMemoryBootstrap(
  identity: SessionIdentity,
  policy: BootstrapTTLPolicy = { maxAgeMs: DEFAULT_MAX_AGE_MS }
): MemoryBootstrapPayload | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(MEMORY_BOOTSTRAP_KEY);
    if (!raw) return null;

    window.sessionStorage.removeItem(MEMORY_BOOTSTRAP_KEY);
    const parsed = JSON.parse(raw) as unknown;
    if (!isLikelyBootstrapPayload(parsed)) return null;

    const expired = Date.now() - parsed.createdAt > policy.maxAgeMs;
    if (expired) return null;

    const sameSession =
      parsed.sessionPayload.session.id === identity.sessionId &&
      parsed.sessionPayload.sessionToken === identity.sessionToken;

    if (!sameSession) return null;
    return parsed;
  } catch {
    window.sessionStorage.removeItem(MEMORY_BOOTSTRAP_KEY);
    return null;
  }
}
