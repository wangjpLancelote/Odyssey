"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DragonButton } from "@/components/ui-dragon";
import { setStoredDisplayName } from "@/lib/name-storage";
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

export function MemoryRecallEntry() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function recallSession() {
    const validationError = validateDisplayName(displayName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/session/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName })
      });

      const json = (await res.json()) as SessionPayload | { error: string };
      if (!res.ok) {
        if ("error" in json && json.error === "name_not_found") {
          setError("这个名字还没有留下记录，请先从“新的故事”开始。");
        } else if ("error" in json && json.error === "no_active_session") {
          setError("找到了这个名字，但没有可恢复的活跃进度。");
        } else {
          setError("寻觅失败，请稍后再试。");
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
      setError("寻觅失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="entry-page">
      <section className="entry-shell card">
        <div className="row">
          <h1 style={{ margin: 0 }}>旧的回忆</h1>
          <Link href="/" className="menu-inline-link">
            返回首页
          </Link>
        </div>
        <p className="small">请输入你的名字，名字需要与已有记录匹配。</p>

        <input
          className="dragon-input"
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
            setError(null);
          }}
          placeholder="输入你曾使用的名字"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !loading) {
              void recallSession();
            }
          }}
        />

        <div className="row" style={{ marginTop: "var(--ody-space-md)" }}>
          <DragonButton
            onClick={() => {
              void recallSession();
            }}
            disabled={loading}
          >
            {loading ? "寻觅中..." : "唤醒记忆"}
          </DragonButton>
        </div>

        {error ? <div className="error-text">{error}</div> : null}
      </section>
    </main>
  );
}
