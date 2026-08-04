# 当前项目进度

## 1. 审查信息

- 审查日期：2026-07-27
- 审查范围：本地仓库代码、迁移文件、函数配置、测试目录、Git提交记录、现有文档
- 审查方式：静态代码与文件证据审查（未执行业务功能开发、未改动数据库结构、未部署）
- 重要限制：无法直接访问线上Supabase与Vercel运行态，因此涉及线上行为的结论标记为“无法验证”或“需要线上环境验证”

## 2. 当前阶段和版本判断

## 当前版本判断

- 当前Phase：Phase 1（完整饮食管理 App）
- 当前正式版本：v0.1.3 — 基础记录闭环与稳定性收尾，已于 2026-07-28 15:55:36（Australia/Sydney）正式上线。
- 当前开发版本：v0.2.1 — 公共食品数据库。
- 个人食品体验：代码和 Migration 031/032 已完成；本轮将我的食品顶部筛选改为紧凑横向 chips，使用完整正式一级分类；个人食品分量支持数量、个/份/瓶/片/杯/勺/袋/盒/碗/条和对应克数，保存生成如 `1瓶`、`1份` 的 portion。新建默认一行，AddFoodSheet 个人食品优先；专项17项、全量277项和Build通过，等待用户最终页面验收。
- P0-1食品记录持久化：`首帧绘制修复完成，等待用户人工验收`。食品确认通过最小`flushSync`提交Store、汇总与Sheet关闭；浏览器获得一次animation frame绘制机会后才启动Supabase后台写入。AddFoodSheet不再以300ms关闭动画遮挡已经渲染的记录；失败记录保留为可重试状态。远程Feedback仍为pending，尚未push或部署。
- 多设备一致性：`代码完成、Migration 028待部署、等待双设备人工验收`。Store按用户订阅`timeline_items`/`food_entries` Realtime，并用BroadcastChannel同步同浏览器标签；远程重载会与本地pending/syncing/failed记录合并，避免自己的Realtime回声造成新增食品消失再出现。Supabase仍是最终事实来源；当前Production尚不具备Migration 028提供的DELETE完整载荷和固定三餐并发唯一约束。
- 当前状态：AFCD 400条客户端人工审核决定已正式实施；人工发布边界为publish 136、disable 264，5条客户端最终中文名已同步。
- 判断结论：正式数据库仍为402条foods；400条AFCD最终为approved 136、pending 0、disabled 264。匿名和普通用户仅可读取136条approved active食品，审核前端及本阶段代码尚未重新部署Production。

### 判断原因

1. 账号登录、会话恢复、登出清理、profiles读取、Supabase环境变量门禁与提示均有真实实现，但“线上可用性”与“跨账户隔离”仍需线上验证。
2. 食物库、历史归档、计划页面与管理公共食品功能存在实现，但不等于V0.1已完整验收。
3. 当前已有历史删除、日期状态、底部导航、设置入口、账户、个人信息、摄入计划、版本反馈和记录设置等自动化测试；真实登录态、生产 RLS 和移动端真机仍缺少自动化或实机证据。
4. Roadmap 中模板、周计划、自动生成、减脂模式、离线和 AI 能力继续归入后续版本，不纳入 v0.1.3。

### v0.2.1 食品数据库基础进度

- `已完成（客户端人工发布决定）` 以人工审核CSV/actions为唯一业务依据实施260条approved→disabled、3条pending→disabled和F001905 disabled→approved；最终AFCD为136/0/264，审核事件664。
- `已完成（客户端名称）` 5条最终显示名称已写入远程和确定性正式数据源；其余395条名称、分类、营养、摄入类型、aliases和portions未改变。
- `已验证（最终权限与完整性）` 匿名/普通用户可见136 foods、28 aliases、203 portions；管理员可见400 foods与664审核事件；总量保持100 aliases、501 portions、402 foods，历史快照不变。

- `已完成（本地动态验证）` 基于既有 `foods` 增量建立公共/个人食品身份、来源公共食品、审核状态、分类、摄入类型和扩展营养字段。
- `已完成（本地动态验证）` 建立固定份量、公共别名和个人别名表及其唯一性约束。
- `已完成（本地动态验证）` 建立 approved 公共读取、个人数据双向隔离、管理员公共管理、份量跟随食品及别名隔离 RLS。
- `已完成（本地动态验证）` 食品引用硬删除保护、`food_entries` 历史快照保持和公共食品个人副本隔离。
- Migration：`022_food_database_foundation.sql` 至 `026_preserve_food_nutrient_precision.sql`；本地和正式远程项目均已应用。
- 验证：部署前逻辑备份恢复通过，Production备份副本Migration预演022–026成功且兼容性审计12/12；部署后Local/Remote Migration 001、003–026一致。
- 兼容策略：旧四项营养安全回填；无法推断的纤维和扩展营养保持 `NULL`；五项核心营养完整性待现有编辑器和存量数据补齐后通过后续 migration 收紧。
- `已完成（本地动态验证）` 公共食品导入标准模型、AFCD/USDA JSON 适配器、校验、来源 ID 去重、失败隔离、dry-run 与 service-role CLI。
- `已完成（本地动态验证）` migration 023 导入运行/错误审计及单食品、份量、公共别名原子写入 RPC；正常写入、三类失败回滚、幂等 skip、批次失败隔离与计数闭合均通过。
- 导入命令：
  - dry-run：`cd frontend && npm run import:foods -- --source AFCD --input <file.json> --dry-run --batch-size 50`
  - 正式运行：由受控服务端环境提供 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY` 后移除 `--dry-run`；不得在前端或命令记录中写入密钥。
- 验证：导入与 023 专项 29/29、全部 migration/归档/导入 Node 契约 60/60、前端 31 套件 210 测试、Production build 通过。
- `已完成（本地数据准备）` AFCD 14 类 Classification 映射与 400 条确定性候选筛选；分类数量为 49/25/50/35/8/32/25/65/50/20/15/18/8/0，raw/cooked/unspecified 为 213/77/110。
- `已完成（本地数据准备）` 400/400 中文名称（376 ready、24 needs_review）及公共别名（73 个食品、100 条 alias），无中文重名或 alias 语义冲突。
- `已完成（本地数据准备）` 400 条 `intake_types`：carbohydrate 154、protein 173、fat 98、fiber 167；53 条空数组均有明确审计分类，suspicious_empty 为 0；规则无需 override。
- 阶段 2–4 Commit：`a365b3804bec34bfb10d8cdbbcfc94866a9b2d3e`；阶段 5 Commit：`9cbe947cc328fc307a0a4f12a03b02563aea7304`。
- 验证：阶段 2–5 专项全部通过，import-foods 23/23，前端 31 套件 210 测试，Production build 通过。
- `已完成（本地数据准备，待人工复核）` AUSNUT 固定份量 exact-key 审计：332 个候选匹配、222 个食品保留 544 条份量，其中 ready 321、needs_review 223；110 个匹配后无份量食品均只有官方 density 换算记录。
- 阶段 6 不使用名称模糊关联、Volume 推算或 1mL=1g 假设；所有 grams 与 AUSNUT `Gram amount` 逐条一致。功能纠正 Commit：`19f658518e8e11cf0ecc3fa0b7497b1fff038b69`。
- `已完成（离线数据包）` 223 条 portion needs_review 已逐条决策：approve 180、exclude 3、defer 40；最终整合 501 条 ready portion，219 个食品有份量。
- `已完成（离线契约）` 400 条 AFCD 首批公共食品导入 JSON，包含 100 条 aliases、阶段 5 intake_types 和原始 AFCD 营养；24 条中文名称 needs_review 保留，全部食品状态为 pending。
- `已完成（离线 dry-run）` 400/400 解析和统一模型校验成功，0 failed；没有连接数据库、创建 import run 或调用 RPC。阶段 7 Commit：`93f0af1e66ba59af492e2c3c4a40876d87f671ad`。
- `已完成（仅本地）` 阶段 8A Migration 022–024 应用与动态 RLS/RPC 验证；功能 Commit：`0393e60311809e3603493cfeecd8798a76b1f1f5`。
- `已完成（仅本地）` 阶段 8B：Migration 025 阻止停用食品建立新记录引用；Migration 026 保留最终包四位营养精度；20 条代表食品试导入、审核可见性、幂等重跑、失败隔离和审计清理均通过。
- 阶段 8B Commit：停用食品约束 `ea2d18a570bb27ce36b603538b5af751bf3d3027`；营养精度 `8f4d6a0f92cf5db299950b37d17d9f93ec5c5bef`；本地试导入 `47709a26a28060699945d2bb75d8317d11531bb8`。
- `已完成（正式远程数据库）` 阶段8C-2：仓库外逻辑备份及隔离恢复验证完成，Migration 022–026正式部署；5张食品扩展表、导入RPC、4个关键触发器和14个四位小数规范营养字段验证通过。
- `已确认（部署后）` 原有public业务表行数不变，foods仍为2条，新食品、aliases、portions和import审计均为0；旧foods除`updated_at`回填外原字段未改变。
- `已完成（正式远程数据）` 阶段8C-3B1单次trial：20/20 AFCD食品导入成功，新增7条公共aliases和45条portions；全部保持pending，approved为0，重复及孤立记录均为0。
- `已确认（正式权限）` 匿名用户读取本批pending食品、aliases和portions均为0，import audit读取被拒绝；服务端读取本次completed run及20/20/0/0统计成功。
- `已完成（正式远程数据）` 阶段8C-3B2首次整包运行：400 total、380 success、20 skipped、0 failed；trial 20条保留，新增其余380条。
- `已完成（正式幂等验证）` 同包第二次运行：400 total、0 success、400 skipped、0 failed；未新增重复foods、aliases或portions。
- `已确认（正式数据）` 400条AFCD食品、100条公共aliases、501条portions全部存在；pending/approved/disabled为400/0/0，重复及孤立记录、营养约束违规均为0。
- `已确认（正式兼容）` foods总数为402，原有2条legacy和1条private食品基线保持；最终数据包SHA-256保持`4b9b3f342727ff39aafa1fb189496f13a76c3e11d5c125c55b858076c5d4696b`。
- `已确认（正式权限）` 普通测试用户通过现有username-login取得session且非管理员；匿名和普通用户均无法读取pending AFCD foods、aliases、portions及import audit，服务端审计可读。
- `未执行` 剩余394条人工审核、审核前端Production部署或cleanup。
- `已完成（审核机制）` Migration 027新增审核归属、审核时间、备注、状态转换审计和管理员专用`review_public_foods` RPC；显式批次上限50。
- `已完成（管理员页面）` `/library/review`支持pending默认视图、状态/分类/关键词筛选、20条分页、详情、单条/小批量批准或停用、确认和防重复。
- `已完成（正式验证）` 跨谷物、肉类、水产、奶制品、蔬菜、水果批准6条后停用西兰花；最终pending/approved/disabled为394/5/1，审核事件9条。
- `已确认（发布权限）` 普通用户批准前不可见、批准后可见、停用后不可见；aliases和portions跟随本体，历史快照未改变。
- `已完成（发布源一致性）` 阶段8/8A-1恢复确定性翻译生成器并复用集中规则与显式override；400条翻译为376 Ready、24 needs_review，正式包仍保持原SHA-256，和远程400条数据逐字段一致。
- `已完成（发布准备重算）` release_ready 213、release_ready_without_portion 163、needs_name_review 24，其余状态均为0；阶段7最终包包含501条可发布portion，43条exclude/defer份量保持包外。
- `已确认（远程只读对账）` 376条候选分为370 pending、5 approved、1 disabled；24条needs_name_review全部为remote pending，不再存在未解释的remote approved或disabled。本阶段远程写入为0。
- `已完成（正式受控发布）` 阶段8/8B通过真实管理员session将370条pending候选按external_id升序拆为8批（50×7+20）批准；每批均0 skipped、0 failed，新增370条审核事件。
- `已确认（正式状态）` 400条AFCD最终为pending 24、approved 375、disabled 1；24条needs_name_review未误批准，F001905未恢复。
- `已确认（正式可见性）` 匿名及普通用户仅能读取375条approved active食品及其99条aliases、483条portions；隐藏食品附属数据和审核事件不泄露。管理员可读取全部400条及379条审核事件，service role不能调用审核RPC冒充管理员。
- `已确认（正式完整性）` 100条aliases、501条portions、总foods 402保持；重复、孤立、营养及糖约束违规均为0，2条legacy、1条个人食品与历史快照未改变，43条Held portion保持包外。
- `已完成（最终名称复核）` 阶段8C-1将20条显式复核为Ready，3条保持needs_name_review，F004256标记exclude_candidate；发布准备为217/179/3/0/0/1，可发布候选396。
- `已完成（最终状态发布）` 阶段8/8C-2批准20条并停用F004256，均0 skipped、0 failed；新增21条审核事件，最终审核事件400。
- `已确认（最终远程状态）` AFCD为approved 395、pending 3、disabled 2；pending仅F001884、F001885、F008359，disabled仅F001905、F004256。
- `已确认（最终权限与完整性）` 匿名及普通用户仅可见395条approved active食品、99条aliases和494条portions；管理员可见400条AFCD和400条审核事件，service role不能冒充管理员审核。总foods 402、100 aliases、501 portions、历史快照、legacy与个人食品均保持。
- `已完成（正式包门禁修正）` 正式包已按阶段8C-1源重新生成，SHA-256为`21f03786d34b0525f3cf57234f79b60a1d9bbdc3fc96cd48642e1124b8bd15d6`；最终包、trial及batch安全门禁已同步。
- `未完成` 3条专业名称人工审核和审核前端Production部署。
- `待处理（安全）` 旧Legacy API Keys尚未停用，必须先完成后台依赖检查；当前服务端与前端已切换至新凭据，正式核心页面验证正常。
- `未开始` 食品搜索页面与完整 v0.2.1 UI。
- `已部署` 正式远程Migration 022–027及400条AFCD首批食品；`未部署` v0.2.1审核前端。

## 3. 已完成

以下条目满足“仓库内可确认已实现”：

- `已完成` Supabase客户端环境门禁与错误提示
  - 证据：frontend/src/lib/supabaseClient.js
  - 证据：frontend/src/App.js
- `已完成` 用户名+密码登录链路（前端调用Edge Function）
  - 证据：frontend/src/services/authService.js
  - 证据：supabase/functions/username-login/index.ts
  - 证据：supabase/config.toml
- `已完成` 登录后会话恢复与auth listener
  - 证据：frontend/src/App.js
- `已完成` 退出账号及重新登录前清理本地用户态
  - 证据：frontend/src/store.jsx
  - 证据：frontend/src/components/BottomNav.jsx
- `已完成` 食物库私有食品CRUD（前端链路）
  - 证据：frontend/src/pages/FoodLibraryPage.jsx
  - 证据：frontend/src/services/foodService.js
- `已完成` 管理员公共食品管理（新增/编辑/启停）
  - 证据：frontend/src/pages/FoodLibraryPage.jsx
  - 证据：frontend/src/store.jsx
  - 证据：supabase/migrations/007_admin_public_foods.sql
  - 证据：supabase/migrations/010_restrict_admin_foods_select.sql
- `已完成` 日归档与历史详情编辑/删除
  - 证据：frontend/src/services/historyService.js
  - 证据：frontend/src/pages/HistoryPage.jsx
  - 证据：frontend/src/pages/HistoryDetailPage.jsx
  - 证据：supabase/migrations/005_daily_archives.sql
  - 证据：supabase/migrations/006_daily_archives_completion.sql
- `已完成` 摄入计划保存/历史/删除
  - 证据：frontend/src/pages/PlanPage.jsx
  - 证据：frontend/src/services/targetService.js
  - 证据：supabase/migrations/001_initial_schema.sql
- `已完成` 设置摄入计划模块重构（当前计划 + 历史快照）
  - 证据：frontend/src/pages/SettingsIntakePlanPage.jsx
  - 证据：frontend/src/pages/PlanPage.jsx
  - 证据：frontend/src/lib/intakePlanCalculations.js
  - 证据：frontend/src/lib/intakePlanValidation.js
  - 证据：frontend/src/services/intakePlanService.js
  - 证据：frontend/src/services/targetService.js
  - 证据：frontend/src/store.jsx
  - 证据：supabase/migrations/017_intake_plan_history.sql
  - 说明：当前计划支持三填一算自动计算；保存时通过 RPC 原子更新 `daily_targets` 并写入 `intake_plan_history`；历史记录按只读快照分页展示（默认5条，“查看更多”继续加载）。
  - 相关 Commit：3232bca31de062f51124a1f33d78fdeece47971f
- `已完成` 数据库迁移体系与RLS基础
  - 证据：supabase/migrations/001_initial_schema.sql
  - 证据：supabase/migrations/003_food_library_visibility.sql
  - 证据：supabase/migrations/004_username_login.sql
  - 证据：supabase/migrations/007_admin_public_foods.sql
  - 证据：supabase/migrations/008_fix_foods_admin_rls_compat.sql
  - 证据：supabase/migrations/009_fix_is_app_admin_missing_columns.sql
  - 证据：supabase/migrations/010_restrict_admin_foods_select.sql
- `已完成` 登录页面非必要提示精简
  - 证据：frontend/src/pages/LoginPage.jsx
  - 说明：保留真实错误反馈与加载态，移除页面中面向用户展示的说明性提示文案。
  - 相关 Commit：260e134
- `已完成` 面向用户品牌名称统一为“生活”
  - 证据：frontend/src/pages/LoginPage.jsx
  - 证据：frontend/public/index.html
  - 说明：仅更新用户可见的品牌展示位，功能语境中的“饮食记录”未改动。
  - 相关 Commit：cfbe92167a145b800ccbc67f2efc3f17e461c534
- `已完成` 登录页显示统一版本号
  - 证据：frontend/src/config/appVersion.js
  - 证据：frontend/src/pages/LoginPage.jsx
  - 证据：frontend/package.json
  - 说明：登录页底部从统一配置读取当前版本；v0.1.2 上架前准备后显示 `当前版本：v0.1.2`，版本来源为 `frontend/package.json`。
  - 相关 Commit：737188e4b8619edd172bedce8ff518d1519b3b5c
- `已完成` 移动端登录输入框自动缩放修复
  - 证据：frontend/src/pages/LoginPage.jsx
  - 说明：将登录页账号与密码输入框在移动端字体提升到 16px，避免焦点触发页面自动放大。
  - 相关 Commit：ed54314cfcf407addf000c101cdc28155c6b9cbd
- `已完成` 登录性能诊断与定向优化
  - 证据：frontend/src/lib/loginPerf.js
  - 证据：frontend/src/services/authService.js
  - 证据：frontend/src/App.js
  - 说明：登录性能已完成诊断和优化，具体结果见 DEVELOPMENT_LOG。
  - 相关 Commit：ef9df7c9c77e0cb4c587faf699fec8fa0dd01533
- `已完成` 登录后底部导航与设置页框架重构
  - 证据：frontend/src/components/BottomNav.jsx
  - 证据：frontend/src/pages/SettingsPage.jsx
  - 证据：frontend/src/pages/AccountInfoPage.jsx
  - 证据：frontend/src/pages/ProfileInfoPage.jsx
  - 证据：frontend/src/App.js
  - 说明：底部导航最终调整为“首页｜食物库｜设置”；历史列表和详情路由完整保留，并由“设置 → 记录 → 记录历史记录”直接进入；`/plan` 路由保留但不再作为底部一级入口。
  - 相关 Commit：58237724a596fe08aa5a03b8b050aee903c190f5
  - 后续调整 Commit：036f4c0d279e5268a4c1c5bb61716daae1eef47d、1395a154b6042142d59a1b1be4e3c863a938040e、0d4e1274decf8204df96a724d389f9656ac9710d
- `已完成` 首页右上角加号入口移除
  - 证据：frontend/src/pages/TodayPage.jsx
  - 说明：首页顶部右上角不再显示加号按钮；新增业务能力仍通过页面内其他入口保留。
  - 相关 Commit：e8810246d53e4039526c3184e0f5770750dece5c
- `已完成` 首页“今日摄入”模块两行布局展示
  - 证据：frontend/src/components/NutritionSummary.jsx
  - 证据：frontend/src/pages/TodayPage.jsx
  - 说明：首页“今日摄入”模块已调整为当前摄入和目标摄入两行展示，并保持字段顺序一致。
  - 相关 Commit：5e695da769e309a46cf9838e9aadf906b0a11040
- `已完成` 首页“今日摄入”模块顶部信息精简
  - 证据：frontend/src/components/NutritionSummary.jsx
  - 说明：首页两行营养信息保留，移除上方标题、目标提示与火焰图标区域，第一行标签更新为“今日摄入”。
  - 相关 Commit：514d9d5d2a6fc7b16ee462a83368190e28024ac2
- `已完成` 首页“今日摄入”目标行改为单行文字
  - 证据：frontend/src/components/NutritionSummary.jsx
  - 说明：保留“今日摄入”行四个独立小卡片，目标行改为单行普通文字，不再使用独立目标卡片。
  - 相关 Commit：0b92e3c4f63f0ac7740fd4be78cb063568e7dabb
- `已完成` 首页“今日摄入”目标行标签简化
  - 证据：frontend/src/components/NutritionSummary.jsx
  - 说明：目标行文案更新为“-- kcal、P -- g、F -- g、C -- g”格式，当前摄入行样式保持不变。
  - 相关 Commit：262c00329b1fb95f1cf24b6caa338e3dd74c73fa
- `已完成` 首页“今日摄入”目标行列对齐修正
  - 证据：frontend/src/components/NutritionSummary.jsx
  - 说明：目标行与今日摄入行共用相同五列网格参数，四个目标字段与对应营养卡片列严格对齐。
  - 相关 Commit：6fc0bf145278f6a45329e801588c28f912aa3fa4
- `已完成` 首页周日历导航接入
  - 证据：frontend/src/pages/TodayPage.jsx
  - 证据：frontend/src/store.jsx
  - 说明：首页新增周一到周日周视图，支持上一周/下一周、日期点击切换和回到今天，且与 `currentDate` 单一日期状态联动。
  - 相关 Commit：74efe2ed1cdcaae623bfdda8fe8db0c0e7ba88d0
- `已完成` 周日历日期切换改为纯浏览行为
  - 证据：frontend/src/pages/TodayPage.jsx
  - 证据：frontend/src/store.jsx
  - 说明：查看其他日期时不再触发 NEXT DAY 流程；日期区域标题按所选日期在 TODAY 与“历史记录”之间动态切换。
  - 相关 Commit：20b0e56dee272958b1c247b6cd716245fa2c5005
- `已完成` 首页时间轴左右两列布局
  - 证据：frontend/src/components/TimelineItem.jsx
  - 证据：frontend/src/pages/TodayPage.jsx
  - 说明：首页时间轴已调整为左侧时间、右侧事件内容的两列结构；事件信息与操作入口保持不变。
  - 相关 Commit：e0b37db11251ac659ccbf927e62d47d8dde9d5d4
- `已完成` 结束本日支持空白日期并保留历史
  - 证据：frontend/src/store.jsx
  - 证据：frontend/src/services/historyService.js
  - 证据：frontend/src/pages/HistoryPage.jsx
  - 证据：frontend/src/pages/HistoryDetailPage.jsx
  - 说明：结束本日已支持空白日期；已结束但无记录的日期会在历史中显示“本日无记录”。
  - 相关 Commit：dc320ed1c51ac09144b667bf4553c3f51b0dd382
- `已完成` 新增加餐支持时间与类型必填
  - 证据：frontend/src/modals/AddSnackSheet.jsx
  - 证据：frontend/src/pages/TodayPage.jsx
  - 证据：frontend/src/constants/snackTypes.js
  - 证据：frontend/src/services/historyService.js
  - 说明：新增加餐先填写时间与类型（普通/练前/练后）后再创建记录；旧加餐类型默认按普通处理。
  - 相关 Commit：5f229f865016715b7dbfcf1fb746e7a35df9e7c7
- `已完成` 训练入口与训练弹窗统一
  - 证据：frontend/src/pages/TodayPage.jsx
  - 证据：frontend/src/modals/AddTrainingSheet.jsx
  - 说明：加号菜单中的“无氧训练/有氧训练”已合并为单一“训练”入口；点击后进入同一个训练弹窗，在弹窗内选择无氧或有氧。
  - 相关 Commit：80db763d18d2884d15be505029c3ca1d97b6a923
- `已完成` 加号菜单支持点击外部关闭
  - 证据：frontend/src/pages/TodayPage.jsx
  - 说明：菜单打开后点击菜单外区域可关闭；点击菜单内部不会误关闭；菜单项点击后按原流程关闭并打开对应弹窗。
  - 相关 Commit：5557c8a584ff9ea36bf826046546b40256b5a40d
- `已完成` 训练时长输入前导零与回填问题修复
  - 证据：frontend/src/modals/AddTrainingSheet.jsx
  - 说明：训练时长输入已改为字符串态，支持清空后重新输入，不再出现删除后自动补 0 或 05/030 等前导零问题。
  - 相关 Commit：afd6b50ab2e8d93a9b3486525736e01c026a598a
- `已完成` 训练弹窗移除预估消耗字段
  - 证据：frontend/src/modals/AddTrainingSheet.jsx
  - 说明：统一训练弹窗已移除“预估消耗”展示和对应提交参数，训练记录不再要求填写预估消耗。
  - 相关 Commit：1330c03b53a17bf6d040e4de8cc0259da915f852
- `已完成` 无氧训练支持训练部位多选
  - 证据：frontend/src/modals/AddTrainingSheet.jsx
  - 证据：frontend/src/constants/trainingBodyParts.js
  - 证据：frontend/src/components/TimelineItem.jsx
  - 说明：无氧训练可选择胸、背、腿、肩、二头、三头、核心并支持多选；有氧不显示该字段；保存后可在时间轴/历史查看部位列表。
  - 相关 Commit：abef063f250053bec4238b1c24ac3b73684fb246
- `已完成` 统一训练弹窗移动端缩小问题修复
  - 证据：frontend/src/modals/AddTrainingSheet.jsx
  - 说明：为训练弹窗增加移动端宽高边界与内部滚动容器，覆盖无氧/有氧切换、输入聚焦与软键盘场景，避免弹窗外层异常缩小。
  - 相关 Commit：1b22f1b5656e2111d57b269f232be1626f3a8c3f
- `已完成` 首页本地实时时钟与新增弹窗时间快照默认值
  - 证据：frontend/src/components/LiveClock.jsx
  - 证据：frontend/src/hooks/useCurrentTime.js
  - 证据：frontend/src/lib/localDateTime.js
  - 证据：frontend/src/pages/TodayPage.jsx
  - 证据：frontend/src/modals/AddSnackSheet.jsx
  - 证据：frontend/src/modals/AddTrainingSheet.jsx
  - 证据：frontend/src/modals/AddEventSheet.jsx
  - 说明：首页日期区域新增本地实时时钟（`HH:mm:ss`）并在后台返回时立即校准；新增加餐/训练/其他事件弹窗默认时间改为打开瞬间本地时间快照（`HH:mm`），不会在填写过程中自动跳变，编辑时间回显逻辑保持不变。
  - 相关 Commit：0d56866400f7e9f365b8674b14cc4984545c4fce
- `已完成` 事件和训练实时开始与结束
  - 证据：frontend/src/modals/AddEventSheet.jsx
  - 证据：frontend/src/modals/AddTrainingSheet.jsx
  - 证据：frontend/src/components/TimelineItem.jsx
  - 证据：frontend/src/pages/TodayPage.jsx
  - 证据：frontend/src/pages/HistoryDetailPage.jsx
  - 证据：frontend/src/services/timelineService.js
  - 证据：frontend/src/services/historyService.js
  - 证据：frontend/src/store.jsx
  - 说明：事件和训练都支持“手动记录 / 现在开始”；实时记录会以本地时间创建 running 记录，返回首页后可继续显示并点击结束，结束后自动保存结束时间与实际时长；历史日期仅保留手动记录入口。
  - 相关 Commit：821caf71e26214a3379713dfb2be3027771dc823
- `已完成` 训练编辑字段映射与类型切换修复
  - 证据：frontend/src/modals/EditActivitySheet.jsx
  - 证据：frontend/src/pages/TodayPage.jsx
  - 证据：frontend/src/pages/HistoryDetailPage.jsx
  - 证据：frontend/src/components/TimelineItem.jsx
  - 证据：frontend/src/services/timelineService.js
  - 证据：frontend/src/services/historyService.js
  - 说明：训练编辑已按字段职责分离 `title / details.name / notes / bodyParts`；running 训练支持无氧与有氧双向切换，切换时备注保持不变，且不重置 `started_at` 与计时状态。
  - 相关 Commit：934c542d5946ab93ce1bb722a3f2ac4c63603522
- `已完成` 事件编辑保存性能优化
  - 证据：frontend/src/pages/TodayPage.jsx
  - 说明：事件编辑保存不再等待全量历史刷新；数据库更新成功后立即替换本地时间轴记录并返回，弹窗可更快关闭且减少重复提交风险。
  - 相关 Commit：8ac5e18ea58f0ea5b3125f617e8d630fd6ecfe8e
- `已完成` 首页时间轴“现在”位置标记
  - 证据：frontend/src/pages/TodayPage.jsx
  - 说明：首页时间轴在查看今天时新增随本地实时时间移动的“现在”标记；查看历史或未来日期时不显示，且不触发数据库请求。
  - 相关 Commit：ee3341fab9cb29d0f10ca5dd96a7f53f18be4450
- `已完成` 事件与训练创建响应速度优化
  - 证据：frontend/src/pages/TodayPage.jsx
  - 证据：frontend/src/modals/AddEventSheet.jsx
  - 证据：frontend/src/modals/AddTrainingSheet.jsx
  - 证据：frontend/src/lib/timelineCreatePerf.js
  - 说明：创建成功后直接更新本地时间轴并关闭弹窗，不再同步等待全量历史刷新；创建失败时保持弹窗与输入；创建流程增加即时提交态反馈与同 ID 去重追加。
  - 相关 Commit：5912b0e1a0afb29ceb4bb0a6787cb4ad41b0f930
- `已完成` 历史删除后保持当前日期
  - 证据：frontend/src/pages/HistoryDetailPage.jsx
  - 说明：历史详情删除不再触发回到今天的初始化链路；删除后保持在当前历史日期与历史模块内，避免强制跳转首页。
  - 相关 Commit：063ec9c1ba97f6c97bba2cb0aa11104ac8a0940b
- `已完成` 历史记录稳定删除与整日删除
  - 证据：frontend/src/pages/HistoryDetailPage.jsx
  - 证据：frontend/src/pages/HistoryPage.jsx
  - 证据：frontend/src/services/historyService.js
  - 证据：supabase/migrations/012_delete_day_records_rpc.sql
  - 说明：历史详情单条删除后保持当前历史日期；历史事件支持删除与开始/结束时间编辑；历史列表卡片右上角可直接执行整日删除并移除该日期。
  - 相关 Commit：8026e90619b26a005530f4508439b1f77602f45d
- `已完成` 历史餐次单个食物删除与整日删除入口位置调整
  - 证据：frontend/src/components/TimelineItem.jsx
  - 证据：frontend/src/pages/HistoryDetailPage.jsx
  - 证据：frontend/src/pages/HistoryPage.jsx
  - 证据：frontend/src/modals/AddFoodSheet.jsx
  - 证据：frontend/src/services/historyService.js
  - 说明：历史餐次食物条目支持按 entryId 删除；整日删除入口从历史列表卡片移除并固定到历史详情页顶部右上角，避免遮挡单条记录信息。
  - 相关 Commit：959d81eaba77fb8d784eb24bc75afbd4e1a8a345
- `已完成` 历史批量删除、空餐次清理与时间轴展示统一
  - 证据：frontend/src/pages/HistoryPage.jsx
  - 证据：frontend/src/pages/HistoryDetailPage.jsx
  - 证据：frontend/src/components/TimelineItem.jsx
  - 证据：frontend/src/services/historyService.js
  - 证据：supabase/migrations/013_delete_history_days_rpc.sql
  - 说明：历史主页顶部新增批量删除入口并支持多日期选择/全选/确认删除；历史详情删除最后一个食物会自动删除整餐并过滤旧空餐次；历史详情时间轴改为与首页一致的左侧时间布局，并在记录右上角统一编辑/删除操作区。
  - 相关 Commit：51fe1233ac68817c97b8d28f12eeb67c2a4e1398
- `已完成` 具体历史日期详情查看/编辑模式
  - 证据：frontend/src/pages/HistoryDetailPage.jsx
  - 证据：frontend/src/components/TimelineItem.jsx
  - 说明：历史详情默认进入查看模式，页面右上角点击“编辑”后进入统一编辑模式并显示记录级操作；点击“完成”恢复查看模式；切换到其他历史日期或刷新页面后默认回到查看模式。
  - 相关 Commit：0c6aae0d432eecde1af06d4e6972a808dac77886
- `已完成` 设置模块导航框架重构与子页面壳层补齐
  - 证据：frontend/src/pages/SettingsPage.jsx
  - 证据：frontend/src/components/settings/SettingsSubpageHeader.jsx
  - 证据：frontend/src/components/settings/SettingsNavigationItem.jsx
  - 证据：frontend/src/pages/SettingsVersionPage.jsx
  - 证据：frontend/src/pages/SettingsIntakePlanPage.jsx
  - 证据：frontend/src/pages/SettingsRecordHistoryPage.jsx
  - 证据：frontend/src/pages/SettingsRecordSettingsPage.jsx
  - 证据：frontend/src/pages/AccountInfoPage.jsx
  - 证据：frontend/src/pages/ProfileInfoPage.jsx
  - 证据：frontend/src/App.js
  - 说明：设置首页按账号与记录分组展示入口，退出账号位于账号区域；旧 `/settings/account-actions` 兼容重定向到设置首页，旧 `/settings/profile` 路由兼容跳转到 `/settings/personal-info`。
  - 相关 Commit：34ddd64aeaa51c9e0d88fe8123e1ef0c522fca5e

## 4. 部分完成

- `部分完成` V0.1 账号与权限验收
  - 原因：代码链路完整度较高，但线上可用性、RLS隔离和多账户回归缺少仓库内自动化验证证据。
  - 证据：frontend/src/App.js, frontend/src/store.jsx, supabase/migrations/*.sql
- `部分完成` V0.2 食物数据库
  - 原因：私有/公共食品与管理员功能已实现，但“常用食品、最近使用、重复提醒完善度”未形成完整闭环验收证据。
  - 证据：frontend/src/pages/FoodLibraryPage.jsx, frontend/src/services/foodService.js
- `部分完成` V0.3 饮食记录
  - 原因：Today页面交互完整、历史归档可用，但`timeline_items`增改查服务未见页面侧完整接入，当前更偏“归档驱动”而非全程实时DB CRUD。
  - 证据：frontend/src/pages/TodayPage.jsx
  - 证据：frontend/src/services/timelineService.js
  - 证据：frontend/src/services/historyService.js
- `部分完成` V0.4 历史记录与基础统计
  - 原因：历史列表与详情已实现，统计仍以基础汇总为主，周/月趋势图等未见实现证据。
  - 证据：frontend/src/pages/HistoryPage.jsx, frontend/src/pages/HistoryDetailPage.jsx
- `部分完成` V0.6 饮食计划
  - 原因：计划CRUD与历史存在，但“四项填三算一、训练日/休息日计划、每餐目标分配”未见完整实现。
  - 证据：frontend/src/pages/PlanPage.jsx, frontend/src/services/targetService.js
- `部分完成` V0.5 身体记录（个人信息基础层）
  - 原因：已支持性别、生日、身高、体重的查看与编辑保存，但体重趋势、围度记录、阶段性对比与统计仍未实现。
  - 证据：frontend/src/pages/ProfileInfoPage.jsx, frontend/src/lib/personalInfoUtils.js, frontend/src/store.jsx
  - 证据：supabase/migrations/014_personal_info_profile_fields.sql

## 5. 尚未开始

以下在仓库中未找到可确认实现（非仅文件名判断）：

- `尚未开始` V0.7 模板与快速复用
- `尚未开始` V0.8 周饮食计划
- `尚未开始` V0.9 规则驱动自动生成
- `尚未开始` V0.10 独立减脂模式
- `尚未开始` V0.11 稳定化（导出/备份/回归矩阵）

## 6. 当前阻塞问题

- `被阻塞` 线上行为闭环验证
  - 说明：无法仅通过本地仓库确认，需要线上环境验证。
  - 涉及：用户名登录在线可用、RLS隔离、管理员权限真实生效、跨账户数据隔离。
- `被阻塞` 稳定性与回归测试证据不足
  - 说明：`tests/` 目录仅存在初始化文件，缺少可执行自动化测试集。
  - 证据：tests/__init__.py
- `被阻塞` 当前日记录实时持久化链路不清晰
  - 说明：页面端未见 `createTimelineItem` / `updateTimelineItem` / `getTimelineByDate` 的使用闭环。
  - 证据：frontend/src/services/timelineService.js（有服务）
  - 证据：页面调用检索结果（未检出调用）

## 7. 当前版本完成度

### 计算方式

- V0.1验收项总数：8项（按Roadmap定义）
- 已完成项计分：1.0
- 部分完成项计分：0.5
- 无法验证项计分：0.25（有代码但缺线上证据）
- 公式：完成度 = 累计得分 ÷ 8

V0.1当前计分（本次审查）：

1. 用户名登录线上正常工作：无法验证（0.25）
2. 刷新后保持登录：部分完成（0.5）
3. 退出后清除上一个用户数据：已完成（1.0）
4. 私人数据隔离正确：部分完成（0.5）
5. 管理员权限正确：部分完成（0.5）
6. 新用户无演示数据：已完成（1.0）
7. Supabase真实数据链路稳定：部分完成（0.5）
8. 本地和线上构建通过：部分完成（0.5）

累计：4.75 / 8 = 59.4%

## 8. 下一里程碑

### 目标

完成V0.1闭环验收（账号、权限、真实数据底层）并形成可重复验证证据。

### 剩余任务

- [ ] 建立并执行线上账号登录与会话恢复验证清单
- [ ] 建立并执行多账户数据隔离验证清单（私人食品、历史、计划）
- [ ] 建立并执行管理员权限验证清单（公共食品管理边界）
- [ ] 补齐最小自动化测试（认证、RLS关键路径、核心页面）
- [ ] 明确当前日记录的实时持久化策略并补齐闭环（或明确仅归档模式）

### 验收标准

- [ ] 普通用户无法读取/修改他人私人数据（含食品、历史、计划）
- [ ] 管理员仅在授权范围内管理公共食品
- [x] 登录、刷新、退出及重新登录行为具备自动化回归
- [x] 已具备核心日期、认证、删除、移动端和版本页面的可重复自动化验证
- [ ] V0.1每条完成标准都能映射到证据（代码+验证结果）

### 暂时不要做

- 模板、周计划、自动生成、减脂模式等V0.7+功能
- 离线/PWA/App封装（Phase 3范围）

## 9. 下一步任务顺序

1. 环境与认证验证（本地+线上）
2. 用户资料与管理员身份验证
3. 权限与RLS边界验证
4. 真实数据读写闭环验证（食物/历史/计划）
5. 多账户隔离回归
6. 构建与部署回归验证
7. 自动化测试最小集落地

## 10. 判断依据

- 前端目录结构与页面路由
  - 证据：frontend/src/App.js
  - 证据：frontend/src/pages/*.jsx
- 状态管理
  - 证据：frontend/src/store.jsx
- Supabase客户端配置
  - 证据：frontend/src/lib/supabaseClient.js
- 登录逻辑与会话恢复
  - 证据：frontend/src/services/authService.js
  - 证据：frontend/src/App.js
- 用户名登录函数
  - 证据：supabase/functions/username-login/index.ts
  - 证据：supabase/config.toml
- 数据库迁移与RLS
  - 证据：supabase/migrations/001_initial_schema.sql
  - 证据：supabase/migrations/003_food_library_visibility.sql
  - 证据：supabase/migrations/004_username_login.sql
  - 证据：supabase/migrations/005_daily_archives.sql
  - 证据：supabase/migrations/006_daily_archives_completion.sql
  - 证据：supabase/migrations/007_admin_public_foods.sql
  - 证据：supabase/migrations/008_fix_foods_admin_rls_compat.sql
  - 证据：supabase/migrations/009_fix_is_app_admin_missing_columns.sql
  - 证据：supabase/migrations/010_restrict_admin_foods_select.sql
- 食品CRUD与权限调用
  - 证据：frontend/src/pages/FoodLibraryPage.jsx
  - 证据：frontend/src/services/foodService.js
- Today/History/HistoryDetail/Plan页面实现
  - 证据：frontend/src/pages/TodayPage.jsx
  - 证据：frontend/src/pages/HistoryPage.jsx
  - 证据：frontend/src/pages/HistoryDetailPage.jsx
  - 证据：frontend/src/pages/PlanPage.jsx
- 构建脚本与依赖
  - 证据：frontend/package.json
- 测试资产
  - 证据：tests/__init__.py
- Git演进
  - 证据：`git log --oneline` 最新提交序列

## 完成度

| 范围 | 完成度 | 判断依据 |
|---|---:|---|
| 页面与交互 | 45% | 已有登录、今日、历史、食物库、计划页面与主路由；身体记录/模板/周计划/减脂模式页面缺失 |
| 真实数据库闭环 | 42% | 认证、食物、计划、归档链路存在；当前日实时记录与线上权限回归证据不足 |
| V0.1 | 59.4% | 按8项验收标准打分（1/0.5/0.25）计算 |
| Phase 1整体 | 17% | 等效完成量约=V0.1(59.4%)+V0.2(45%)+V0.3(40%)+V0.4(30%)+V0.6(20%)，其余0；折算到11个版本 |
| 测试与稳定性 | 15% | 构建脚本完善，但自动化测试几乎空白，线上验证依赖人工 |

> 无法仅通过本地仓库确认，需要线上环境验证。

## 11. 账户模块状态（2026-07-26）

- 账户信息展示：已完成
- 展示名称修改：已完成
- 密码修改：已完成
- 用户名修改：暂不支持
- 邮箱修改：暂不支持
- 用户角色修改：仅管理员权限体系控制
- 账号状态修改：仅管理员权限体系控制
- 个人信息（身体信息）基础编辑：已完成（性别 / 生日 / 身高 / 体重）

## 12. 版本信息与修改意见任务模块状态（2026-07-26）

- 当前版本展示：已完成
- 真实上线时间展示：已完成（支持 development 状态显示“尚未正式上线”）
- 独立版本更新文档：已完成（`docs/version-updates/`）
- 第一版本记录结构化展示：已完成（支持版本概览、重点与分类展开明细）
- 修改意见提交：已完成
- 修改意见历史：已完成
- 修改意见编辑：已完成
- 修改意见删除：已完成
- 完成时间记录：已完成
- 完成版本关联：已完成
- 管理员任务状态管理：已完成（完成时必须填写完成版本，可恢复为未完成）

## 13. v0.1.2 上架前状态（2026-07-27）

- 发布范围：已按 Git 证据确定为 `aff3d4b6c355c86ddef276887677b15ad6a16653..aa088f83c60272a9eaae318c1bf28f9af293e68e`。
- 版本号与网页版本日志：已更新为 v0.1.2，上线时间保持待确认。
- 已完成并纳入：
  - 历史记录查看/编辑、整日删除、批量删除和删除本日后的状态恢复。
  - 设置中的历史记录直达入口，以及底部导航三入口布局。
  - 账户、个人信息、版本反馈、摄入计划和记录设置能力。
  - 首页、训练、加餐、时间轴、移动端布局和性能相关修复。
- 后续版本：
  - Roadmap 中模板、周计划、规则自动生成、减脂模式、离线和 AI 功能未纳入 v0.1.2。
- 待人工核验：
  - 生产环境迁移 `011`–`020` 的应用顺序和执行结果。
  - 普通用户／管理员双账号的登录、切换、RLS 和公共／个人食物权限。
  - Supabase `version_feedback` 中是否仍有待处理建议。
  - 主要移动端页面真机布局、点击和返回流程。
- 本地阻断修复：
  - `react-day-picker` 已升级到兼容 React 19 的 `8.10.2`，包管理统一为 npm 与 `package-lock.json`；全新空 cache、无 `node_modules` 的 `npm ci` 退出码为 0。
  - Vercel 明确使用 `frontend` Root Directory、`npm ci`、`npm run build` 和 `build` 输出目录；当前发布说明与用户提示不再引导 Yarn。
  - `auto-archive-records` 已增加 `AUTO_ARCHIVE_CRON_SECRET` 服务端 Bearer 鉴权，未授权请求在创建 service-role 客户端前返回 `401`／`403`。
  - 自动归档改为调用 `auto_archive_user_records`：同一事务内串行化用户日期、锁定时间轴与食物明细、复核资格、写归档、删除时间轴并写防重日志；异常整体回滚。
  - 待部署迁移 015 不再删除未知 RLS policy；016 保留 legacy completed 状态和完成时间，允许旧记录的完成版本暂时为空。
  - 迁移 020 已移除全表级锁，改为锁定目标用户/日期的现有时间轴及其食物明细，只删除已进入本次快照的 ID；同一用户/日期 advisory lock 继续保留。
- 生产环境待人工确认：
  - 先审核并应用迁移 `020_auto_archive_transaction.sql`，再配置 Supabase Secret `AUTO_ARCHIVE_CRON_SECRET`、部署更新后的函数，并同步为 Cron 请求配置同一服务端 Secret；不得把 Secret 写入前端或仓库。
  - 用隔离测试账号验证无密钥／错误密钥拒绝、正确密钥执行、归档日期范围与失败恢复，再决定是否启用生产 Cron。
  - 在执行 014–020 前，先运行 `supabase/preflight/v0.1.2_migrations_014_020_readonly.sql` 的各只读分段并人工审查异常数据、未知 policy、依赖对象和约束。

## 14. v0.1.3 范围确认与任务清单（2026-07-28）

- 版本名称：v0.1.3 — 基础记录闭环与稳定性收尾
- 版本状态：上线前检查完成（待发布，未上线）
- 正式上线时间：待正式上线确认（禁止提前填写）

### 14.1 版本目标

- 将 v0.1 阶段核心链路收敛到可验收、可回归、可发布状态。
- 优先补齐已有实现中的缺口与测试空白，不扩展新业务模块。

### 14.2 纳入范围

- 登录与退出账号。
- 首页饮食记录新增、编辑、删除。
- 删除全部食物后自动删除空餐。
- 结束本日与下一记录日推进。
- 首页真实日期、当前记录日和已结束状态规则。
- 删除本日历史后首页返回真实本日。
- 历史记录查看、编辑、单条删除和批量删除。
- 设置入口进入历史记录。
- 底部导航仅保留首页、食物库、设置。
- 食物库基础功能与用户数据权限。
- 基础计划功能。
- 刷新、重新登录后的数据与页面状态。
- 手机端主要页面。
- Production 是否为最新部署版本。

### 14.3 分类核对结果（以当前代码与测试证据为准）

已完成，可直接验收：
- 登录与退出链路可用；会话恢复与用户态清理已落地。
- 设置页账号区域的退出账号闭环已完成；退出成功后清除私有运行时状态并返回普通登录页。
  - 相关 Commit：746daeb04c7e390588f13d6984a9700f823eea41
- “结束本日／删除本日历史／返回首页”关键路径回归已完成，覆盖完成状态、下一记录日、删除隔离、取消/失败及重新初始化。
  - 相关 Commit：f132b6c3c9aa3f54454c8a54b464587c01e291f9
- 刷新与重新登录状态一致性回归已完成，覆盖有效/无效 session、认证等待、日期恢复、同账号重载、跨账号数据隔离、失败降级和重复认证回调。
  - 修复账号切换时旧 profile 短暂保留，以及旧账号 history/plan 异步响应迟到覆盖新账号状态的问题。
  - 相关 Commit：81860a472efdb3b048ef1eba2c8d6c03a93b59c0
- 手机端主要页面验收已完成，覆盖 320×568、375×667、390×844、430×932；登录、首页、添加食物、历史、食物库、计划、设置及确认交互均形成可复验记录。
  - 修复小屏 Sheet/弹窗高度与滚动、长食物名称换行和首页食物删除点击区问题。
  - 相关 Commit：a0eccfbc602ff09c5b2e7f034dead1026b278749
- 首页当日食物删除与空餐自动清理已落地；删除成功后会立即更新餐次及当日四项营养汇总。
  - 相关 Commit：deb10ece832d4f4dcee6bf34a78c486f03d96546
- 结束本日后推进到下一记录日；首页日期动态规则与删除本日恢复规则已落地。
- 历史记录查看、编辑、单条删除、批量删除已落地。
- 设置入口进入历史记录已落地。
- 底部导航三入口（首页/食物库/设置）已落地。
- 食物库基础能力与权限控制主链路已落地。
- 基础计划功能（含三填一算与历史）已落地。

已实现但需要修复或补充测试：
- 无仓库内已知上线阻塞项；Production 当前仍为 v0.1.2，待本轮提交推送后执行正式部署与线上验收。

尚未实现，需要纳入 v0.1.3：
- 无；发布前代码与文档检查已完成，Production 部署不在本任务授权范围内。

不属于 v0.1.3，移入后续版本：
- 统计增强。
- 模板。
- AI。
- 离线数据库与同步。
- 图片体系扩展。
- GI/GL 扩展。
- 健身模块独立扩展。
- 记账模块。

### 14.4 待处理任务清单（按优先级）

P0：
- 已完成：退出账号、首页食物删除、结束本日／删除本日历史／返回首页关键路径均有自动化回归。

P1：
- 已完成：刷新与重新登录后的状态一致性回归。
- 已完成：手机端主要页面验收清单（登录、首页、历史、食物库、计划、设置及关键弹窗）。

P2：
- 已完成：Production 版本一致性核对步骤与发布前检查清单。

### 14.5 上线验收标准

- P0 任务全部完成并通过测试。
- P1 任务完成并形成可复验记录。
- 文档、版本索引、发布记录一致。
- 仅在真实生产完成后回填上线时间。

### 14.6 回填位置

- Commit ID 回填位置：`docs/version-updates/v0.1.3.md` 的“相关提交”章节。
- 正式上线时间回填位置：`docs/version-updates/v0.1.3.md` 的“上线时间”章节与版本配置 `releasedAt` 字段（发布后再填）。

### 14.7 发布前 Review 结论

- 实际完成范围：首页食物删除与空餐清理、退出账号、日期关键路径、刷新/重新登录状态隔离、四档手机 viewport 验收均有实现与自动化证据。
- 版本一致性：`frontend/package.json`、lock 根包版本、版本配置、网页最新版本记录、项目状态、版本索引和 v0.1.3 独立文档统一为 v0.1.3“基础记录闭环与稳定性收尾”。
- 网页版本页：只展示最新 v0.1.3 内容和版本概述，不展示版本状态；未发布时显示“尚未正式上线”。
- 修改意见能力：提交、查看、编辑、删除、完成状态和完成版本管理已在 v0.1.2 完成。
- 修改意见真实数据：本地仓库不包含 Production `version_feedback` 数据，无法宣称 pending 已清空；正式部署前由管理员在现有页面复核。
- 明确延期：真实设备软键盘、安全区、系统字体放大、动画与视觉细节；统计、模板、AI、离线数据库、图片体系、GI/GL、健身和记账模块继续排除在 v0.1.3 外。
- 最终验证：版本校验通过；全量测试 23 个套件、164 个用例通过；生产构建成功。
- 已知非阻塞输出：测试环境缺少 Supabase 变量提示、模拟 session 失败日志，以及构建 `fs.F_OK` 弃用警告。
- 发布前 Review Commit：fcf5f6dcc5199992ed38d16bf20962b050cc20ef

### 14.8 Production 反馈与上线前任务进度

- 进度：10/10（全部上线前需求已完成、测试并形成独立提交；待本任务提交回填后统一 push）。
- Feedback `4571c958-7f36-42e2-b8a1-0f697452d18b`：历史记录列表顶部返回入口已补齐。
  - 按钮始终存在，具有“返回上一页”无障碍标签和至少 44×44px 移动端点击区。
  - 明确设置来源返回 `/settings`；其他有效应用内来源优先返回上一页；直接访问、刷新或详情安全回退时 replace 到 `/settings`。
  - 单条删除或批量删除后继续停留历史列表，返回按钮保持可用；返回操作不修改历史与日期状态。
  - 相关 Commit：8949a5bf46a711b9720dee5e69bc28a9978ff7e8
- Feedback `33bd0635-8244-44e7-96bc-a02a98b4d588`：固定三餐直接修改时间已完成。
  - 早餐、午餐、晚餐按固定 subtype 识别，首页移除其独立“编辑”按钮；点击当前时间打开时间修改 Sheet。
  - 时间输入使用 24 小时制，支持取消、非法值拦截、保存加载态、防重复和失败保留原值。
  - 已落库记录按 `id + user_id` 更新；默认临时餐次首次修改只创建一条对应记录，成功后保留食物并更新数据库 ID。
  - 当前日期初始化读取持久化时间并补齐缺失固定餐次，刷新可恢复；首页按实际时间稳定排序。
  - 加餐和历史详情原有编辑行为保持不变。
  - 专项测试：3 个套件、12 个用例通过；全量测试：26 个套件、176 个用例通过；Production build 通过。
  - 相关 Commit：8124bc609fa572336d8d647abcce8ba25ec1bc24
- Feedback `d08f38c9-07e9-48ec-a734-6c994672f823`：添加、修改和保存成功提示自动消失已完成。
  - 项目继续使用根级 Sonner `Toaster`，成功提示统一通过 `showSuccess` 显示 2000ms。
  - 同文案连续成功操作复用稳定 ID，避免重复 Toast 堆叠；消失后不保留页面占位。
  - 首页、食物库、历史编辑、摄入计划、账户资料、记录设置、密码及修改意见管理的成功反馈均已接入。
  - 错误 Toast 保持 Sonner 默认时长和关闭按钮；表单校验、Dialog、AlertDialog 与固定页面提示未缩短。
  - 专项测试：7 个套件、44 个用例通过；全量测试：27 个套件、180 个用例通过；Production build 通过。
  - 相关 Commit：a66dd0e91d5b11ec04e95ef5bbc10544a505f043
- 新增上线前需求：所有现有记录时间修改界面增加“使用现在时间”。
  - `EditTimeSheet` 覆盖首页固定三餐、加餐和历史详情餐次；`EditActivitySheet` 覆盖首页与历史详情训练/事件的开始和结束时间。
  - 使用设备本地时间并格式化为补零 `HH:mm`，不经过 UTC 转换。
  - 点击只填入对应输入，不保存、不关闭，且仍可继续手动修改；开始与结束按钮互不覆盖。
  - 保存、权限、防重复、失败保留输入、排序与刷新恢复仍沿用现有逻辑。
  - 专项测试：5 个套件、37 个用例通过；全量测试：28 个套件、185 个用例通过；Production build 通过。
  - 当前环境无法安全查询 Production 是否存在对应 pending feedback，未伪造 Feedback ID。
  - 相关 Commit：4986525fef380e81cc68e6ca9c1df05ddea4e3b6
- Feedback `ec401249-78d3-4c3c-b0fc-6dfae568cd89`：首页非本日固定日期提示已完成。
  - 页面同步状态之后、日期标题之前显示常驻状态卡片，不是 Toast、Dialog 或悬浮层。
  - 使用设备本地年月日比较；同年显示“月日”，跨年显示“年月日”。
  - 过去、未来、结束本日自动推进及刷新恢复到非本日日期时显示；返回真实本日或删除本日历史恢复后消失。
  - 不改变周日历、结束本日、历史删除、记录日期或首页导航规则。
  - 专项测试：4 个套件、41 个用例通过；全量测试：29 个套件、189 个用例通过；Production build 通过。
  - 相关 Commit：c1d8e2c4f449a3f9d283c5e5dd7073a9cbec1037
- 新增上线前需求：建议历史分区、排序、只读权限和提交天数显示已完成。
  - 未完成建议位于上方，按 `created_at` 倒序；已完成建议位于下方，按 `completed_at`、`updated_at`、`created_at` 倒序稳定排列，两个区域显示各自数量和空状态。
  - 未完成建议按设备本地自然日显示“已提交 X 天”，当天为 0 天，未来异常时间最低为 0 天，避免 UTC 跨日误差。
  - 已完成建议在普通用户和管理员页面中均不提供编辑、删除或恢复入口；管理员完成 pending 后卡片即时移入已完成区并显示完成版本和时间。
  - Service 写入增加 `status = pending` 条件；新增 migration 通过触发器和 RLS 阻止普通应用流程编辑或删除 completed，管理员仍可通过既有受控 RPC 完成必要状态管理。
  - 专项测试：前端 2 个套件、20 个用例与 migration 契约 3 个用例通过；全量测试：30 个套件、197 个用例通过；Production build 通过。
  - Migration 尚未执行到 Production；执行前仍需在目标 Supabase 环境验证 SQL、RLS 和触发器。
  - 相关 Commit：892eaacdfff960eb699510949b82c9cae1dd244c
- 已修正的上线前需求：退出账号入口位置恢复为 v0.1.2 顺序。
  - v0.1.2 tag 核对顺序为账号分组、记录分组、账号操作（退出账号）、底部版本号链接。
  - 当前唯一退出入口位于记录分组之后、底部版本信息区域之前，不再是页面最后一个元素。
  - 页面继续使用 `pb-32` 并叠加底部安全区留白，避免被底部导航遮挡。
  - 现有确认弹窗、取消、退出防重复、失败提示、私有状态清理、公共食品保留和 replace 返回普通登录页逻辑均未改变。
  - 专项测试：5 个套件、38 个用例通过；全量测试：31 个套件、204 个用例通过；Production build 通过。
  - 原位置变更 Commit：9219280c7458d837c4f89982c0d9f38515b82ceb
  - 位置修正 Commit：30092cdc5becc70a906fe99b2915d6e31c5d6d3e
- 新增上线前需求：修改意见子页面返回入口统一已完成。
  - 实际 feedback 子页面为 `/settings/version/feedback`，提交建议、建议历史和管理员操作均通过同页 Tabs 提供。
  - 页面顶部共享返回入口由“返回设置”改为唯一的“返回版本信息”，明确 replace 到正式版本信息路由 `/settings/version`。
  - 页面正文原有重复“返回版本信息”链接已删除；直接访问或刷新后仍可安全返回，不依赖浏览器历史。
  - 其他普通设置子页面继续使用“返回设置”，版本信息页自身未增加循环返回入口。
  - 专项测试：6 个套件、54 个用例通过；全量测试：31 个套件、204 个用例通过；Production build 通过。
  - 相关 Commit：6f5a935c577f9e0853cf7cdfa2d03961674ae497
- 最后一项上线前需求：建议历史进入响应优化已完成。
  - 真实原因：页面原先没有跨挂载缓存，每次进入历史 Tab 均重新请求；提交成功同时由 effect 和显式调用触发等价加载；请求缺少卸载与账号切换迟到响应保护。
  - 页面点击历史后立即显示返回入口、Tabs、未完成/已完成区域和明确 loading，不再等待请求后才出现区域结构。
  - 使用项目已有 React Query，缓存 key 包含用户 ID 与管理员权限；60 秒内新鲜缓存同步显示且不再请求，过期缓存先显示再刷新，同 key in-flight 请求在 Strict Mode 下合并为一次。
  - 退出账号现有 private query 清理规则覆盖反馈缓存；账号切换使用不同 key，旧账号迟到响应不能覆盖新账号。
  - 列表查询只选择卡片实际字段；pending/completed 继续由同一次查询结果在前端分区，没有新增串行状态查询或 N+1。
  - 专项测试：2 个套件、34 个用例通过；全量测试：31 个套件、210 个用例通过；Production build 通过。
  - 相关 Commit：cf169e397fb18998cb0481ab1859e276dace2f85
- 当时状态：v0.1.3 尚未正式上线，该项未触发 Production 部署、tag 或上线时间回填。

### 14.9 v0.1.3 正式上线

- 正式上线时间：2026-07-28 15:55:36（Australia/Sydney）。
- 第一次功能 Production 部署：
  - URL：`https://calendar-6qar9eu10-finn23.vercel.app`
  - 部署 ID：`dpl_CPgjD9wqAAXTmiHtpG2cUP24addu`
  - Production alias：`https://frontend-nu-khaki-18.vercel.app`
  - Git Commit：`849d2ee7797b7f56abf8dd4fe3576a68fc5a1a75`
- Migration 021：已应用到 Production，远端 migration 列表显示 local/remote 均为 `021`。
- Production Feedback Review：四条原始反馈均保持 `completed`，`completed_version` 均为 `v0.1.3`，pending 数为 0。
- 最终验证：前端 31 个套件、210 个测试通过；migration 契约 3/3 通过；Production build 成功。
- 线上验收：正式 alias 返回 200；首页、设置、版本信息、修改意见和历史页均在有效 Production 会话中正常渲染；Production JS/CSS 与本地已测试构建产物 SHA-256 一致。
- 发布记录同步部署：`dpl_66s7uKJP9nRepwp7dxedEyJNJz1e`，对应 Commit `714674ab7ba6c9eaafe4301bbaf42d503b52da98`；正式 alias 已显示 v0.1.3 与真实上线时间。
- 非阻塞事项：依赖安装存在既有 peer/deprecation/audit 输出；真实设备软键盘、安全区、系统字体放大和动画细节继续作为后续优化。
## v0.2.1 Status Update (2026-07-29)
- AFCD Data Converter implemented and verified with 1,588 records (local-only dry-run).
- Official data files for AFCD (Release 3) and USDA Foundation Foods identified.
- Mapping rules established and validated for AFCD Excel sources.
- Pending: USDA converter, Chinese name translation, intake types, portion/alias association, and database dynamic validation.
## v0.2.1 Status Update (2026-07-30)
- AUSNUT 2023 fixed portions corrected and fully audited: 9,816 source rows, 332 exact-key candidate matches, 544 retained portions across 222 foods.
- Final review split is 321 ready and 223 needs_review; 110 exact-matched foods have no retained portion because their only source rows are explicitly marked density records.
- Original commits `05b20f00c7837f0188c007d5952686b33eed53bc` and `6b215ba45190e8d2b5310a79b43399c1ffcc1531` remain unchanged; correction commit is `19f658518e8e11cf0ecc3fa0b7497b1fff038b69`.
- Pending: stage 7 final import JSON, manual review resolution, database integration, and dynamic database validation.


## v0.2.1 Status Update (2026-08-02)
- 阶段 8/8C-1 完成：完成剩余24条needs_name_review食品复核。
- 状态分布：release_ready 217, release_ready_without_portion 179, needs_name_review 3, exclude_candidate 1（合计 400）。
- 可批准候选：396 条。
- 确认数据一致性及人工复核结论的机器准确性；仅为本地验证，未执行远程写入或审核变更。

## v0.2.1 Status Update (2026-08-03)

- P0编号19重新修正完成，继续等待用户最终验收：真实Production本地bundle与DOM确认`/library`已挂载`PublicFoodBrowser`，此前失败源于筛选与营养信息的视觉可发现性不足，而非字段或路由未接通。
- 筛选区现明确显示“食品分类”和“主要摄入类型”，卡片直接显示每100g热量、蛋白质、碳水和脂肪及“查看详情”；详情展示扩展营养、portion、alias与来源。
- 普通公共库排除无`source_name`的legacy测试记录，清除筛选后恢复136条正式AFCD食品；未修改远程数据。
- 专项3套件12项、全量41套件263项通过，Production Build成功；Safari真实预览验证搜索、详情、筛选、清除及336px窄屏无横向溢出。严格320px和最终视觉仍待用户验收。

- P0编号19普通用户公共食品查看界面代码完成，等待用户最终验收：食物库默认显示“公共食品”，并与“我的食品”清晰分区；公共食品保持只读。
- 查询在Supabase端限定approved且active的public食品，提供中文名、英文名、品牌、公共alias搜索、一级分类/intake_types组合筛选和24条分页；详情按需读取alias与portion，NULL营养显示“暂无数据”。
- 普通测试账号远程只读验收确认非管理员，仅可见136条AFCD食品、28条alias和203条portion；disabled食品与导入审计不可见，未发生远程写入。
- 专项2套件9项、食品导入回归53项、前端全量40套件260项通过，Production Build成功；仅保留既有`fs.F_OK`弃用警告。
- P0编号5和6已通过用户最终验收；远程Feedback仍保持pending，需后续单独授权校准。本项同样不提前修改Feedback状态。
- 本项未push、未部署Migration 028、未修改公共食品数据或审核状态。

- P0编号5食品删除链路已通过用户最终验收：固定三餐最后一项删除后保留空餐次；自定义餐次严格先删除food entry、再删除空meal，部分失败时保留空餐并明确提示。
- 删除操作增加可持久化pending-delete tombstone，IndexedDB和远程/Realtime合并不会用旧响应恢复已删除食品；临时未同步食品不发送无效远程delete。
- 普通测试账号受控数据库验收确认固定早餐删除后餐次保留、自定义末项删除后空餐移除，测试记录残留为0；专项5套件41项、相关回归8套件55项、全量38套件251项通过，Production Build成功。
- 本项未push或部署，远程Feedback仍为pending，Migration 028未部署，公共食品及审核状态未修改。

- 首页刷新恢复已改为缓存优先：有效session确认后不再等待profile网络请求才挂载Store，IndexedDB按应用来源、用户和记录日期恢复最近时间线，Supabase随后后台校准并继续作为唯一事实来源。
- 缓存包含食品营养快照、缓存时间与schema版本；损坏、缺失或不兼容时安全回退。远程失败会保留缓存并显示非阻塞同步错误，退出后的内存私有状态立即清空且不同账号不能读取彼此缓存。
- 专项5套件38项、全量38套件244项通过；Production Build成功。本地Production预览中首次内容绘制约731ms，记录远程请求约2.69–3.46秒才完成，刷新结果中的已有食品和237 kcal汇总保持显示。
- 本项尚未push或部署，Migration 028未部署；仍需用户完成有/无缓存、慢网/断网、跨账号及重新登录最终验收。

- P0-1“记录后返回首页记录消失”已通过用户最终验收。
- 根因是首页添加食品原先仅追加本地Store并提示成功，没有写入`food_entries`；刷新、导航初始化和重新登录从数据库读取时自然丢失。
- 新流程复用或创建当天正确餐次，写入食品快照并使用数据库真实meal/entry ID更新页面；失败不产生虚假前端记录，新建餐次后的食品写入失败会补偿清理。
- 时间线重新加载会按当前用户与日期读取食品记录并挂回餐次；普通测试账号的受控数据库验收已覆盖立即、刷新式、导航式和重新登录读取，测试记录已清理。
- 专项2套件6项、相关回归9套件61项、全量34套件225项通过；Production Build成功。
- 本项尚未push或部署，远程Feedback状态未修改，仍需用户在部署后的真实界面完成最终验收。

## v0.2.1 Status Update (2026-08-04)

- P0编号19继续完善并等待用户最终验收：公共食品列表在手机、平板和桌面端统一为单列，每张卡片独占一行。
- 公共食品分页由24条调整为固定10条，页面与Supabase服务端range共同使用统一常量；136条结果对应14页，最后一页允许少于10条。
- 搜索、分类、摄入类型变化及清除筛选会回到第一页；普通翻页保留当前搜索和筛选条件。
- 未修改公共食品搜索、筛选、详情、权限及远程数据逻辑；未部署Migration 028，未push。
- 专项3套件15项、全量41套件266项通过，Production Build成功；本地Production预览确认桌面单列、10条分页、14页、筛选重置及详情正常。Safari无法严格调整至320px，最终移动端视觉仍待用户验收。
- P0编号19已通过用户最终验收；远程Feedback仍待统一收尾更新。
- P0编号20代码和远程验收完成，等待用户最终页面验收：个人食品删除改为本人软停用，列表和添加食品选择只显示active个人食品，历史food_entry快照继续保留。
- Migration 029已单独部署并通过远程普通账号验收：F007325复制得到1条private副本、2个alias、4个portion；重复调用返回既有副本，不新增数据；编辑、匿名拒绝、软停用和测试数据清理均已验证。
- 用户真实验收发现首次复制成功后页面未刷新个人食品Store，已修复为复制回调等待`refreshFoods`完成后再切换到我的食品，并清空个人搜索/分类状态。另新增Migration 030：已软停用的既有副本再次复制时恢复active并更新名称，避免029唯一索引导致“复制成功但不可见”。030已隔离部署并通过普通账号验收。
- 远程AFCD基线保持approved 136、pending 0、disabled 264；公共食品及其alias/portion未修改。Migration 028仍未部署，029未重复部署，远程Feedback保持pending。
