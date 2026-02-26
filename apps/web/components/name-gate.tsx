"use client";

import { useMemo } from "react";
import { DragonButton } from "@/components/ui-dragon";

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
  onSubmit
}: Props) {
  const hasSuggestions = useMemo(() => suggestions.length > 0, [suggestions]);

  return (
    <section className="name-gate card">
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
    </section>
  );
}
