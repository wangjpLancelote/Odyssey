"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChapterTimeline, CompiledSceneTimeline } from "@odyssey/shared";
import { NameGate } from "@/components/name-gate";
import { DragonButton } from "@/components/ui-dragon";
import { CutsceneCanvas } from "@/components/cutscene-canvas";
import { GameTopbar } from "@/components/game-topbar";
import { generateRandomDisplayName } from "@/lib/name-generator";
import { getStoredDisplayName, setStoredDisplayName } from "@/lib/name-storage";
import { validateDisplayName } from "@/lib/name-utils";

const DEFAULT_STORYLINE_ID = "fire-dawn";
const DEFAULT_CHAPTER_ID = "ch01";

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
  const [displayName, setDisplayName] = useState("");
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSubmitting, setNameSubmitting] = useState(false);

  const [data, setData] = useState<SessionPayload | null>(null);
  const [footprint, setFootprint] = useState<FootprintPayload | null>(null);
  const [chapterTimeline, setChapterTimeline] = useState<ChapterTimeline | null>(null);
  const [sideQuestInfo, setSideQuestInfo] = useState<string>("尚未唤起支线回响");
  const [muted, setMuted] = useState(false);
  const [statusText, setStatusText] = useState("旅程尚未开始");
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

  function authHeaders(): HeadersInit {
    if (!data?.sessionToken) {
      return { "Content-Type": "application/json" };
    }

    return {
      "Content-Type": "application/json",
      "x-session-token": data.sessionToken
    };
  }

  async function refreshNameSuggestions() {
    try {
      const res = await fetch("/api/player/name/suggest?count=5");
      const json = (await res.json()) as { suggestions?: string[] };
      if (res.ok && json.suggestions) {
        setNameSuggestions(json.suggestions);
        return;
      }
    } catch {
      // fallback to local generator
    }

    setNameSuggestions([
      generateRandomDisplayName(),
      generateRandomDisplayName(),
      generateRandomDisplayName(),
      generateRandomDisplayName(),
      generateRandomDisplayName()
    ]);
  }

  useEffect(() => {
    const storedName = getStoredDisplayName();
    const initial = storedName && !validateDisplayName(storedName) ? storedName : generateRandomDisplayName();
    setDisplayName(initial);
    setStoredDisplayName(initial);
    void refreshNameSuggestions();
  }, []);

  async function loadTimeline(storylineId: string) {
    const res = await fetch(`/api/chapters/timeline?storylineId=${encodeURIComponent(storylineId)}`);
    if (!res.ok) {
      return;
    }
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

    if (!res.ok) {
      return;
    }

    const json = (await res.json()) as { timeline: CompiledSceneTimeline };
    setTimeline(json.timeline);
  }

  const warmAssetUrls = useCallback((assets: ChapterAssetsPayload["criticalPreloadAssets"]) => {
    if (typeof document === "undefined") {
      return;
    }

    for (const asset of assets) {
      if (warmedAssetUrlsRef.current.has(asset.url)) {
        continue;
      }

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

      if (!res.ok) {
        return;
      }

      const payload = (await res.json()) as ChapterAssetsPayload;
      setVideoCueMap(payload.timelineVideoCueMap ?? {});
      warmAssetUrls(payload.criticalPreloadAssets ?? []);
    },
    [warmAssetUrls]
  );

  useEffect(() => {
    if (!data) {
      return;
    }

    void loadChapterAssets(data.session.storylineId, data.session.chapterId, data.sessionToken);
  }, [data, loadChapterAssets]);

  async function startSession() {
    const validationError = validateDisplayName(displayName);
    if (validationError) {
      setNameError(validationError);
      return;
    }

    setNameSubmitting(true);
    setNameError(null);

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
        setNameError("这个名字已被另一位冒险者点亮，换一个更闪耀的吧。");
        setNameSuggestions(json.suggestions ?? []);
      } else {
        setNameError("启程受阻，请稍后再试。");
      }
      setNameSubmitting(false);
      return;
    }

    const payload = json as SessionPayload;
    setStoredDisplayName(payload.session.displayName);
    setDisplayName(payload.session.displayName);
    setData(payload);
    setStatusText(`启程成功，${payload.session.displayName}，前路已亮。 ✨`);
    setFootprint(null);
    setSideQuestInfo("尚未唤起支线回响");
    await Promise.all([loadTimeline(payload.session.storylineId), loadCutscene(payload)]);
    setNameSubmitting(false);
  }

  async function refreshNode() {
    if (!data) return;
    const res = await fetch("/api/dialogue/advance", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ sessionId: data.session.id })
    });

    if (res.status === 401) {
      setStatusText("你的旅程印记已淡去，请重新启程。");
      return;
    }

    const response = (await res.json()) as Omit<SessionPayload, "sessionToken">;
    setData({ ...data, ...response });
  }

  async function commitChoice(choiceId: string) {
    if (!data) return;
    const res = await fetch("/api/choice/commit", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ sessionId: data.session.id, choiceId })
    });

    if (res.status === 401) {
      setStatusText("你的旅程印记已淡去，请重新启程。");
      return;
    }

    const response = (await res.json()) as Omit<SessionPayload, "sessionToken">;
    const next = { ...data, ...response };
    setData(next);
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
      setStatusText("你的旅程印记已淡去，请重新启程。");
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
      setStatusText("你的旅程印记已淡去，请重新启程。");
      return;
    }

    const response = (await res.json()) as RestorePayload;
    const next = { ...data, ...response };
    setData(next);

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
      setStatusText("你的旅程印记已淡去，请重新启程。");
      return;
    }

    if (!res.ok) {
      setStatusText("前往下一幕的通路暂时关闭。");
      return;
    }

    const response = (await res.json()) as RestorePayload;
    const next = { ...data, ...response };
    setData(next);
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
      setStatusText("你的旅程印记已淡去，请重新启程。");
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
      setStatusText("你的旅程印记已淡去，请重新启程。");
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
    await loadCutscene(next);
  }

  function pickRandomName() {
    const name = generateRandomDisplayName();
    setDisplayName(name);
    setStoredDisplayName(name);
    setNameError(null);
  }

  function pickSuggestedName(name: string) {
    setDisplayName(name);
    setStoredDisplayName(name);
    setNameError(null);
  }

  return (
    <main>
      <GameTopbar visible={Boolean(data)} chapterTitle={currentChapterTitle} />
      <div className="shell">
        {!data ? (
          <NameGate
            displayName={displayName}
            suggestions={nameSuggestions}
            error={nameError}
            loading={nameSubmitting}
            onDisplayNameChange={(value) => {
              setDisplayName(value);
              setStoredDisplayName(value);
              setNameError(null);
            }}
            onRandomLocal={pickRandomName}
            onRefreshSuggestions={() => {
              setNameError(null);
              void refreshNameSuggestions();
            }}
            onPickSuggestion={pickSuggestedName}
            onSubmit={() => {
              void startSession();
            }}
          />
        ) : null}

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
              同行者：{data?.session.displayName ?? "尚未入场"}
            </div>
            <div className="small" style={{ marginTop: "var(--ody-space-xs)" }}>
              所在篇章：{data ? `${data.session.storylineId} / ${data.session.chapterId}` : "尚未入场"}
            </div>

            <div className="row" style={{ marginTop: "var(--ody-space-md)" }}>
              <DragonButton variant="secondary" onClick={refreshNode} disabled={!data}>
                聆听下一句
              </DragonButton>
              <DragonButton variant="secondary" onClick={refreshDayNight} disabled={!data}>
                校准昼夜
              </DragonButton>
              <DragonButton onClick={enterNextChapter} disabled={!data || !chapterTimeline}>
                迈向下一幕
              </DragonButton>
            </div>

            {data ? (
              <>
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
              </>
            ) : null}
          </section>

          <aside className="card">
            <h3 style={{ marginTop: 0 }}>旅团仪表盘 🧭</h3>
            <div className="row">
              <DragonButton
                variant="secondary"
                onClick={() => {
                  void loadFootprint();
                }}
                disabled={!data}
              >
                展开足迹
              </DragonButton>
              <DragonButton
                variant="secondary"
                onClick={() => {
                  void triggerSideQuest();
                }}
                disabled={!data}
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
