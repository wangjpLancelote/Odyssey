# Changelog

## 2026-02-28

### Changed
- `/version` 页面视觉与文案升级：
  - 页面改为与 `new-story`、`memories` 一致的 `entry/card` 风格容器
  - 标题由“版本信息”改为“纪元档案 👑”
  - 新增“前往更新日志”快捷入口与版本来源说明
- 首页版本入口文案同步调整：
  - `/` 菜单项“版本信息”改为“纪元档案”
- 新手开局增加一次性背景序章过场：
  - 仅在“新的故事”首次成功开局后触发，需点击“下一步，进入旅程”才进入正式游戏
  - “旧的回忆”与后续进入不会重复触发
  - 新增入口来源与序章已读本地标记，用于前端路由流程判断
- Supabase 开局容错修复：
  - `session/start` 对 `ody_start_session` 增加新旧签名兼容回退（含 `p_storyline_id` 缺失场景）
  - 将数据库层重复名冲突映射为 `name_conflict`，避免新玩家看到 `supabase_query_failed` 泛错误
  - 增强启动失败日志，便于定位 Supabase RPC 具体错误码
- `session/start` 实际连通性修复（Playwright 验证）：
  - 修复 Supabase TLS 自签证书链导致的连接失败（开发环境默认允许，支持 `SUPABASE_ALLOW_SELF_SIGNED_TLS` 显式控制）
  - 当数据库函数 `ody_start_session` 因 `created_at` 歧义报错时，自动降级为直写表流程完成开局
  - 新增 Playwright e2e 回归用例：`e2e/session-start.spec.ts`
- 过场画布销毁稳定性修复：
  - 修复进入 `/game` 后偶发 `this._cancelResize is not a function`
  - `CutsceneCanvas` 增加 Pixi 初始化状态与防重复销毁保护，避免在 `init` 前或重复 `destroy` 时触发 ResizePlugin 异常
- webpack 开发缓存并发冲突修复：
  - 新增 `NEXT_DIST_DIR` 配置支持（`apps/web/next.config.ts`）
  - Playwright e2e 开发服务改为独立输出目录 `.next-e2e`，避免与本地 `next dev` 共用 `.next` 引发 `PackFileCacheStrategy` rename 警告
- Playwright e2e 进程回收修复：
  - `playwright.e2e.config.ts` 设置 `reuseExistingServer: false`
  - 测试结束后自动关闭 Playwright 自行拉起的 webServer 进程，避免残留 dev 进程
- 接口提示统一 Message 组件：
  - 新增 `ui-message` 组件，统一 `info/success/warning/error` 提示样式
  - 重名冲突、旧忆恢复错误、首页门禁提示改为 Message 展示
  - 游戏内主线状态提示由普通文本改为 Message 展示
- 全局 Toast 提示系统：
  - 新增 `ToastProvider` 与 `useToast`，挂载到根布局（全局可用）
  - `new-story`、`memories`、`game` 的接口响应统一触发 toast（成功/警告/失败）
  - 新增全局 toast 样式与移动端适配

## 2026-02-27

### Added
- 旧忆前置过场启动链路：
  - `/memories` 在 `session/recall` 成功后，先预取节点与过场资源，再全屏播放过场后进入 `/game`
  - 新增一次性 bootstrap 缓存：`apps/web/lib/session-bootstrap.ts`
  - `/game` 支持消费 bootstrap 数据并优先首帧渲染

### Changed
- 新故事命名页恢复完整命名体验：
  - `/new-story` 接入 `NameGate` 新故事模式（默认名、随机名、候选名看板、规则看板）
  - 保留现有冲突与错误语义（`name_conflict`、通用失败）
- 过场组件增强：
  - `CutsceneCanvas` 新增 `fullscreen` 与 `onError` 支持，用于旧忆全屏过场与失败降级
- 样式补充：
  - 新增命名看板样式与旧忆全屏过场样式（含移动端适配）

## 2026-02-26

### Added
- 首页帆船背景资源：`apps/web/public/assets/ui/home-voyage-sailship.svg`（远航主题）。
- 新增首页与路由重构：
  - `/` 首页四入口主菜单
  - `/new-story` 新故事开局页
  - `/memories` 旧忆恢复页
  - `/game` 正式游戏页
  - `/changelog` 更新日志页
  - `/version` 版本信息页
- 新增路由守卫中间件：`apps/web/middleware.ts`，未完成开局/恢复不可进入 `/game`。
- 新增会话门禁 cookie 工具：`ody_entry_ready`（`markEntryReady` / `clearEntryReady`）。
- 章节资产 API：`GET /api/chapters/assets`，返回章节资源清单、关键预加载资源、`timelineVideoCueMap`。
- 统一资产解析器：`apps/web/lib/asset-resolver.ts`，支持 `ASSET_MODE=local|r2` 与旧路径兼容映射。
- 资源目录骨架：`apps/web/public/assets/fire-dawn/ch01|ch02/...`，按 `storyline/chapter/type` 分层。
- 资产解析测试：`apps/web/lib/asset-resolver.test.ts`。

### Changed
- 引入并落地 Tailwind CSS v4 页面层改造：
  - `apps/web/app/page.tsx` 重写为 Tailwind utility 结构（首页主视觉、帆船背景、右侧骑士菜单）。
  - `apps/web/app/layout.tsx` 使用 Tailwind utility 设置全局 `body` 外观与字体。
  - `apps/web/app/changelog/page.tsx` 与 `apps/web/app/version/page.tsx` 改为 Tailwind utility 布局与卡片样式。
- 首页菜单布局微调：
  - 菜单改为绝对定位贴右，不再占用中间主画面区域
  - 菜单背景透明度降低，减弱对主画面的遮挡
  - 菜单项纵向间距进一步增大
- 首页结构继续优化：
  - 去除首页中部黑色大卡片容器（保留文字）
  - 标题与副标题移至整体画面上方居中
  - 帆船前景显著放大并上移，确保首屏可见
  - 右侧悬挂菜单下移，避免遮挡上方文案
- 首页骑士菜单交互回调：
  - 取消按钮 hover 的大幅晃动关键帧
  - 恢复为轻微上浮高亮（无旋转）
- 首页骑士菜单交互优化：
  - 四入口纵向间隔增大（桌面与移动端均拉开）
  - hover 晃动幅度增大，加入更明显的摆动关键帧动画
- 首页右侧悬挂菜单改为写实骑士风材质：
  - 菜单面板加入钢铁渐变、皮革挂带、铆钉细节与金属高光
  - 入口按钮加入徽章符号（⚜）与写实阴影层
  - 保留原有入口 emoji（⚔️/🛡️/📜/👑）
- 首页菜单形态改为“魔兽争霸式右侧悬挂”：
  - 四入口挂载到右侧竖向菜单
  - 增加悬挂链条装饰
  - 增加轻微“风吹摆动”动画（含 `prefers-reduced-motion` 降级）
  - 移动端自动回退为居中稳定竖排
- 首页四入口按钮升级为骑士风视觉：
  - 每个按钮增加 emoji 主图标（⚔️/🛡️/📜/👑）
  - 增加副标题铭文（骑士试炼/封印档案/军团战报/版本信息）
  - 增加纹章网格、金属描边与徽记装饰元素
- 首页视觉重构：
  - 四入口由宫格改为竖向入口栈（中央对齐）
  - 标题与副标题改为中央英雄区排版
  - 首页背景增加帆船远航主题多层背景（暗幕/海雾/帆船）
  - 移动端保持竖排并下沉背景图位置，避免压标题
- `DialogueGame` 重构为纯游戏运行态组件，不再承担首页命名/回忆入口职责。
- `POST /api/session/recall` 错误语义细分：
  - `404 name_not_found`
  - `409 no_active_session`
- `gameStore.recallSession` 改为两段式查询：先判定玩家名存在，再查询活跃会话并恢复当前进度。
- `packages/shared/src/types.ts` 增加 `recallSessionErrorSchema`。
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
