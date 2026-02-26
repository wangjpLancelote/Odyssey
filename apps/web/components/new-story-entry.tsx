"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DragonButton } from "@/components/ui-dragon";
import { generateRandomDisplayName } from "@/lib/name-generator";
import { getStoredDisplayName, setStoredDisplayName } from "@/lib/name-storage";
import { validateDisplayName } from "@/lib/name-utils";
import { markEntryReady, setStoredSession } from "@/lib/session-storage";

type SessionPayload = {
  session: {
    id: string;
    playerId: string;
    displayName: string;
    storylineId: string;
    chapterId: string;
  };
  sessionToken: string;
};

const DEFAULT_STORYLINE_ID = "fire-dawn";
const DEFAULT_CHAPTER_ID = "ch01";

export function NewStoryEntry() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = getStoredDisplayName();
    const initial = stored && !validateDisplayName(stored) ? stored : generateRandomDisplayName();
    setDisplayName(initial);
    setStoredDisplayName(initial);
    void refreshSuggestions();
  }, []);

  async function refreshSuggestions() {
    try {
      const res = await fetch("/api/player/name/suggest?count=5");
      const json = (await res.json()) as { suggestions?: string[] };
      if (res.ok && json.suggestions) {
        setSuggestions(json.suggestions);
        return;
      }
    } catch {
      // fallback local
    }

    setSuggestions([
      generateRandomDisplayName(),
      generateRandomDisplayName(),
      generateRandomDisplayName(),
      generateRandomDisplayName(),
      generateRandomDisplayName()
    ]);
  }

  async function startSession() {
    const validationError = validateDisplayName(displayName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          storylineId: DEFAULT_STORYLINE_ID,
          chapterId: DEFAULT_CHAPTER_ID
        })
      });

      const json = (await res.json()) as SessionPayload | { error: string; suggestions?: string[] };
      if (!res.ok) {
        if ("error" in json && json.error === "name_conflict") {
          setError("这个名字已被另一位冒险者点亮，换一个更闪耀的吧。");
          setSuggestions(json.suggestions ?? []);
        } else {
          setError("启程受阻，请稍后再试。");
        }
        return;
      }

      const payload = json as SessionPayload;
      setStoredDisplayName(payload.session.displayName);
      setStoredSession({
        sessionId: payload.session.id,
        sessionToken: payload.sessionToken,
        playerId: payload.session.playerId,
        displayName: payload.session.displayName,
        storylineId: payload.session.storylineId,
        chapterId: payload.session.chapterId
      });
      markEntryReady();
      router.replace("/game");
    } catch {
      setError("启程受阻，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="entry-page">
      <section className="entry-shell card">
        <div className="row">
          <h1 style={{ margin: 0 }}>新的故事</h1>
          <Link href="/" className="menu-inline-link">
            返回首页
          </Link>
        </div>

        <p className="small">命名之后，命运才会承认你的存在。</p>

        <input
          className="dragon-input"
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
            setStoredDisplayName(event.target.value);
            setError(null);
          }}
          placeholder="写下你的冒险名号"
        />

        <div className="row" style={{ marginTop: "var(--ody-space-md)" }}>
          <DragonButton
            variant="secondary"
            onClick={() => {
              const name = generateRandomDisplayName();
              setDisplayName(name);
              setStoredDisplayName(name);
              setError(null);
            }}
          >
            随机召唤
          </DragonButton>
          <DragonButton
            variant="secondary"
            onClick={() => {
              setError(null);
              void refreshSuggestions();
            }}
          >
            再换一批
          </DragonButton>
          <DragonButton
            onClick={() => {
              void startSession();
            }}
            disabled={loading}
          >
            {loading ? "启程中..." : "踏入旅程"}
          </DragonButton>
        </div>

        {error ? <div className="error-text">{error}</div> : null}

        <div className="choices" style={{ marginTop: "var(--ody-space-md)" }}>
          {suggestions.map((item) => (
            <DragonButton
              key={item}
              variant="outline"
              className="choice-btn"
              onClick={() => {
                setDisplayName(item);
                setStoredDisplayName(item);
                setError(null);
              }}
            >
              {item}
            </DragonButton>
          ))}
        </div>
      </section>
    </main>
  );
}
