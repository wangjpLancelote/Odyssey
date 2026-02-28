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
  fullscreen?: boolean;
  onPlayed?: () => void;
  onError?: () => void;
};

export function CutsceneCanvas({ spec, muted, videoCueMap, fullscreen = false, onPlayed, onError }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const onPlayedRef = useRef<Props["onPlayed"]>(onPlayed);
  const onErrorRef = useRef<Props["onError"]>(onError);
  const videoCueMapRef = useRef<Props["videoCueMap"]>(videoCueMap);
  const [activeVideo, setActiveVideo] = useState<VideoCue | null>(null);

  const volumes = useMemo(
    () => ({ master: 1, bgm: 0.6, sfx: 0.9, voice: 0.8, ambient: 0.55 }),
    []
  );

  useEffect(() => {
    onPlayedRef.current = onPlayed;
  }, [onPlayed]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    videoCueMapRef.current = videoCueMap;
  }, [videoCueMap]);

  useEffect(() => {
    setMasterMuted(muted);
  }, [muted]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const app = new PIXI.Application();
    let cancelled = false;
    let initialized = false;
    let destroyed = false;
    let timeline: ReturnType<typeof playCutsceneTimeline> | null = null;
    setActiveVideo(null);

    const destroyApp = () => {
      if (destroyed) return;
      destroyed = true;
      if (timeline) {
        timeline.kill();
        timeline = null;
      }
      if (!initialized) return;

      const canvas = app.canvas;
      try {
        app.destroy({ removeView: true }, { children: true });
      } catch {
        // Ignore teardown errors during rapid mount/unmount in dev mode.
      }

      if (canvas && stage.contains(canvas)) {
        stage.removeChild(canvas);
      }
    };

    void (async () => {
      try {
        await app.init({
          width: stage.clientWidth || 640,
          height: fullscreen ? stage.clientHeight || window.innerHeight || 640 : 280,
          background: "#10131a"
        });
        initialized = true;

        if (cancelled) {
          destroyApp();
          return;
        }

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
        timeline = playCutsceneTimeline(app, root, spec, volumes, {
          onTimelineCue: ({ cueId }) => {
            const mapped = videoCueMapRef.current?.[cueId];
            if (mapped && !cancelled && !destroyed) {
              setActiveVideo(mapped);
            }
          }
        });
        timeline.eventCallback("onComplete", () => {
          if (!cancelled && !destroyed) {
            onPlayedRef.current?.();
          }
        });
      } catch {
        destroyApp();
        if (!cancelled && !destroyed) {
          onErrorRef.current?.();
        }
      }
    })();

    return () => {
      cancelled = true;
      destroyApp();
    };
  }, [spec, volumes, fullscreen]);

  return (
    <div className={fullscreen ? "canvas-wrap canvas-wrap-fullscreen" : "canvas-wrap"}>
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
            onError={() => {
              console.warn(`[cutscene] video load failed: ${activeVideo.src}`);
              setActiveVideo(null);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
