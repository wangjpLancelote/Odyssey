# 世界观基石文档（火之晨曦 MVP）

## 文档定位
本目录用于定义 Odyssey 的世界观基线，既是内容创作规范，也是系统规则的上游来源。
基于《龙族》原作设定，保留核心世界观、角色与能力体系，服务于游戏叙事与系统设计。

## 适用边界
- 适用故事线：`fire-dawn`（《火之晨曦》）
- 适用阶段：MVP（当前实现为 `ch01` 与 `ch02`）
- 剧透策略：完整剧情导向（用于团队内部创作与校验）

## 阅读顺序

### 世界观基础
1. [三支柱主题](./pillars.md)
2. [世界规则（硬规则/软规则）](./world-rules.md)
3. [龙种体系](./dragon-species.md)
4. [龙王与君主](./dragon-kings.md)

### 能力与系统
5. [等级系统](./systems-rank.md)
6. [血统系统](./systems-bloodline.md)
7. [言灵系统](./systems-word-spirit.md)

### 角色与势力
8. [组织与角色关系](./factions-and-roles.md)
9. [核心角色档案](./characters.md)

### 概念与剧情
10. [关键概念](./key-concepts.md)
11. [火之晨曦 MVP 时间线](./timeline-fire-dawn-mvp.md)

### 约束与参考
12. [AI 约束配置](./ai-constraint-profile.md)
13. [术语表](./glossary.md)
14. [变更记录](./change-log.md)

## 文档契约
1. `timeline-fire-dawn-mvp.md` 必须与 `docs/chapters/fire-dawn/timeline.json` 的章节顺序与命名一致。
2. `ai-constraint-profile.md` 中规则 ID 采用稳定命名，供后续 `canon-guard` 与生成器映射。
3. `glossary.md` 为术语主源，优先于散落在章节文本中的别名写法。
4. `characters.md` 中的角色属性（rank、言灵、血统特征）为游戏系统的参考基准。
5. `dragon-kings.md` 与 `dragon-species.md` 定义的龙族层级为世界观硬约束，AI 支线不得违背。

## 当前版本
- Version: `world-v2.0.0-mvp-fire-dawn`
- Updated: `2026-02-26`
