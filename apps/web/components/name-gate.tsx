"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";

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
      <h2 style={{ marginTop: 0 }}>命名入场</h2>
      <p className="small">先取一个名字再进入《火之晨曦》主线。名字支持随机生成和自定义。</p>

      <div className="row" style={{ marginTop: 12 }}>
        <input
          value={displayName}
          onChange={(event) => onDisplayNameChange(event.target.value)}
          placeholder="输入你的名字"
          style={{
            width: "100%",
            borderRadius: 8,
            border: "1px solid #454d6f",
            background: "#10141f",
            color: "#fff",
            padding: "8px 10px"
          }}
        />
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <Button onClick={onRandomLocal}>随机一个</Button>
        <Button onClick={onRefreshSuggestions}>换一批建议名</Button>
        <Button variant="accent" onClick={onSubmit} disabled={loading}>
          {loading ? "进入中..." : "进入游戏"}
        </Button>
      </div>

      {error ? (
        <div className="small" style={{ color: "#ff8f8f", marginTop: 10 }}>
          {error}
        </div>
      ) : null}

      {hasSuggestions ? (
        <div className="choices" style={{ marginTop: 12 }}>
          {suggestions.map((item) => (
            <Button key={item} className="choice-btn" onClick={() => onPickSuggestion(item)}>
              {item}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
