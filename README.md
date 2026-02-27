# Odyssey MVP

一个以《龙族》风格为主线的对话式场景剧情游戏 MVP。  
首页提供四入口主菜单（新的故事 / 旧的回忆 / 更新日志 / 版本信息），完成命名开局或回忆恢复后，才可进入正式游戏流程。

## 应用介绍

当前 MVP 聚焦以下核心能力：
- 匿名进入：无登录/注册，首页四入口导航。
- 新故事开局：随机/自定义命名，成功后进入游戏。
- 旧忆恢复：输入名字匹配 Supabase 记录并恢复活跃会话。
- 主线章节：固定主线节点，保证叙事骨架稳定。
- AI 支线：规则状态机 + LLM 生成候选分支。
- 足迹系统：玩家私有足迹图与检查点回放。
- 过场系统：PixiJS + GSAP + Howler.js。
- 场景 DSL：低嵌套 JSON DSL（模块 + 编排）编译为运行时时间线。
- 章节内容系统：按故事线/章节拆分目录，`dsl/text/schema` 物理隔离。
- 昼夜系统：按系统时间切换 DAY/NIGHT。
- 数据持久化：Supabase（会话、名字锁、足迹、剧情边、支线状态）。

## 世界观基石

主题摘要：
- 孤独：角色始终处于高压与理解缺失的状态。
- 自我选择：每次推进都需要主动承担代价。
- 宿命选择：选择存在，但边界与后果受世界规则约束。

规则摘要：
- 世界规则优先级高于 AI 支线创作结果。
- 等级/血统/言灵三系统共同约束能力上限。
- 主线章节顺序固定，支线不可改写主线骨架。

快速入口：
- [世界观总览](./docs/world/README.md)
- [三支柱主题](./docs/world/pillars.md)
- [世界规则](./docs/world/world-rules.md)
- [等级系统](./docs/world/systems-rank.md)
- [血统系统](./docs/world/systems-bloodline.md)
- [言灵系统](./docs/world/systems-word-spirit.md)
- [组织与角色关系](./docs/world/factions-and-roles.md)
- [火之晨曦 MVP 时间线](./docs/world/timeline-fire-dawn-mvp.md)
- [AI 约束配置](./docs/world/ai-constraint-profile.md)
- [术语表](./docs/world/glossary.md)

## 技术栈

- Runtime/Monorepo: Bun workspaces
- Web: Next.js(App Router), React, shadcn-style UI
- AV: PixiJS, GSAP, Howler.js
- Data: Supabase(Postgres)
- Type/Validation: TypeScript, Zod

## 变更记录

- 项目级开发变更：[`changelog.md`](./changelog.md)
- 更新规则：[`docs/changelog-policy.md`](./docs/changelog-policy.md)
- 世界观文档变更：[`docs/world/change-log.md`](./docs/world/change-log.md)

## 目录结构

```txt
.
├─ apps/
│  └─ web/                      # Next.js 前端与 API Routes
│     ├─ app/                   # 页面路由（/ /new-story /memories /game /changelog /version）
│     └─ public/assets/         # 章节化音视频资源目录（local/r2 可切换）
├─ services/
│  └─ worker/                   # Bun worker（异步任务骨架）
├─ packages/
│  ├─ shared/                   # 公共 schema/types（zod）
│  ├─ domain/                   # 剧情与世界观领域模型
│  ├─ engine/                   # 规则引擎（足迹/剧情树/校验）
│  ├─ ai/                       # AI 支线生成适配层
│  ├─ realtime/                 # 实时事件协议
│  ├─ analytics/                # 埋点事件定义
│  └─ scene-dsl/                # 分镜 DSL 编译器（模块+时间线）
├─ changelog.md                 # 项目级变更日志（仅新模块/新Feature/Bug修复更新）
├─ docs/
│  ├─ architecture.md           # 架构说明
│  ├─ changelog-policy.md       # changelog 更新策略
│  ├─ narrative-bible.md        # 兼容入口（迁移到 docs/world）
│  ├─ supabase-setup.md         # Supabase 初始化说明
│  ├─ world/                    # 世界观基石文档
│  │  ├─ README.md
│  │  ├─ pillars.md
│  │  ├─ world-rules.md
│  │  ├─ systems-rank.md
│  │  ├─ systems-bloodline.md
│  │  ├─ systems-word-spirit.md
│  │  ├─ factions-and-roles.md
│  │  ├─ timeline-fire-dawn-mvp.md
│  │  ├─ ai-constraint-profile.md
│  │  ├─ glossary.md
│  │  └─ change-log.md
│  ├─ chapters/                 # 章节化内容系统（storyline/chapter）
│  │  └─ fire-dawn/
│  │     ├─ storyline.md
│  │     ├─ timeline.json
│  │     ├─ ch01/
│  │     └─ ch02/
│  └─ storyboard/               # 旧版分镜目录（兼容保留）
├─ supabase/
│  └─ migrations/
│     ├─ 20260226_odyssey_mvp.sql
│     └─ 20260226_odyssey_chapter_timeline.sql
└─ prisma/
   └─ schema.prisma             # 未来 Prisma 扩展模型（当前主存储为 Supabase）
```

## 环境配置（根目录 `.env`）

按你的约束，环境变量统一放在仓库根目录 `.env`：

```bash
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
ASSET_MODE="local"                         # local | r2
R2_PUBLIC_BASE_URL="https://cdn.example.com/odyssey"  # ASSET_MODE=r2 时生效
NEXT_PUBLIC_ASSET_MODE="local"            # 前端显式切换（可选）
NEXT_PUBLIC_R2_PUBLIC_BASE_URL="https://cdn.example.com/odyssey" # 前端显式切换（可选）
```

可参考模板：`.env.example`。

## 数据库迁移

执行 Supabase migration SQL：

- `supabase/migrations/20260226_odyssey_mvp.sql`
- `supabase/migrations/20260226_odyssey_chapter_timeline.sql`

该迁移会创建：
- 匿名玩家与会话表
- 名字锁表（重名校验）
- 足迹/检查点/剧情边/支线状态表
- 章节时间线表与章节顺序校验函数
- `ody_start_session`、`ody_authorize_session` 等函数

## 启动方式

### 1) 安装依赖

```bash
bun install
```

### 2) 启动 Web

```bash
bun run dev:web
```

默认启动 Next 开发服务。

### 3) 启动 Worker（可选）

```bash
bun run dev:worker
```

## 常用命令

```bash
bun run check         # lint + tests
bun test              # 全量测试
bun run build:web     # Next 构建
```

## 关键交互流程

1. 首页显示四个入口按钮：新的故事 / 旧的回忆 / 更新日志 / 版本信息。
2. 新的故事：命名成功后调用 `POST /api/session/start`，写入本地会话与门禁标记，进入 `/game`。
3. 旧的回忆：输入名字调用 `POST /api/session/recall`，匹配已存在名字并恢复活跃会话后进入 `/game`。
4. `/game` 路由受中间件保护；未完成开局/恢复会重定向回首页。
5. 游戏内所有会话接口继续通过 `x-session-token` 鉴权推进剧情。

接口实现统一位于 `apps/web/app/api` 目录。

## 页面路由（MVP）

- `/`：首页四入口主菜单
- `/new-story`：新的故事（命名开局）
- `/memories`：旧的回忆（名字匹配恢复）
- `/game`：正式游戏页（受门禁守卫）
- `/changelog`：项目更新日志
- `/version`：应用版本信息

## 音视频资源体系（MVP）

- 目录规范：`apps/web/public/assets/{storyline}/{chapter}/{audio|video|image|sprite}/...`
- 清单协议：`docs/chapters/{storyline}/{chapter}/resources/manifest.json` 使用 `version: "2"`（Manifest v2）
- 音频总线：`bgm | ambient | sfx | voice`
- 触发模型：
  - `scene_enter`：场景进入常驻轨（BGM/环境音）
  - `node_enter`：节点触发（voice/sfx）
  - `timeline_cue`：时间线关键帧触发（sfx/video）
- 兼容策略：旧路径 `/audio/*`、`/images/*`、`/sprites/*` 由 `AssetResolver` 自动映射到 `/assets/*`
- 资源模式：本地优先；生产可切 `r2`，不影响本地开发

## 注意事项

- 当前为 MVP，未接入登录注册。
- `/game` 路由需要门禁 cookie（`ody_entry_ready=1`），否则会被重定向回首页。
- `sessionToken` 丢失后需重新开局。
- 旧忆恢复仅支持“活跃会话”回档；不提供历史存档列表。
- 名字唯一性按“活跃会话”约束，过期会自动释放。
- 资源按章节懒加载：默认仅当前章节加载，跨章回溯时才切换加载目标章资源。
- 资源 URL 统一走 `AssetResolver`：兼容旧路径（`/audio/*`、`/images/*`、`/sprites/*`）并映射到 `/assets/*`。
- 世界观规则优先于 AI 支线生成；命中冲突时必须执行安全回退。
