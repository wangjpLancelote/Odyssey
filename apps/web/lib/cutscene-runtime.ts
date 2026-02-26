import gsap from "gsap";
import { Howl, Howler } from "howler";
import type { Application, Container } from "pixi.js";
import type { AudioCue, CompiledSceneTimeline } from "@odyssey/shared";
import { resolveAssetUrl } from "@/lib/asset-resolver";

export type AudioBusVolumes = {
  master: number;
  bgm: number;
  sfx: number;
  voice: number;
  ambient: number;
};

function busFactor(bus: AudioCue["bus"], volumes: AudioBusVolumes): number {
  if (bus === "master") return volumes.master;
  if (bus === "bgm") return volumes.master * volumes.bgm;
  if (bus === "sfx") return volumes.master * volumes.sfx;
  if (bus === "voice") return volumes.master * volumes.voice;
  return volumes.master * volumes.ambient;
}

export function playAudioCue(cue: AudioCue, volumes: AudioBusVolumes): Howl {
  const resolvedSrc = resolveAssetUrl({
    id: cue.id,
    kind: "audio",
    assetPath: cue.src
  });

  const sound = new Howl({
    src: [resolvedSrc],
    volume: cue.volume * busFactor(cue.bus, volumes)
  });
  sound.play();

  if (cue.fadeInMs > 0) {
    sound.volume(0);
    sound.fade(0, cue.volume * busFactor(cue.bus, volumes), cue.fadeInMs);
  }

  if (cue.fadeOutMs > 0) {
    const startFadeOut = Math.max(0, cue.atMs + 400 - cue.fadeOutMs);
    setTimeout(() => {
      const current = sound.volume();
      sound.fade(current, 0, cue.fadeOutMs);
    }, startFadeOut);
  }

  return sound;
}

export function playCutsceneTimeline(
  app: Application,
  root: Container,
  spec: CompiledSceneTimeline,
  volumes: AudioBusVolumes,
  options?: { onTimelineCue?: (payload: { cueId: string; atMs: number }) => void }
): gsap.core.Timeline {
  const timeline = gsap.timeline();

  for (const step of spec.motions) {
    const target = root.getChildByName(step.target) ?? app.stage;
    timeline.fromTo(
      target,
      step.from,
      {
        ...step.to,
        duration: step.durationMs / 1000,
        ease: "power2.out"
      },
      step.atMs / 1000
    );
  }

  for (const cue of spec.audios) {
    timeline.call(() => {
      options?.onTimelineCue?.({ cueId: cue.id, atMs: cue.atMs });
      playAudioCue(cue, volumes);
    }, undefined, cue.atMs / 1000);
  }

  return timeline;
}

export function setMasterMuted(muted: boolean): void {
  Howler.mute(muted);
}
