# Changelog

## 2026-02-26

### Added
- 章节资产 API：`GET /api/chapters/assets`，返回章节资源清单、关键预加载资源、`timelineVideoCueMap`。
- 统一资产解析器：`apps/web/lib/asset-resolver.ts`，支持 `ASSET_MODE=local|r2` 与旧路径兼容映射。
- 资源目录骨架：`apps/web/public/assets/fire-dawn/ch01|ch02/...`，按 `storyline/chapter/type` 分层。
- 资产解析测试：`apps/web/lib/asset-resolver.test.ts`。

### Changed
- README 移除 API 详细列表，改为仅保留接口目录说明（`apps/web/app/api`）。
- 共享类型升级：`packages/shared/src/types.ts`
  - `audioBus` 增加 `ambient`
  - 增加 `chapterAssetManifestV2Schema`、`audio/video/image/sprite` 资产 schema
  - 增加 `scene_enter/node_enter/timeline_cue` 触发 schema
  - 增加 `resolvedAssetRefSchema`
  - `chapterResourceManifestSchema` 支持 v2，并兼容 v1 自动转换
- 章节资源管理：`apps/web/lib/server/chapter-resource-manager.ts`
  - `ChapterBundle` 增加 `assetManifest` 与 `criticalPreloadAssets`
  - 新增 `getChapterAssets()`
- 过场运行时：`apps/web/lib/cutscene-runtime.ts`
  - Howler 播放 URL 走 `AssetResolver`
  - 音量总线加入 `ambient`
  - 支持 timeline cue 回调
- 过场渲染：`apps/web/components/cutscene-canvas.tsx`
  - 新增 HTMLVideo overlay（关键帧触发显隐）
- 前端接入：`apps/web/components/dialogue-game.tsx`
  - 章节切换时拉取资产清单
  - 预加载关键资源
  - 将 `timelineVideoCueMap` 传入过场组件
- 章节资源清单迁移到 v2：
  - `docs/chapters/fire-dawn/ch01/resources/manifest.json`
  - `docs/chapters/fire-dawn/ch02/resources/manifest.json`
- README 更新资源配置说明：`ASSET_MODE`、`R2_PUBLIC_BASE_URL`、新增 API。

### Verified
- `bun run --cwd apps/web lint` 通过
- `bun test` 通过
- `bun run --cwd apps/web build` 通过
