# 《火之晨曦》MVP 时间线（与运行时一致）

## 对齐来源
- 文件：`docs/chapters/fire-dawn/timeline.json`
- 约束：顺序、前后关系、启用状态必须一致。

## 当前章节序列
1. `ch01`（order=1）
- title: 第一幕 卡塞尔之门
- prevId: null
- nextId: ch02
- enabled: true
- 叙事功能：入局、价值冲突建立、首次关键选择。

2. `ch02`（order=2）
- title: 第二幕 黄金瞳
- prevId: ch01
- nextId: null
- enabled: true
- 叙事功能：承接后果、冲突升级、代价显性化。

## 推进规则
1. 会话默认从 `fire-dawn/ch01` 进入。
2. 只允许 `current.nextId` 方向进入下一章。
3. 回溯到跨章检查点时，先加载目标章节资源再恢复状态。

## 资源加载规则（MVP）
1. 常规流程：仅加载当前章节资源。
2. 跨章回溯：允许加载历史章节资源。
3. 非回溯场景：不预加载其他章节。
