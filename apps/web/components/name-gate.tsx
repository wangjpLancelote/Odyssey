"use client";

import { useMemo, useState } from "react";
import { DragonButton } from "@/components/ui-dragon";
import { Message } from "@/components/ui-message";

type Mode = "new" | "recall";

type Props = {
  showModeTabs?: boolean;
  displayName: string;
  suggestions: string[];
  error: string | null;
  loading: boolean;
  onDisplayNameChange: (value: string) => void;
  onRandomLocal: () => void;
  onRefreshSuggestions: () => void;
  onPickSuggestion: (name: string) => void;
  onSubmit: () => void;
  recallName: string;
  recallError: string | null;
  recallLoading: boolean;
  onRecallNameChange: (value: string) => void;
  onRecall: () => void;
};

export function NameGate({
  showModeTabs = true,
  displayName,
  suggestions,
  error,
  loading,
  onDisplayNameChange,
  onRandomLocal,
  onRefreshSuggestions,
  onPickSuggestion,
  onSubmit,
  recallName,
  recallError,
  recallLoading,
  onRecallNameChange,
  onRecall
}: Props) {
  const [mode, setMode] = useState<Mode>("new");
  const hasSuggestions = useMemo(() => suggestions.length > 0, [suggestions]);
  const activeMode: Mode = showModeTabs ? mode : "new";

  return (
    <section className="name-gate card">
      {showModeTabs ? (
        <div className="row" style={{ marginBottom: "var(--ody-space-md)" }}>
          <DragonButton
            variant={mode === "new" ? "default" : "ghost"}
            onClick={() => setMode("new")}
          >
            新的故事
          </DragonButton>
          <DragonButton
            variant={mode === "recall" ? "default" : "ghost"}
            onClick={() => setMode("recall")}
          >
            旧的回忆
          </DragonButton>
        </div>
      ) : null}

      {activeMode === "new" ? (
        <>
          <h2 style={{ marginTop: 0 }}>命名出征 ⚔️</h2>
          <p className="small">给自己取个响亮的名号，再推开《火之晨曦》的大门。可随机召唤，也可亲手书写。</p>

          <div className="row" style={{ marginTop: "var(--ody-space-md)" }}>
            <input
              className="dragon-input"
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              placeholder="写下你的冒险名号"
            />
          </div>

          <div className="row" style={{ marginTop: "var(--ody-space-md)" }}>
            <DragonButton variant="secondary" onClick={onRandomLocal}>随机召唤</DragonButton>
            <DragonButton variant="secondary" onClick={onRefreshSuggestions}>再换一批</DragonButton>
            <DragonButton onClick={onSubmit} disabled={loading}>
              {loading ? "启程中..." : "踏入旅程"}
            </DragonButton>
          </div>

          {error ? <Message tone="warning" className="mt-3">{error}</Message> : null}

          <div className="name-gate-board-grid">
            <div className="name-gate-board">
              <h3 className="name-gate-board-title">候选名看板</h3>
              {hasSuggestions ? (
                <div className="choices" style={{ marginTop: "var(--ody-space-sm)" }}>
                  {suggestions.map((item) => (
                    <DragonButton
                      key={item}
                      variant="outline"
                      className="choice-btn"
                      onClick={() => onPickSuggestion(item)}
                    >
                      {item}
                    </DragonButton>
                  ))}
                </div>
              ) : (
                <div className="small" style={{ marginTop: "var(--ody-space-sm)" }}>
                  正在收集可用名号...
                </div>
              )}
            </div>

            <div className="name-gate-board">
              <h3 className="name-gate-board-title">命名规则</h3>
              <ul className="name-gate-rule-list">
                <li>长度 2 到 12 个字符</li>
                <li>支持中文、字母、数字、下划线</li>
                <li>进入会话后名字锁定</li>
                <li>若重名会返回替代建议</li>
              </ul>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 style={{ marginTop: 0 }}>唤醒旧忆 🌙</h2>
          <p className="small">输入你曾用过的冒险名号，找回未完的旅程。名字是你唯一的钥匙。</p>

          <div className="row" style={{ marginTop: "var(--ody-space-md)" }}>
            <input
              className="dragon-input"
              value={recallName}
              onChange={(event) => onRecallNameChange(event.target.value)}
              placeholder="输入曾用的名号"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !recallLoading) onRecall();
              }}
            />
          </div>

          <div className="row" style={{ marginTop: "var(--ody-space-md)" }}>
            <DragonButton onClick={onRecall} disabled={recallLoading}>
              {recallLoading ? "寻觅中..." : "唤醒记忆"}
            </DragonButton>
          </div>

          {recallError ? <Message tone="warning" className="mt-3">{recallError}</Message> : null}
        </>
      )}
    </section>
  );
}
