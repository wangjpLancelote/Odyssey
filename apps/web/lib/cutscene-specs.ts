import type { SceneAVProfile } from "@odyssey/shared";

export const cutsceneDslManifest = {
  "cutscene-cassell-arrival": {
    sceneId: "scene-campus-gate",
    planFile: "cassell-arrival.json",
    moduleFiles: ["cassell-open.json", "cassell-dialogue.json"]
  }
} as const;

export const sceneAvProfiles: SceneAVProfile[] = [
  {
    sceneId: "scene-campus-gate",
    daylightTheme: "theme-campus-day",
    nightTheme: "theme-campus-night",
    defaultBgmBusVolume: 0.55,
    defaultSfxBusVolume: 0.85,
    defaultVoiceBusVolume: 0.8
  }
];
