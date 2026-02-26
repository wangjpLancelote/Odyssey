"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { playCutsceneTimeline, setMasterMuted } from "@/lib/cutscene-runtime";
import type { CompiledSceneTimeline } from "@odyssey/shared";

type VideoCue = {
  src: string;
  poster?: string;
  loop?: boolean;
};

type Props = {
  spec: CompiledSceneTimeline;
  muted: boolean;
  videoCueMap?: Record<string, VideoCue>;
  onPlayed?: () => void;
};

export function CutsceneCanvas({ spec, muted, videoCueMap, onPlayed }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [activeVideo, setActiveVideo] = useState<VideoCue | null>(null);

  const volumes = useMemo(
    () => ({ master: 1, bgm: 0.6, sfx: 0.9, voice: 0.8, ambient: 0.55 }),
    []
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const app = new PIXI.Application();
    let cancelled = false;
    setActiveVideo(null);

    void (async () => {
      await app.init({
        width: stage.clientWidth || 640,
        height: 280,
        background: "#10131a"
      });

      if (cancelled) return;

      stage.appendChild(app.canvas);

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
      const timeline = playCutsceneTimeline(app, root, spec, volumes, {
        onTimelineCue: ({ cueId }) => {
          const mapped = videoCueMap?.[cueId];
          if (mapped) {
            setActiveVideo(mapped);
          }
        }
      });
      timeline.eventCallback("onComplete", () => onPlayed?.());
    })();

    return () => {
      cancelled = true;
      app.destroy(true, { children: true });
      if (app.canvas && stage.contains(app.canvas)) {
        stage.removeChild(app.canvas);
      }
    };
  }, [spec, muted, volumes, videoCueMap, onPlayed]);

  return (
    <div className="canvas-wrap">
      <div className="canvas-stage" ref={stageRef} />
      {activeVideo ? (
        <div className="cutscene-video-overlay">
          <video
            key={activeVideo.src}
            className="cutscene-video"
            src={activeVideo.src}
            poster={activeVideo.poster}
            autoPlay
            loop={activeVideo.loop ?? false}
            muted={muted}
            playsInline
            onEnded={() => setActiveVideo(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
