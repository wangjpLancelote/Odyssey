"use client";

import { useMemo, useState } from "react";
import { DragonButton } from "@/components/ui-dragon";

type Mode = "new" | "recall";

type Props = {
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

  return (
    <section className="name-gate card">
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

      {mode === "new" ? (
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

          {error ? <div className="error-text">{error}</div> : null}

          {hasSuggestions ? (
            <div className="choices" style={{ marginTop: "var(--ody-space-md)" }}>
              {suggestions.map((item) => (
                <DragonButton key={item} variant="outline" className="choice-btn" onClick={() => onPickSuggestion(item)}>
                  {item}
                </DragonButton>
              ))}
            </div>
          ) : null}
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

          {recallError ? <div className="error-text">{recallError}</div> : null}
        </>
      )}
    </section>
  );
}
