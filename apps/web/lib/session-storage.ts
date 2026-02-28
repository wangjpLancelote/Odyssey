const SESSION_KEY = "odyssey.session";
export const ENTRY_READY_COOKIE = "ody_entry_ready";
const ENTRY_SOURCE_KEY = "odyssey.entry_source";
const NEW_PLAYER_PROLOGUE_SEEN_KEY = "odyssey.new_player_prologue_seen";
const CHAPTER_INTRO_SEEN_PREFIX = "odyssey.chapter_intro_seen";

export type PersistedSession = {
  sessionId: string;
  sessionToken: string;
  playerId: string;
  displayName: string;
  storylineId: string;
  chapterId: string;
};

export type EntrySource = "new_story" | "memories";

export function getStoredSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed.sessionId || !parsed.sessionToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredSession(session: PersistedSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function setEntrySource(source: EntrySource): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ENTRY_SOURCE_KEY, source);
}

export function getEntrySource(): EntrySource | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(ENTRY_SOURCE_KEY);
  if (value === "new_story" || value === "memories") return value;
  return null;
}

export function clearEntrySource(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ENTRY_SOURCE_KEY);
}

export function hasSeenNewPlayerPrologue(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(NEW_PLAYER_PROLOGUE_SEEN_KEY) === "1";
}

export function markNewPlayerPrologueSeen(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NEW_PLAYER_PROLOGUE_SEEN_KEY, "1");
}

function chapterIntroKey(sessionId: string, chapterId: string): string {
  return `${CHAPTER_INTRO_SEEN_PREFIX}:${sessionId}:${chapterId}`;
}

export function hasSeenChapterIntro(sessionId: string, chapterId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(chapterIntroKey(sessionId, chapterId)) === "1";
}

export function markChapterIntroSeen(sessionId: string, chapterId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(chapterIntroKey(sessionId, chapterId), "1");
}

export function clearChapterIntroSeen(sessionId: string, chapterId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(chapterIntroKey(sessionId, chapterId));
}

export function markEntryReady(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ENTRY_READY_COOKIE}=1; Path=/; Max-Age=604800; SameSite=Lax`;
}

export function clearEntryReady(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ENTRY_READY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
