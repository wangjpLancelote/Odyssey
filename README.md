# Odyssey MVP

一个以《龙族》风格为主线的对话式场景剧情游戏 MVP。  
玩家从首页进入后先取名（随机或自定义），随后进入章节驱动的剧情流程，通过选择推进故事、记录足迹并可从检查点恢复。

## 应用介绍

当前 MVP 聚焦以下核心能力：
- 匿名进入：无登录/注册，首页取名后开局。
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

## 目录结构

```txt
.
├─ apps/
│  └─ web/                      # Next.js 前端与 API Routes
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
├─ docs/
│  ├─ architecture.md           # 架构说明
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

1. 首页取名（随机/自定义）。
2. `POST /api/session/start` 创建匿名会话并返回 `sessionToken`。
3. 后续会话 API 通过 `x-session-token` 鉴权。
4. 对话推进、分支触发、足迹读取/恢复。
5. 过场由 DSL 编译结果驱动播放。

## 关键 API（MVP）

- `POST /api/session/start`
- `GET /api/player/name/suggest`
- `POST /api/dialogue/advance`
- `POST /api/choice/commit`
- `GET /api/footprints/map`
- `POST /api/footprints/restore`
- `POST /api/sidequest/trigger`
- `GET /api/daynight/current`
- `POST /api/cutscene/play`
- `GET /api/chapters/timeline`
- `POST /api/chapters/enter`

## 注意事项

- 当前为 MVP，未接入登录注册。
- `sessionToken` 丢失后需重新开局。
- 名字唯一性按“活跃会话”约束，过期会自动释放。
- 资源按章节懒加载：默认仅当前章节加载，跨章回溯时才切换加载目标章资源。
- 世界观规则优先于 AI 支线生成；命中冲突时必须执行安全回退。
