"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChapterTimeline, CompiledSceneTimeline } from "@odyssey/shared";
import { NameGate } from "@/components/name-gate";
import { Button } from "@/components/ui/button";
import { CutsceneCanvas } from "@/components/cutscene-canvas";
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

export function DialogueGame() {
  const [displayName, setDisplayName] = useState("");
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSubmitting, setNameSubmitting] = useState(false);

  const [data, setData] = useState<SessionPayload | null>(null);
  const [footprint, setFootprint] = useState<FootprintPayload | null>(null);
  const [chapterTimeline, setChapterTimeline] = useState<ChapterTimeline | null>(null);
  const [sideQuestInfo, setSideQuestInfo] = useState<string>("-");
  const [muted, setMuted] = useState(false);
  const [statusText, setStatusText] = useState("尚未开始");
  const [timeline, setTimeline] = useState<CompiledSceneTimeline | null>(null);

  const dayNightClass = useMemo(() => {
    if (!data) return "未知";
    return data.session.dayNight === "DAY" ? "白天" : "夜晚";
  }, [data]);

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
        setNameError("该名字正在使用中，请换一个名字");
        setNameSuggestions(json.suggestions ?? []);
      } else {
        setNameError("启动失败，请稍后重试");
      }
      setNameSubmitting(false);
      return;
    }

    const payload = json as SessionPayload;
    setStoredDisplayName(payload.session.displayName);
    setDisplayName(payload.session.displayName);
    setData(payload);
    setStatusText(`会话已开始：${payload.session.displayName}`);
    setFootprint(null);
    setSideQuestInfo("-");
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
      setStatusText("会话已失效，请重新进入");
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
      setStatusText("会话已失效，请重新进入");
      return;
    }

    const response = (await res.json()) as Omit<SessionPayload, "sessionToken">;
    const next = { ...data, ...response };
    setData(next);
    setStatusText(
      response.session.chapterId === data.session.chapterId
        ? `已选择 ${choiceId}`
        : `已进入新章节 ${response.session.chapterId}`
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
      setStatusText("会话已失效，请重新进入");
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
      setStatusText("会话已失效，请重新进入");
      return;
    }

    const response = (await res.json()) as RestorePayload;
    const next = { ...data, ...response };
    setData(next);

    if (response.resourceReloadedChapter) {
      setStatusText(`已恢复到 ${checkpointId}，切换到章节 ${response.resourceReloadedChapter}`);
      await loadCutscene(next);
      return;
    }

    setStatusText(`已恢复到 ${checkpointId}`);
  }

  async function enterNextChapter() {
    if (!data || !chapterTimeline) return;

    const current = chapterTimeline.chapters.find((item) => item.id === data.session.chapterId);
    if (!current?.nextId) {
      setStatusText("当前章节已无下一章");
      return;
    }

    const res = await fetch("/api/chapters/enter", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ sessionId: data.session.id, toChapterId: current.nextId })
    });

    if (res.status === 401) {
      setStatusText("会话已失效，请重新进入");
      return;
    }

    if (!res.ok) {
      setStatusText("章节切换失败");
      return;
    }

    const response = (await res.json()) as RestorePayload;
    const next = { ...data, ...response };
    setData(next);
    setStatusText(`已进入章节 ${response.session.chapterId}`);
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
      setStatusText("会话已失效，请重新进入");
      return;
    }

    const json = (await res.json()) as {
      state: string;
      blocked: boolean;
      candidates: string[];
    };

    setSideQuestInfo(`${json.state} / blocked=${json.blocked} / ${json.candidates.join(", ") || "none"}`);
  }

  async function refreshDayNight() {
    if (!data) return;
    const res = await fetch(`/api/daynight/current?sessionId=${data.session.id}`, {
      headers: { "x-session-token": data.sessionToken }
    });

    if (res.status === 401) {
      setStatusText("会话已失效，请重新进入");
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
          <h1>龙族对话式剧情游戏 MVP</h1>
          <span className="tag">{dayNightClass}</span>
        </div>

        <div className="small">主题核心：孤独 / 自我选择 / 宿命选择</div>

        <div className="grid" style={{ marginTop: 16 }}>
          <section className="card">
            <div className="row">
              <h2 style={{ margin: 0 }}>剧情推进</h2>
              <div className="small">{statusText}</div>
            </div>

            <div className="small" style={{ marginTop: 10 }}>
              当前姓名：{data?.session.displayName ?? "未进入"}
            </div>
            <div className="small" style={{ marginTop: 4 }}>
              当前章节：{data ? `${data.session.storylineId} / ${data.session.chapterId}` : "未进入"}
            </div>

            <div className="row" style={{ marginTop: 10 }}>
              <Button onClick={refreshNode} disabled={!data}>
                刷新节点
              </Button>
              <Button onClick={refreshDayNight} disabled={!data}>
                刷新昼夜
              </Button>
              <Button onClick={enterNextChapter} disabled={!data || !chapterTimeline}>
                进入下一章
              </Button>
            </div>

            {data ? (
              <>
                <hr style={{ margin: "16px 0", borderColor: "#2f3550" }} />
                <div className="small">节点: {data.node.id}</div>
                <p>
                  <strong>{data.node.speaker}：</strong>
                  {data.node.content}
                </p>
                <div className="choices">
                  {data.node.choices.map((choice) => (
                    <Button
                      key={choice.id}
                      className="choice-btn"
                      onClick={() => {
                        void commitChoice(choice.id);
                      }}
                    >
                      {choice.label}
                    </Button>
                  ))}
                  {data.node.choices.length === 0 ? <div className="small">本节点无后续选项。</div> : null}
                </div>
              </>
            ) : null}
          </section>

          <aside className="card">
            <h3 style={{ marginTop: 0 }}>系统面板</h3>
            <div className="row">
              <Button
                onClick={() => {
                  void loadFootprint();
                }}
                disabled={!data}
              >
                读取足迹
              </Button>
              <Button
                onClick={() => {
                  void triggerSideQuest();
                }}
                disabled={!data}
              >
                触发支线
              </Button>
            </div>

            <div style={{ marginTop: 12 }} className="small">
              AI状态机: {sideQuestInfo}
            </div>

            <hr style={{ margin: "14px 0", borderColor: "#2f3550" }} />

            <div className="small">章节时间线</div>
            <div className="small" style={{ marginTop: 8 }}>
              {chapterTimeline
                ? chapterTimeline.chapters
                    .map((item) => `${item.id}${item.enabled ? "" : "(disabled)"}`)
                    .join(" -> ")
                : "未加载"}
            </div>

            <hr style={{ margin: "14px 0", borderColor: "#2f3550" }} />

            <div className="small">足迹检查点（仅当前会话可见）</div>
            <div className="choices" style={{ marginTop: 8 }}>
              {footprint?.checkpoints?.map((cp) => (
                <Button
                  key={cp.checkpointId}
                  onClick={() => {
                    void restore(cp.checkpointId);
                  }}
                >
                  {cp.checkpointId} {"->"} {cp.chapterId}:{cp.nodeId}
                </Button>
              ))}
              {!footprint ? <div className="small">尚未加载</div> : null}
            </div>

            <hr style={{ margin: "14px 0", borderColor: "#2f3550" }} />
            <div className="row">
              <div className="small">音频开关</div>
              <Button onClick={() => setMuted((value) => !value)}>{muted ? "取消静音" : "静音"}</Button>
            </div>
          </aside>
        </div>

        {timeline ? (
          <section className="card" style={{ marginTop: 16 }}>
            <div className="row">
              <h2 style={{ margin: 0 }}>过场分镜（PixiJS + GSAP + Howler）</h2>
              <div className="small">{timeline.cutsceneId}</div>
            </div>
            <CutsceneCanvas spec={timeline} muted={muted} onPlayed={() => setStatusText("过场播放完成")} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
