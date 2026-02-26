"use client";

import { useEffect, useMemo, useState } from "react";
import { detectDayNightBySystemTime } from "@/lib/day-night";

type Props = {
  visible: boolean;
  chapterTitle: string;
};

function formatTimeHHmm(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function GameTopbar({ visible, chapterTitle }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!visible) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [visible]);

  const clockText = useMemo(() => formatTimeHHmm(now), [now]);
  const envPhase = useMemo(() => detectDayNightBySystemTime(now), [now]);

  if (!visible) {
    return null;
  }

  const envText = envPhase === "DAY" ? "营地时相：日（白昼） 🌤️" : "营地时相：夜（夜晚） 🌙";

  return (
    <header className="game-topbar" role="status" aria-live="polite">
      <div className="game-topbar-inner">
        <div className="watch" aria-label="旅程时间与环境">
          <span className="watch-time">{clockText}</span>
          <span className={`watch-env ${envPhase === "DAY" ? "is-day" : "is-night"}`}>{envText}</span>
        </div>

        <h2 className="topbar-chapter-title" title={chapterTitle || "旅程未启"}>
          {chapterTitle || "旅程未启"}
        </h2>
      </div>
    </header>
  );
}

export { formatTimeHHmm };
