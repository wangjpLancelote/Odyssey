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

export function playAudioCue(cue: AudioCue, volumes: AudioBusVolumes): Howl | null {
  const resolvedSrc = resolveAssetUrl({
    id: cue.id,
    kind: "audio",
    assetPath: cue.src
  });

  try {
    const targetVolume = cue.volume * busFactor(cue.bus, volumes);
    const sound = new Howl({
      src: [resolvedSrc],
      volume: targetVolume,
      onloaderror: () => {
        console.warn(`[cutscene] audio load failed: ${cue.id} -> ${resolvedSrc}`);
      },
      onplayerror: () => {
        console.warn(`[cutscene] audio play failed: ${cue.id} -> ${resolvedSrc}`);
      }
    });

    try {
      sound.play();
    } catch {
      console.warn(`[cutscene] audio play threw: ${cue.id} -> ${resolvedSrc}`);
      return sound;
    }

    if (cue.fadeInMs > 0) {
      sound.volume(0);
      sound.fade(0, targetVolume, cue.fadeInMs);
    }

    if (cue.fadeOutMs > 0) {
      const startFadeOut = Math.max(0, cue.atMs + 400 - cue.fadeOutMs);
      setTimeout(() => {
        try {
          const current = sound.volume();
          sound.fade(current, 0, cue.fadeOutMs);
        } catch {
          // Ignore fade errors so missing assets never block page flow.
        }
      }, startFadeOut);
    }

    return sound;
  } catch {
    console.warn(`[cutscene] audio cue skipped: ${cue.id} -> ${resolvedSrc}`);
    return null;
  }
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
      try {
        playAudioCue(cue, volumes);
      } catch {
        console.warn(`[cutscene] audio timeline step ignored: ${cue.id}`);
      }
    }, undefined, cue.atMs / 1000);
  }

  return timeline;
}

export function setMasterMuted(muted: boolean): void {
  Howler.mute(muted);
}
