# AI 支线约束配置（MVP）

## 目标
为 AI 生成支线提供可执行约束，确保创作自由不突破世界规则。

## 规则 ID 规范
- 命名格式：`canon.<domain>.<rule>`
- 例：`canon.mainline.fixed_order`

## 规则清单

### 允许项（ALLOW）
1. `canon.sidequest.emotion_extension`
- 描述：允许补充情绪层、关系层、氛围层支线。
- 检测：不改主线必经节点。

2. `canon.sidequest.branch_locality`
- 描述：允许局部支线分叉并在章内收束。
- 检测：分支不会越权修改章节拓扑。

### 禁止项（DENY）与回退策略
1. `canon.mainline.fixed_order`
- 禁止：改写主线章节顺序或跳过必经节点。
- 回退：重定向到当前章节的安全推进节点。

2. `canon.knowledge.premature_reveal`
- 禁止：在未触发前置事件时揭示关键真相。
- 回退：替换为“模糊线索”版本并延后揭示。

3. `canon.power.tier_overflow`
- 禁止：无门槛释放超出等级/血统限制的言灵。
- 回退：降级能力表现或转为失败反馈节点。

4. `canon.character.role_collapse`
- 禁止：将核心角色改写为无动机或设定外行为体。
- 回退：恢复角色基线语气并缩减支线影响范围。

5. `canon.timeline.cross_chapter_rewrite`
- 禁止：通过支线直接修改下一章已锁定事实。
- 回退：将影响转化为“心理/关系痕迹”，不改事实。

## 输出契约（供后续代码化）
- 每条 AI 候选内容必须附带：
  - `riskFlags[]`
  - `appliedRules[]`
  - `fallbackNodeId`（命中 DENY 时）
