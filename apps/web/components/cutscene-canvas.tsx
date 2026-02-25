"use client";

import { useEffect, useMemo, useRef } from "react";
import * as PIXI from "pixi.js";
import { playCutsceneTimeline, setMasterMuted } from "@/lib/cutscene-runtime";
import type { CompiledSceneTimeline } from "@odyssey/shared";

type Props = {
  spec: CompiledSceneTimeline;
  muted: boolean;
  onPlayed?: () => void;
};

export function CutsceneCanvas({ spec, muted, onPlayed }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const volumes = useMemo(
    () => ({ master: 1, bgm: 0.6, sfx: 0.9, voice: 0.8 }),
    []
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new PIXI.Application();
    let cancelled = false;

    void (async () => {
      await app.init({
        width: host.clientWidth || 640,
        height: 280,
        background: "#10131a"
      });

      if (cancelled) return;

      host.appendChild(app.canvas);

      const root = new PIXI.Container();
      root.name = "root";

      const bg = new PIXI.Graphics();
      bg.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0x1d2436, alpha: 1 });
      bg.name = "camera.main";
      root.addChild(bg);

      const speedline = new PIXI.Graphics();
      speedline.rect(0, 120, app.screen.width, 14).fill({ color: 0xf8d083, alpha: 0.9 });
      speedline.alpha = 0;
      speedline.name = "fx.speedline";
      root.addChild(speedline);

      const bubble = new PIXI.Graphics();
      bubble.roundRect(28, 28, 260, 68, 12).fill({ color: 0x111111, alpha: 0.75 });
      bubble.name = "bubble.nono";
      bubble.alpha = 0;
      root.addChild(bubble);

      app.stage.addChild(root);
      setMasterMuted(muted);
      const timeline = playCutsceneTimeline(app, root, spec, volumes);
      timeline.eventCallback("onComplete", () => onPlayed?.());
    })();

    return () => {
      cancelled = true;
      app.destroy(true, { children: true });
      if (app.canvas && host.contains(app.canvas)) {
        host.removeChild(app.canvas);
      }
    };
  }, [spec, muted, volumes, onPlayed]);

  return <div className="canvas-wrap" ref={hostRef} />;
}
