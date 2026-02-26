const SESSION_KEY = "odyssey.session";
export const ENTRY_READY_COOKIE = "ody_entry_ready";

export type PersistedSession = {
  sessionId: string;
  sessionToken: string;
  playerId: string;
  displayName: string;
  storylineId: string;
  chapterId: string;
};

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

export function markEntryReady(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ENTRY_READY_COOKIE}=1; Path=/; Max-Age=604800; SameSite=Lax`;
}

export function clearEntryReady(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ENTRY_READY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
