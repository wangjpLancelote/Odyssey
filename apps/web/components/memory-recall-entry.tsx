"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompiledSceneTimeline } from "@odyssey/shared";
import { DragonButton } from "@/components/ui-dragon";
import { Message } from "@/components/ui-message";
import { useToast } from "@/components/toast-provider";
import { CutsceneCanvas } from "@/components/cutscene-canvas";
import { validateDisplayName } from "@/lib/name-utils";
import { setStoredDisplayName } from "@/lib/name-storage";
import { markEntryReady, setEntrySource, setStoredSession } from "@/lib/session-storage";
import type { BootstrapVideoCue, MemoryBootstrapSessionPayload } from "@/lib/session-bootstrap";
import { clearMemoryBootstrap, setMemoryBootstrap } from "@/lib/session-bootstrap";

type SessionPayload = {
  session: {
    id: string;
    playerId: string;
    displayName: string;
    storylineId: string;
    chapterId: string;
    currentNodeId: string;
    dayNight: "DAY" | "NIGHT";
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  sessionToken: string;
  node: {
    id: string;
    speaker: string;
    content: string;
    choices: Array<{
      id: string;
      label: string;
      nextNodeId: string;
      nextChapterId?: string;
      branchTag?: string;
    }>;
  };
};

type CutscenePayload = {
  timeline: CompiledSceneTimeline;
};

type ChapterAssetsPayload = {
  timelineVideoCueMap?: Record<string, BootstrapVideoCue>;
};

type RecallStage = "IDLE" | "RECALLING" | "PREFETCHING" | "PLAYING_CUTSCENE" | "REDIRECTING";

type PreparedRecallPayload = {
  sessionPayload: MemoryBootstrapSessionPayload;
  timeline: CompiledSceneTimeline;
  videoCueMap: Record<string, BootstrapVideoCue>;
};

function estimateTimelineDurationMs(timeline: CompiledSceneTimeline): number {
  const motionEnd = timeline.motions.reduce((max, item) => Math.max(max, item.atMs + item.durationMs), 0);
  const audioEnd = timeline.audios.reduce((max, item) => Math.max(max, item.atMs + Math.max(400, item.fadeInMs)), 0);
  return Math.max(motionEnd, audioEnd, 1500);
}

export function MemoryRecallEntry() {
  const router = useRouter();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<RecallStage>("IDLE");
  const [prepared, setPrepared] = useState<PreparedRecallPayload | null>(null);
  const redirectedRef = useRef(false);

  const loading = stage === "RECALLING" || stage === "PREFETCHING" || stage === "REDIRECTING";

  const persistSession = useCallback((sessionPayload: MemoryBootstrapSessionPayload) => {
    setStoredDisplayName(sessionPayload.session.displayName);
    setStoredSession({
      sessionId: sessionPayload.session.id,
      sessionToken: sessionPayload.sessionToken,
      playerId: sessionPayload.session.playerId,
      displayName: sessionPayload.session.displayName,
      storylineId: sessionPayload.session.storylineId,
      chapterId: sessionPayload.session.chapterId
    });
    setEntrySource("memories");
    markEntryReady();
  }, []);

  const finalizeRedirect = useCallback(
    (payload: MemoryBootstrapSessionPayload, cutscene?: PreparedRecallPayload) => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      setStage("REDIRECTING");

      persistSession(payload);
      if (cutscene) {
        setMemoryBootstrap({
          source: "memories",
          createdAt: Date.now(),
          sessionPayload: payload,
          cutscene: {
            timeline: cutscene.timeline,
            videoCueMap: cutscene.videoCueMap
          }
        });
      } else {
        clearMemoryBootstrap();
      }

      router.replace("/game");
    },
    [persistSession, router]
  );

  useEffect(() => {
    if (stage !== "PLAYING_CUTSCENE" || !prepared) return;

    const timeoutMs = estimateTimelineDurationMs(prepared.timeline) + 1200;
    const timer = window.setTimeout(() => {
      finalizeRedirect(prepared.sessionPayload, prepared);
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [finalizeRedirect, stage, prepared]);

  async function recallSession() {
    const validationError = validateDisplayName(displayName);
    if (validationError) {
      setError(validationError);
      toast({ tone: "warning", title: "名字校验", message: validationError });
      return;
    }

    redirectedRef.current = false;
    setStage("RECALLING");
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
          const msg = "这个名字还没有留下记录，请先从“新的故事”开始。";
          setError(msg);
          toast({ tone: "warning", title: "未找到记录", message: msg });
        } else if ("error" in json && json.error === "no_active_session") {
          const msg = "找到了这个名字，但没有可恢复的活跃进度。";
          setError(msg);
          toast({ tone: "warning", title: "无可恢复进度", message: msg });
        } else {
          const msg = "寻觅失败，请稍后再试。";
          setError(msg);
          toast({ tone: "error", title: "恢复失败", message: msg });
        }
        setStage("IDLE");
        return;
      }

      const payload = json as SessionPayload;
      let sessionPayload: MemoryBootstrapSessionPayload = payload;
      setStage("PREFETCHING");
      toast({ tone: "info", title: "回忆唤醒中", message: "正在检索会话与章节资源..." });

      const [cutsceneResult, assetsResult, nodeResult] = await Promise.allSettled([
        fetch("/api/cutscene/play", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-token": payload.sessionToken
          },
          body: JSON.stringify({
            sessionId: payload.session.id
          })
        }),
        fetch(
          `/api/chapters/assets?storylineId=${encodeURIComponent(payload.session.storylineId)}&chapterId=${encodeURIComponent(payload.session.chapterId)}`,
          {
            headers: { "x-session-token": payload.sessionToken }
          }
        ),
        fetch("/api/dialogue/advance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-token": payload.sessionToken
          },
          body: JSON.stringify({ sessionId: payload.session.id })
        })
      ]);

      if (nodeResult.status === "fulfilled" && nodeResult.value.ok) {
        const refreshed = (await nodeResult.value.json()) as Omit<SessionPayload, "sessionToken">;
        sessionPayload = { ...refreshed, sessionToken: payload.sessionToken };
      }

      let timeline: CompiledSceneTimeline | null = null;
      if (cutsceneResult.status === "fulfilled" && cutsceneResult.value.ok) {
        const cutsceneJson = (await cutsceneResult.value.json()) as CutscenePayload;
        timeline = cutsceneJson.timeline;
      }

      const videoCueMap: Record<string, BootstrapVideoCue> = {};
      if (assetsResult.status === "fulfilled" && assetsResult.value.ok) {
        const assetsJson = (await assetsResult.value.json()) as ChapterAssetsPayload;
        Object.assign(videoCueMap, assetsJson.timelineVideoCueMap ?? {});
      }

      if (!timeline) {
        toast({ tone: "success", title: "恢复成功", message: "已恢复会话，正在进入游戏。" });
        finalizeRedirect(sessionPayload);
        return;
      }

      setPrepared({ sessionPayload, timeline, videoCueMap });
      setStage("PLAYING_CUTSCENE");
      toast({ tone: "success", title: "旧忆重连", message: "过场播放后将进入当前场景。" });
    } catch {
      const msg = "寻觅失败，请稍后再试。";
      setError(msg);
      toast({ tone: "error", title: "网络异常", message: msg });
      setStage("IDLE");
    }
  }

  if (stage === "PLAYING_CUTSCENE" && prepared) {
    return (
      <main className="memories-cutscene-page">
        <CutsceneCanvas
          spec={prepared.timeline}
          muted={false}
          videoCueMap={prepared.videoCueMap}
          fullscreen
          onPlayed={() => finalizeRedirect(prepared.sessionPayload, prepared)}
          onError={() => finalizeRedirect(prepared.sessionPayload)}
        />
        <div className="memories-cutscene-caption">旧忆翻涌，命运正在重连...</div>
      </main>
    );
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
          disabled={loading}
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
            {stage === "RECALLING" ? "寻觅中..." : stage === "PREFETCHING" ? "编织回忆中..." : "唤醒记忆"}
          </DragonButton>
        </div>

        {error ? <Message tone="warning" className="mt-3">{error}</Message> : null}
      </section>
    </main>
  );
}
