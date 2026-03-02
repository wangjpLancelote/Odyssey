"use client";

import { useMemo } from "react";
import type { DialogueChoice } from "@odyssey/shared";

type Hotspot = {
  x: number;
  y: number;
};

type Props = {
  chapterId: string;
  nodeId: string;
  speaker: string;
  content: string;
  choices: DialogueChoice[];
  onChoose: (choiceId: string) => void;
};

const HOTSPOT_PRESETS: Hotspot[] = [
  { x: 18, y: 28 },
  { x: 52, y: 46 },
  { x: 78, y: 30 },
  { x: 34, y: 72 },
  { x: 68, y: 72 }
];

function chapterThemeClass(chapterId: string): string {
  const numeric = Number(chapterId.replace(/\D/g, ""));
  if (!Number.isFinite(numeric)) return "theme-default";
  if (numeric % 3 === 1) return "theme-dawn";
  if (numeric % 3 === 2) return "theme-night";
  return "theme-ember";
}

export function StoryHotspotStage({ chapterId, nodeId, speaker, content, choices, onChoose }: Props) {
  const hotspots = useMemo(
    () =>
      choices.map((choice, index) => ({
        choice,
        point: HOTSPOT_PRESETS[index] ?? HOTSPOT_PRESETS[HOTSPOT_PRESETS.length - 1] ?? { x: 50, y: 50 }
      })),
    [choices]
  );

  return (
    <section className={`story-hotspot-stage ${chapterThemeClass(chapterId)}`} aria-label="剧情热点选择">
      <div className="story-hotspot-bg" />
      <div className="story-hotspot-overlay" />

      <header className="story-hotspot-caption">
        <div className="story-hotspot-kicker">{chapterId.toUpperCase()} / {nodeId}</div>
        <h3>{speaker}</h3>
        <p>{content}</p>
      </header>

      <div className="story-hotspot-canvas" role="list" aria-label="可选剧情分支">
        {hotspots.map(({ choice, point }, index) => (
          <button
            key={choice.id}
            type="button"
            role="listitem"
            className="story-hotspot-point"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            onClick={() => onChoose(choice.id)}
            aria-label={choice.label}
          >
            <span className="story-hotspot-index">{index + 1}</span>
            <span className="story-hotspot-label">{choice.label}</span>
          </button>
        ))}

        {hotspots.length === 0 ? (
          <div className="story-hotspot-empty">当前节点没有分支选项，可在右侧继续推进剧情。</div>
        ) : null}
      </div>
    </section>
  );
}
