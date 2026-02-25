import gsap from "gsap";
import { Howl, Howler } from "howler";
import type { Application, Container } from "pixi.js";
import type { AudioCue, CompiledSceneTimeline } from "@odyssey/shared";

export type AudioBusVolumes = {
  master: number;
  bgm: number;
  sfx: number;
  voice: number;
};

function busFactor(bus: AudioCue["bus"], volumes: AudioBusVolumes): number {
  if (bus === "master") return volumes.master;
  if (bus === "bgm") return volumes.master * volumes.bgm;
  if (bus === "sfx") return volumes.master * volumes.sfx;
  return volumes.master * volumes.voice;
}

export function playAudioCue(cue: AudioCue, volumes: AudioBusVolumes): Howl {
  const sound = new Howl({
    src: [cue.src],
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
  volumes: AudioBusVolumes
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
      playAudioCue(cue, volumes);
    }, undefined, cue.atMs / 1000);
  }

  return timeline;
}

export function setMasterMuted(muted: boolean): void {
  Howler.mute(muted);
}
