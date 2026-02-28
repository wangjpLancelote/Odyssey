"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NameGate } from "@/components/name-gate";
import { useToast } from "@/components/toast-provider";
import { generateRandomDisplayName } from "@/lib/name-generator";
import { getStoredDisplayName, setStoredDisplayName } from "@/lib/name-storage";
import { validateDisplayName } from "@/lib/name-utils";
import { markEntryReady, setEntrySource, setStoredSession } from "@/lib/session-storage";

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
  const { toast } = useToast();

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
      toast({ tone: "warning", title: "命名校验", message: validationError });
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
          const msg = "这个名字已被另一位冒险者点亮，换一个更闪耀的吧。";
          setError(null);
          setSuggestions(json.suggestions ?? []);
          toast({ tone: "warning", title: "名字冲突", message: msg, durationMs: 4200 });
        } else {
          const msg = "启程受阻，请稍后再试。";
          setError(msg);
          toast({ tone: "error", title: "开局失败", message: msg });
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
      setEntrySource("new_story");
      markEntryReady();
      toast({ tone: "success", title: "启程成功", message: "命运已记住你的名字，正在进入游戏。" });
      router.replace("/game");
    } catch {
      const msg = "启程受阻，请稍后再试。";
      setError(msg);
      toast({ tone: "error", title: "网络异常", message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="entry-page">
      <section className="entry-shell">
        <div className="row">
          <h1 style={{ margin: 0 }}>新的故事</h1>
          <Link href="/" className="menu-inline-link">
            返回首页
          </Link>
        </div>

        <p className="small" style={{ marginTop: "var(--ody-space-sm)" }}>
          命名之后，命运才会承认你的存在。
        </p>

        <NameGate
          showModeTabs={false}
          displayName={displayName}
          suggestions={suggestions}
          error={error}
          loading={loading}
          onDisplayNameChange={(value) => {
            setDisplayName(value);
            setStoredDisplayName(value);
            setError(null);
          }}
          onRandomLocal={() => {
            const name = generateRandomDisplayName();
            setDisplayName(name);
            setStoredDisplayName(name);
            setError(null);
          }}
          onRefreshSuggestions={() => {
            setError(null);
            void refreshSuggestions();
          }}
          onPickSuggestion={(value) => {
            setDisplayName(value);
            setStoredDisplayName(value);
            setError(null);
          }}
          onSubmit={() => {
            void startSession();
          }}
          recallName=""
          recallError={null}
          recallLoading={false}
          onRecallNameChange={() => {}}
          onRecall={() => {}}
        />
      </section>
    </main>
  );
}
