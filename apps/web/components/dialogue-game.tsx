"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChapterTimeline, CompiledComicSequence, CompiledSceneTimeline } from "@odyssey/shared";
import { DragonButton } from "@/components/ui-dragon";
import { Message, type MessageTone } from "@/components/ui-message";
import { useToast } from "@/components/toast-provider";
import { CutsceneCanvas } from "@/components/cutscene-canvas";
import { ComicStageKonva } from "@/components/comic-stage-konva";
import { GameTopbar } from "@/components/game-topbar";
import {
  clearEntryReady,
  clearEntrySource,
  clearStoredSession,
  getEntrySource,
  getStoredSession,
  hasSeenChapterIntro,
  markChapterIntroSeen,
  setStoredSession
} from "@/lib/session-storage";
import { consumeMemoryBootstrap } from "@/lib/session-bootstrap";

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

type GameViewMode = "intro" | "play";

export function DialogueGame() {
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = useState<SessionPayload | null>(null);
  const [booting, setBooting] = useState(true);
  const [viewMode, setViewMode] = useState<GameViewMode>("play");
  const [footprint, setFootprint] = useState<FootprintPayload | null>(null);
  const [chapterTimeline, setChapterTimeline] = useState<ChapterTimeline | null>(null);
  const [sideQuestInfo, setSideQuestInfo] = useState<string>("尚未唤起支线回响");
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState<{ tone: MessageTone; text: string }>({
    tone: "info",
    text: "旅程连接中..."
  });
  const [timeline, setTimeline] = useState<CompiledSceneTimeline | null>(null);
  const [videoCueMap, setVideoCueMap] = useState<Record<string, { src: string; poster?: string; loop?: boolean }>>({});
  const [comicSequence, setComicSequence] = useState<CompiledComicSequence | null>(null);
  const [comicLoading, setComicLoading] = useState(false);
  const [comicError, setComicError] = useState<string | null>(null);
  const [selectedComicPanelIndex, setSelectedComicPanelIndex] = useState(0);
  const [introPanelIndex, setIntroPanelIndex] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const warmedAssetUrlsRef = useRef(new Set<string>());

  const updateStatus = useCallback(
    (text: string, tone: MessageTone = "info", notify = false) => {
      setStatus((prev) => {
        if (prev.tone === tone && prev.text === text) return prev;
        return { tone, text };
      });

      if (notify) {
        toast({
          tone,
          title: tone === "success" ? "操作成功" : tone === "warning" ? "注意" : tone === "error" ? "请求失败" : "提示",
          message: text
        });
      }
    },
    [toast]
  );

  const handleCutscenePlayed = useCallback(() => {
    updateStatus("过场落幕，新的抉择正向你逼近。", "info");
  }, [updateStatus]);

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
    clearEntrySource();
    toast({ tone: "error", title: "会话失效", message: "当前会话已失效，请从首页重新进入。" });
    setData(null);
    setBooting(false);
    router.replace("/?reason=session_required");
  }

  function resolveIntroGate(payload: SessionPayload): boolean {
    const source = getEntrySource();
    const shouldShow =
      source === "new_story" &&
      payload.session.chapterId === "ch01" &&
      !hasSeenChapterIntro(payload.session.id, payload.session.chapterId);

    if (shouldShow) {
      setIntroPanelIndex(0);
    } else if (source) {
      clearEntrySource();
    }

    return shouldShow;
  }

  function completeIntroGate(): void {
    if (!data) return;
    markChapterIntroSeen(data.session.id, data.session.chapterId);
    clearEntrySource();
    setIntroPanelIndex(0);
    setViewMode("play");
    updateStatus("第一幕已完成，正式进入主线。", "success", true);
  }

  useEffect(() => {
    const stored = getStoredSession();
    if (!stored) {
      handleSessionExpired();
      return;
    }

    const bootstrap = consumeMemoryBootstrap({
      sessionId: stored.sessionId,
      sessionToken: stored.sessionToken
    });

    if (bootstrap) {
      const payload: SessionPayload = bootstrap.sessionPayload;
      setData(payload);
      syncStoredSession(payload);
      setTimeline(bootstrap.cutscene?.timeline ?? null);
      setVideoCueMap(bootstrap.cutscene?.videoCueMap ?? {});
      setViewMode(resolveIntroGate(payload) ? "intro" : "play");
      updateStatus("旧忆已重连", "info", true);
      setBooting(false);

      void loadTimeline(payload.session.storylineId);
      if (!bootstrap.cutscene?.timeline) {
        void loadCutscene(payload);
      }
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
      setViewMode(resolveIntroGate(payload) ? "intro" : "play");
      updateStatus("会话已恢复", "success", true);
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

  const loadComicSequence = useCallback(
    async (params: {
      sessionId: string;
      sessionToken: string;
      source: "chapter_intro" | "dialogue_node";
      nodeId?: string;
    }) => {
      setComicLoading(true);
      setComicError(null);
      try {
        const res = await fetch("/api/comic/sequence", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-token": params.sessionToken
          },
          body: JSON.stringify({
            sessionId: params.sessionId,
            source: params.source,
            nodeId: params.nodeId,
            style: "hero_bright"
          })
        });

        if (!res.ok) {
          setComicError("分镜加载失败，已启用降级内容。");
          return;
        }

        const payload = (await res.json()) as CompiledComicSequence;
        setComicSequence(payload);
        setSelectedComicPanelIndex((current) => {
          const maxIndex = Math.max(0, payload.panels.length - 1);
          return Math.min(current, maxIndex);
        });
      } catch {
        setComicError("分镜加载失败，已启用降级内容。");
      } finally {
        setComicLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!data) return;
    void loadChapterAssets(data.session.storylineId, data.session.chapterId, data.sessionToken);
  }, [data, loadChapterAssets]);

  useEffect(() => {
    if (!data) return;

    if (viewMode === "intro") {
      void loadComicSequence({
        sessionId: data.session.id,
        sessionToken: data.sessionToken,
        source: "chapter_intro"
      });
      return;
    }

    void loadComicSequence({
      sessionId: data.session.id,
      sessionToken: data.sessionToken,
      source: "dialogue_node",
      nodeId: data.node.id
    });
  }, [data, viewMode, loadComicSequence]);

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
    updateStatus(
      response.session.chapterId === data.session.chapterId
        ? `抉择已刻入命运：${choiceId}。`
        : `你已跨入新章：${response.session.chapterId}。`,
      "success",
      true
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
      updateStatus(`你沿足迹回到 ${checkpointId}，并重返 ${response.resourceReloadedChapter}。`, "success", true);
      await loadCutscene(next);
      return;
    }

    updateStatus(`你沿足迹回到 ${checkpointId}。`, "success", true);
  }

  async function enterNextChapter() {
    if (!data || !chapterTimeline) return;

    const current = chapterTimeline.chapters.find((item) => item.id === data.session.chapterId);
    if (!current?.nextId) {
      updateStatus("这一幕已抵终点，下一页尚未开启。", "warning", true);
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
      updateStatus("前往下一幕的通路暂时关闭。", "warning", true);
      return;
    }

    const response = (await res.json()) as RestorePayload;
    const next = { ...data, ...response };
    setData(next);
    syncStoredSession(next);
    updateStatus(`你已踏入新幕：${response.session.chapterId}。`, "success", true);
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

  const introPanelsCount = comicSequence?.panels.length ?? 0;
  const isLastIntroPanel = introPanelIndex >= Math.max(0, introPanelsCount - 1);

  return (
    <main>
      <GameTopbar visible={Boolean(data)} chapterTitle={currentChapterTitle} />
      <div className="shell">
        {viewMode === "intro" ? (
          <section className="card comic-intro-shell">
            <div className="row">
              <h2 style={{ margin: 0 }}>第一幕：世界观引导</h2>
              <span className="small">
                {introPanelsCount > 0 ? `${Math.min(introPanelIndex + 1, introPanelsCount)} / ${introPanelsCount}` : "准备中"}
              </span>
            </div>
            <p className="small">阅读并通过第一幕分镜后，才会进入正式游戏页面。</p>

            {comicError ? <Message tone="warning" className="mt-3">{comicError}</Message> : null}

            <ComicStageKonva sequence={comicSequence} focusPanelIndex={introPanelIndex} />

            <div className="row" style={{ marginTop: "var(--ody-space-md)" }}>
              <span className="small">点击分镜可重新聚焦当前格。</span>
              <div className="row" style={{ gap: "var(--ody-space-md)" }}>
                <DragonButton
                  variant="secondary"
                  disabled={introPanelIndex <= 0 || comicLoading}
                  onClick={() => setIntroPanelIndex((value) => Math.max(0, value - 1))}
                >
                  上一格
                </DragonButton>
                <DragonButton
                  onClick={() => {
                    if (isLastIntroPanel) {
                      completeIntroGate();
                    } else {
                      setIntroPanelIndex((value) => value + 1);
                    }
                  }}
                  disabled={comicLoading}
                >
                  {isLastIntroPanel ? "完成第一幕，进入旅程" : "下一格"}
                </DragonButton>
              </div>
            </div>
          </section>
        ) : (
          <div className={`game-comic-layout ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
            <section className="card comic-main-card">
              <div className="row">
                <h2 style={{ margin: 0 }}>美漫分镜主舞台</h2>
                <span className="small">{`${data.session.storylineId} / ${data.session.chapterId} / ${data.node.id}`}</span>
              </div>

              {comicError ? <Message tone="warning" className="mt-3">{comicError}</Message> : null}
              {comicLoading && !comicSequence ? <p className="small">分镜编排中...</p> : null}

              <ComicStageKonva
                sequence={comicSequence}
                onPanelSelect={(index) => {
                  setSelectedComicPanelIndex(index);
                }}
              />

              {timeline ? (
                <div className="comic-cutscene-overlay">
                  <div className="small" style={{ marginBottom: "var(--ody-space-sm)" }}>
                    过场叠层：{timeline.cutsceneId}
                  </div>
                  <CutsceneCanvas
                    spec={timeline}
                    muted={muted}
                    videoCueMap={videoCueMap}
                    onPlayed={handleCutscenePlayed}
                  />
                </div>
              ) : null}
            </section>

            <aside className={`card game-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}>
              <div className="row">
                <h3 style={{ margin: 0 }}>旅团仪表盘</h3>
                <DragonButton variant="ghost" onClick={() => setSidebarCollapsed((v) => !v)}>
                  {sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
                </DragonButton>
              </div>

              {sidebarCollapsed ? (
                <div className="small" style={{ marginTop: "var(--ody-space-md)" }}>
                  侧栏已收起，点击“展开侧栏”可继续操作。
                </div>
              ) : (
                <>
                  <div className="small">在孤独与星火之间，做出属于你的那一步。</div>
                  <Message tone={status.tone} className="mt-3">
                    {status.text}
                  </Message>

                  <div className="small" style={{ marginTop: "var(--ody-space-md)" }}>
                    同行者：{data.session.displayName}
                  </div>
                  <div className="small" style={{ marginTop: "var(--ody-space-xs)" }}>
                    所在篇章：{`${data.session.storylineId} / ${data.session.chapterId}`}
                  </div>
                  <div className="small" style={{ marginTop: "var(--ody-space-xs)" }}>
                    昼夜状态：{dayNightClass}
                  </div>

                  <div className="row" style={{ marginTop: "var(--ody-space-md)", flexWrap: "wrap" }}>
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
                  <div className="small">当前选中分镜</div>
                  <div className="small" style={{ marginTop: "var(--ody-space-sm)" }}>
                    {comicSequence?.panels[selectedComicPanelIndex]
                      ? `${selectedComicPanelIndex + 1}. ${
                          comicSequence.panels[selectedComicPanelIndex]?.caption?.title ??
                          comicSequence.panels[selectedComicPanelIndex]?.panelId
                        }`
                      : "暂无分镜"}
                  </div>
                  <div className="small" style={{ marginTop: "var(--ody-space-xs)" }}>
                    {comicSequence?.panels[selectedComicPanelIndex]?.caption?.text ?? "点击左侧分镜可快速定位。"}
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

                  <hr />
                  <div className="row" style={{ flexWrap: "wrap" }}>
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
                      ? chapterTimeline.chapters.map((item) => `${item.id}${item.enabled ? "" : "(disabled)"}`).join(" -> ")
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
                </>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
