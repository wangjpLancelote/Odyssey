import type { SceneAVProfile } from "@odyssey/shared";

export function createSceneAvProfile(sceneId: string): SceneAVProfile {
  return {
    sceneId,
    daylightTheme: `${sceneId}-day-theme`,
    nightTheme: `${sceneId}-night-theme`,
    defaultBgmBusVolume: 0.55,
    defaultSfxBusVolume: 0.85,
    defaultVoiceBusVolume: 0.8
  };
}

export const sceneAvProfiles: SceneAVProfile[] = [];
