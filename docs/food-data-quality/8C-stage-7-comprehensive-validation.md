# 阶段 7：400 条 AFCD 公共食品综合质量验证报告

## 1. 阶段目标与数据范围
本阶段旨在对 400 条 AFCD 候选食品进行跨维度综合校验。通过结合身份信息、分类映射、中文翻译、营养数值约束、摄入类型以及 AUSNUT 固定份量数据，建立食品的发布准备状态（Release Readiness）。

**数据范围**：
- 400 条 AFCD 2023 候选食品。
- 100% 覆盖 Stage 3–6 的所有生成产物。

## 2. 验证数据源
- `afcd-initial-selection.json`: 候选筛选与基本分类。
- `food-name-translations.json`: 中文名称与翻译状态。
- `food-intake-types.json`: 摄入类型（碳水/蛋白/脂肪/纤维）。
- `food-public-aliases.json`: 公共别名。
- `food-portions.json`: AUSNUT 份量数据。
- `public-foods-afcd-initial.json`: 综合食品对象数据包。

## 3. 状态定义 (final_status)
- **release_ready**: 食品本体合格，且拥有至少一个可发布的 Ready portion。
- **release_ready_without_portion**: 食品本体合格，但无自然份量或 portion 均在暂缓中。支持按克记录。
- **needs_name_review**: 中文名称翻译状态为 `needs_review`，阻断发布。
- **needs_portion_review**: 发现份量数据存在严重异常（如克重极端或映射错误），可能影响食品本体的可信度。
- **needs_data_review**: 营养数值、分类或摄入类型存在逻辑错误。
- **exclude_candidate**: 确认重复或不适合首批发布的候选。

## 4. 最终统计结论

| 状态 | 数量 | 占比 | 说明 |
| :--- | :--- | :--- | :--- |
| **release_ready** | 217 | 54.25% | 食品本体合格，含至少一个最终可发布份量 |
| **release_ready_without_portion** | 179 | 44.75% | 食品本体合格，可按克记录 |
| **needs_name_review** | 3 | 0.75% | 中文名称仍需专业复核 |
| **needs_portion_review** | 0 | 0.00% | 无阻断性份量风险 |
| **needs_data_review** | 0 | 0.00% | 基础宏量营养逻辑通过 |
| **exclude_candidate** | 1 | 0.25% | 已标记排除项 |
| **合计** | **400** | **100%** | |

### 关键发现：
- **可进入阶段 8 的食品总数**：**396 条**（99.00%）。
- **Ready 名称状态**：397条`ready`名称中396条通过发布准备，F004256因定义不清排除。
- **Needs Review 名称状态**：3条涉及专业物种名称的食品继续被阻断。
- **Exclude Candidate 名称状态**：1条明确定义不清的食品被排除。
- **Portion 统计**：
  - 最终可发布 Portions：**501**
  - 包外 Held Portions：**43**
  - 179条`release_ready_without_portion`食品仍可直接按克记录。

## 5. 跨维度检查结论

### 5.1 身份与中文名称
- 397条Ready名称来自集中翻译规则或可审计显式override，并保留可确定的生熟、部位及加工状态；其中F004256因定义不清排除。
- 3条Needs Review食品保持物理阻断，防止未确认专业名称进入发布批次。

### 5.2 分类与营养数据
- 400 条食品的核心营养字段（热量、蛋白质、碳水、脂肪）均非负且无缺失。
- 能量估算（4-4-9-2 准则）大体一致，少数偏差已记录为 warning。
- 糖分约束（糖 <= 碳水）及脂肪分项约束全部通过。

### 5.3 摄入类型 (Intake Types)
- 摄入类型与营养数值高度匹配。
- 53 条空数组食品（如水、调味品、极低热量蔬菜）经核实符合预期。

### 5.4 份量 (Portions)
- 501条最终portion已进入正式包，其中321条原始Ready、180条经阶段7逐条规则批准。
- 3条exclude及40条defer共43条未进入正式包，不会随食品批准向用户泄露。

## 6. 14 类发布准备情况统计

| 分类 | Total | Release Ready | Without Portion | Needs Name Review |
| :--- | :--- | :--- | :--- | :--- |
| **主食与谷物** | 49 | 34 | 15 | 0 |
| **肉类与禽类** | 50 | 8 | 42 | 0 |
| **蛋类** | 8 | 6 | 2 | 0 |
| **食用油与脂肪** | 15 | 4 | 11 | 0 |
| **调味品与酱料** | 18 | 14 | 4 | 0 |
| **鱼类与海鲜** | 35 | 16 | 16 | 3 |
| **蔬菜** | 65 | 43 | 22 | 0 |
| **水果** | 50 | 32 | 17 | 0（另1条exclude） |
| **奶及奶制品** | 32 | 25 | 7 | 0 |
| **豆类与豆制品** | 25 | 9 | 16 | 0 |
| **薯类及淀粉类蔬菜** | 25 | 5 | 20 | 0 |
| **坚果与种子** | 20 | 16 | 4 | 0 |
| **无酒精饮品** | 8 | 5 | 3 | 0 |
| **简单混合食品** | 0 | 0 | 0 | 0 |
| **合计** | **400** | **217** | **179** | **3（另1条exclude）** |

## 7. 当前限制与风险
- **翻译阻断**：F001884、F001885、F008359三条专业名称仍需人工复核，不得发布。
- **份量暂缓**：43条exclude/defer portion不在正式包内；用户只能使用501条最终可发布份量或直接输入克数。
- **远程状态**：阶段8/8C-2最终为395 approved、3 pending、2 disabled；F004256新增停用，F001905保持disabled。

### 阶段8/8B远程发布验收

- 8批审核均为全量成功、0 skipped、0 failed，新增370条pending→approved审核事件。
- 匿名与普通用户仅能读取375条approved active食品；隐藏食品及其alias、portion和审核事件均不泄露。
- 远程501条最终Ready portion与正式包完全一致；43条Held portion仍未进入数据库。
- 重复foods/aliases/portions、孤立aliases/portions、非法营养和糖约束违规均为0；历史快照、legacy食品与个人食品保持不变。

### 阶段8/8C-2最终审核验收

- 20条人工确认名称的pending食品全部批准，0 skipped、0 failed；F004256单条停用成功。
- 新增21条审核事件，最终审核事件400；三条needs_name_review保持pending，两条disabled边界准确。
- 匿名与普通用户仅能读取395条approved active食品及其可见附属数据；管理员可见400条，service role不能冒充管理员审核。
- 正式包已按阶段8C-1结论重新生成并同步哈希门禁；501条Ready portion和43条包外Held边界未改变。

## 8. 安全与合规性声明
- 本报告及对应 JSON 文件中不包含任何密钥、JWT、密码或个人用户信息。
- 阶段8/8B与8/8C-2只通过管理员专用审核RPC修改明确食品的审核状态并写入对应审计；未修改食品内容、未恢复disabled食品、未批准needs_name_review食品。
- `docs/ROADMAP.md` 保持原有状态，未做任何修改。
