"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChapterTimeline, CompiledSceneTimeline } from "@odyssey/shared";
import { DragonButton } from "@/components/ui-dragon";
import { CutsceneCanvas } from "@/components/cutscene-canvas";
import { GameTopbar } from "@/components/game-topbar";
import { clearEntryReady, clearStoredSession, getStoredSession, setStoredSession } from "@/lib/session-storage";

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

type FootprintPayload = {
  sessionId: string;
  checkpoints: Array<{
    checkpointId: string;
    storylineId: string;
    chapterId: string;
    nodeId: string;
    createdAt: string;
  }>;
};

type RestorePayload = Omit<SessionPayload, "sessionToken"> & {
  resourceReloadedChapter?: string | null;
};

type ChapterAssetsPayload = {
  criticalPreloadAssets: Array<{
    id: string;
    kind: "audio" | "video" | "image" | "sprite";
    url: string;
  }>;
  timelineVideoCueMap?: Record<
    string,
    {
      src: string;
      poster?: string;
      loop?: boolean;
    }
  >;
};

export function DialogueGame() {
  const router = useRouter();

  const [data, setData] = useState<SessionPayload | null>(null);
  const [booting, setBooting] = useState(true);
  const [footprint, setFootprint] = useState<FootprintPayload | null>(null);
  const [chapterTimeline, setChapterTimeline] = useState<ChapterTimeline | null>(null);
  const [sideQuestInfo, setSideQuestInfo] = useState<string>("尚未唤起支线回响");
  const [muted, setMuted] = useState(false);
  const [statusText, setStatusText] = useState("旅程连接中...");
  const [timeline, setTimeline] = useState<CompiledSceneTimeline | null>(null);
  const [videoCueMap, setVideoCueMap] = useState<Record<string, { src: string; poster?: string; loop?: boolean }>>(
    {}
  );
  const warmedAssetUrlsRef = useRef(new Set<string>());

  const dayNightClass = useMemo(() => {
    if (!data) return "未侦测";
    return data.session.dayNight === "DAY" ? "白昼" : "夜晚";
  }, [data]);

  const currentChapterTitle = useMemo(() => {
    if (!data) return "";
    const matched = chapterTimeline?.chapters.find((chapter) => chapter.id === data.session.chapterId)?.title;
    return matched ?? data.session.chapterId;
  }, [data, chapterTimeline]);

  function syncStoredSession(payload: SessionPayload): void {
    setStoredSession({
      sessionId: payload.session.id,
      sessionToken: payload.sessionToken,
      playerId: payload.session.playerId,
      displayName: payload.session.displayName,
      storylineId: payload.session.storylineId,
      chapterId: payload.session.chapterId
    });
  }

  function authHeaders(): HeadersInit {
    if (!data?.sessionToken) {
      return { "Content-Type": "application/json" };
    }

    return {
      "Content-Type": "application/json",
      "x-session-token": data.sessionToken
    };
  }

  function handleSessionExpired() {
    clearStoredSession();
    clearEntryReady();
    setData(null);
    setBooting(false);
    router.replace("/?reason=session_required");
  }

  useEffect(() => {
    const stored = getStoredSession();
    if (!stored) {
      handleSessionExpired();
      return;
    }

    void restoreSession(stored.sessionId, stored.sessionToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function restoreSession(sessionId: string, sessionToken: string) {
    try {
      const res = await fetch("/api/dialogue/advance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": sessionToken
        },
        body: JSON.stringify({ sessionId })
      });

      if (!res.ok) {
        handleSessionExpired();
        return;
      }

      const result = (await res.json()) as Omit<SessionPayload, "sessionToken">;
      const payload: SessionPayload = { ...result, sessionToken };
      setData(payload);
      syncStoredSession(payload);
      setStatusText("会话已恢复");
      await Promise.all([loadTimeline(payload.session.storylineId), loadCutscene(payload)]);
      setBooting(false);
    } catch {
      handleSessionExpired();
    }
  }

  async function loadTimeline(storylineId: string) {
    const res = await fetch(`/api/chapters/timeline?storylineId=${encodeURIComponent(storylineId)}`);
    if (!res.ok) return;
    const json = (await res.json()) as ChapterTimeline;
    setChapterTimeline(json);
  }

  async function loadCutscene(session: SessionPayload, cutsceneId?: string) {
    const res = await fetch("/api/cutscene/play", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.sessionToken
      },
      body: JSON.stringify({
        sessionId: session.session.id,
        cutsceneId
      })
    });

    if (!res.ok) return;
    const json = (await res.json()) as { timeline: CompiledSceneTimeline };
    setTimeline(json.timeline);
  }

  const warmAssetUrls = useCallback((assets: ChapterAssetsPayload["criticalPreloadAssets"]) => {
    if (typeof document === "undefined") return;

    for (const asset of assets) {
      if (warmedAssetUrlsRef.current.has(asset.url)) continue;

      const link = document.createElement("link");
      link.rel = "preload";
      link.href = asset.url;
      link.crossOrigin = "anonymous";
      link.as = asset.kind === "audio" ? "audio" : asset.kind === "video" ? "video" : "image";
      document.head.appendChild(link);
      warmedAssetUrlsRef.current.add(asset.url);
    }
  }, []);

  const loadChapterAssets = useCallback(
    async (storylineId: string, chapterId: string, sessionToken?: string) => {
      const res = await fetch(
        `/api/chapters/assets?storylineId=${encodeURIComponent(storylineId)}&chapterId=${encodeURIComponent(chapterId)}`,
        {
          headers: sessionToken
            ? {
                "x-session-token": sessionToken
              }
            : undefined
        }
      );

      if (!res.ok) return;
      const payload = (await res.json()) as ChapterAssetsPayload;
      setVideoCueMap(payload.timelineVideoCueMap ?? {});
      warmAssetUrls(payload.criticalPreloadAssets ?? []);
    },
    [warmAssetUrls]
  );

  useEffect(() => {
    if (!data) return;
    void loadChapterAssets(data.session.storylineId, data.session.chapterId, data.sessionToken);
  }, [data, loadChapterAssets]);

  async function refreshNode() {
    if (!data) return;
    const res = await fetch("/api/dialogue/advance", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ sessionId: data.session.id })
    });

    if (res.status === 401) {
      handleSessionExpired();
      return;
    }

    const response = (await res.json()) as Omit<SessionPayload, "sessionToken">;
    const next = { ...data, ...response };
    setData(next);
    syncStoredSession(next);
  }

  async function commitChoice(choiceId: string) {
    if (!data) return;
    const res = await fetch("/api/choice/commit", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ sessionId: data.session.id, choiceId })
    });

    if (res.status === 401) {
      handleSessionExpired();
      return;
    }

    const response = (await res.json()) as Omit<SessionPayload, "sessionToken">;
    const next = { ...data, ...response };
    setData(next);
    syncStoredSession(next);
    setStatusText(
      response.session.chapterId === data.session.chapterId
        ? `抉择已刻入命运：${choiceId}。`
        : `你已跨入新章：${response.session.chapterId}。`
    );
    await loadCutscene(next);
  }

  async function loadFootprint() {
    if (!data) return;
    const res = await fetch(`/api/footprints/map?sessionId=${data.session.id}`, {
      headers: {
        "x-session-token": data.sessionToken
      }
    });

    if (res.status === 401) {
      handleSessionExpired();
      return;
    }

    setFootprint((await res.json()) as FootprintPayload);
  }

  async function restore(checkpointId: string) {
    if (!data) return;
    const res = await fetch("/api/footprints/restore", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ sessionId: data.session.id, checkpointId })
    });

    if (res.status === 401) {
      handleSessionExpired();
      return;
    }

    const response = (await res.json()) as RestorePayload;
    const next = { ...data, ...response };
    setData(next);
    syncStoredSession(next);

    if (response.resourceReloadedChapter) {
      setStatusText(`你沿足迹回到 ${checkpointId}，并重返 ${response.resourceReloadedChapter}。`);
      await loadCutscene(next);
      return;
    }

    setStatusText(`你沿足迹回到 ${checkpointId}。`);
  }

  async function enterNextChapter() {
    if (!data || !chapterTimeline) return;

    const current = chapterTimeline.chapters.find((item) => item.id === data.session.chapterId);
    if (!current?.nextId) {
      setStatusText("这一幕已抵终点，下一页尚未开启。");
      return;
    }

    const res = await fetch("/api/chapters/enter", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ sessionId: data.session.id, toChapterId: current.nextId })
    });

    if (res.status === 401) {
      handleSessionExpired();
      return;
    }

    if (!res.ok) {
      setStatusText("前往下一幕的通路暂时关闭。");
      return;
    }

    const response = (await res.json()) as RestorePayload;
    const next = { ...data, ...response };
    setData(next);
    syncStoredSession(next);
    setStatusText(`你已踏入新幕：${response.session.chapterId}。`);
    await loadCutscene(next);
  }

  async function triggerSideQuest() {
    if (!data) return;
    const res = await fetch("/api/sidequest/trigger", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ sessionId: data.session.id, nodeId: data.node.id })
    });

    if (res.status === 401) {
      handleSessionExpired();
      return;
    }

    const json = (await res.json()) as {
      state: string;
      blocked: boolean;
      candidates: string[];
    };

    setSideQuestInfo(
      `状态：${json.state}｜受限：${json.blocked ? "是" : "否"}｜回响：${json.candidates.join("、") || "暂无"}`
    );
  }

  async function refreshDayNight() {
    if (!data) return;
    const res = await fetch(`/api/daynight/current?sessionId=${data.session.id}`, {
      headers: { "x-session-token": data.sessionToken }
    });

    if (res.status === 401) {
      handleSessionExpired();
      return;
    }

    const json = (await res.json()) as { dayNight: "DAY" | "NIGHT" };
    const next = {
      ...data,
      session: {
        ...data.session,
        dayNight: json.dayNight
      }
    };
    setData(next);
    syncStoredSession(next);
    await loadCutscene(next);
  }

  if (booting || !data) {
    return (
      <main>
        <div className="shell">
          <section className="card">
            <h1 style={{ marginTop: 0 }}>正在连接你的旅程...</h1>
            <p className="small">如果会话不存在，将自动返回首页。</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main>
      <GameTopbar visible={Boolean(data)} chapterTitle={currentChapterTitle} />
      <div className="shell">
        <div className="row">
          <h1>火之晨曦：少年冒险篇 ⚔️</h1>
          <span className="tag">{dayNightClass}</span>
        </div>

        <div className="small">在孤独与星火之间，做出属于你的那一步。 ✨</div>

        <div className="grid">
          <section className="card">
            <div className="row">
              <h2 style={{ margin: 0 }}>主线旅程</h2>
              <div className="small">{statusText}</div>
            </div>

            <div className="small" style={{ marginTop: "var(--ody-space-md)" }}>
              同行者：{data.session.displayName}
            </div>
            <div className="small" style={{ marginTop: "var(--ody-space-xs)" }}>
              所在篇章：{`${data.session.storylineId} / ${data.session.chapterId}`}
            </div>

            <div className="row" style={{ marginTop: "var(--ody-space-md)" }}>
              <DragonButton variant="secondary" onClick={refreshNode}>
                聆听下一句
              </DragonButton>
              <DragonButton variant="secondary" onClick={refreshDayNight}>
                校准昼夜
              </DragonButton>
              <DragonButton onClick={enterNextChapter} disabled={!chapterTimeline}>
                迈向下一幕
              </DragonButton>
            </div>

            <hr />
            <div className="small">场景节点：{data.node.id}</div>
            <p>
              <strong>{data.node.speaker}：</strong>
              {data.node.content}
            </p>
            <div className="choices">
              {data.node.choices.map((choice) => (
                <DragonButton
                  key={choice.id}
                  variant="outline"
                  className="choice-btn"
                  onClick={() => {
                    void commitChoice(choice.id);
                  }}
                >
                  {choice.label}
                </DragonButton>
              ))}
              {data.node.choices.length === 0 ? <div className="small">这一刻尚无可走的分岔路。</div> : null}
            </div>
          </section>

          <aside className="card">
            <h3 style={{ marginTop: 0 }}>旅团仪表盘 🧭</h3>
            <div className="row">
              <DragonButton
                variant="secondary"
                onClick={() => {
                  void loadFootprint();
                }}
              >
                展开足迹
              </DragonButton>
              <DragonButton
                variant="secondary"
                onClick={() => {
                  void triggerSideQuest();
                }}
              >
                唤起支线
              </DragonButton>
            </div>

            <div className="small" style={{ marginTop: "var(--ody-space-md)" }}>
              支线回响：{sideQuestInfo}
            </div>

            <hr />

            <div className="small">章节航线</div>
            <div className="small" style={{ marginTop: "var(--ody-space-sm)" }}>
              {chapterTimeline
                ? chapterTimeline.chapters
                    .map((item) => `${item.id}${item.enabled ? "" : "(disabled)"}`)
                    .join(" -> ")
                : "航线尚未展开"}
            </div>

            <hr />

            <div className="small">足迹锚点（仅你可见）</div>
            <div className="choices" style={{ marginTop: "var(--ody-space-sm)" }}>
              {footprint?.checkpoints?.map((cp) => (
                <DragonButton
                  key={cp.checkpointId}
                  variant="outline"
                  onClick={() => {
                    void restore(cp.checkpointId);
                  }}
                >
                  {cp.checkpointId} {"->"} {cp.chapterId}:{cp.nodeId}
                </DragonButton>
              ))}
              {!footprint ? <div className="small">尚未读取足迹</div> : null}
            </div>

            <hr />
            <div className="row">
              <div className="small">音轨</div>
              <DragonButton variant="ghost" onClick={() => setMuted((value) => !value)}>
                {muted ? "恢复声息" : "让世界静音"}
              </DragonButton>
            </div>
          </aside>
        </div>

        {timeline ? (
          <section className="card" style={{ marginTop: "var(--ody-space-lg)" }}>
            <div className="row">
              <h2 style={{ margin: 0 }}>分镜过场（PixiJS + GSAP + Howler）</h2>
              <div className="small">{timeline.cutsceneId}</div>
            </div>
            <CutsceneCanvas
              spec={timeline}
              muted={muted}
              videoCueMap={videoCueMap}
              onPlayed={() => setStatusText("过场落幕，新的抉择正向你逼近。")}
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}
