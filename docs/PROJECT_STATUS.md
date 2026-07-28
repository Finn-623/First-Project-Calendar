# 当前项目进度

## 1. 审查信息

- 审查日期：2026-07-27
- 审查范围：本地仓库代码、迁移文件、函数配置、测试目录、Git提交记录、现有文档
- 审查方式：静态代码与文件证据审查（未执行业务功能开发、未改动数据库结构、未部署）
- 重要限制：无法直接访问线上Supabase与Vercel运行态，因此涉及线上行为的结论标记为“无法验证”或“需要线上环境验证”

## 2. 当前阶段和版本判断

## 当前版本判断

- 当前Phase：Phase 1（完整饮食管理 App）
- 当前开发版本：v0.1.3 — 基础记录闭环与稳定性收尾。
- 当前状态：上线前代码、版本号、自动化测试、构建和发布文档一致性检查已完成，尚未部署 Production。
- 判断结论：v0.1.3 已达到待发布状态；正式上线时间、部署信息和 tag 必须在真实 Production 验收后回填。

### 判断原因

1. 账号登录、会话恢复、登出清理、profiles读取、Supabase环境变量门禁与提示均有真实实现，但“线上可用性”与“跨账户隔离”仍需线上验证。
2. 食物库、历史归档、计划页面与管理公共食品功能存在实现，但不等于V0.1已完整验收。
3. 当前已有历史删除、日期状态、底部导航、设置入口、账户、个人信息、摄入计划、版本反馈和记录设置等自动化测试；真实登录态、生产 RLS 和移动端真机仍缺少自动化或实机证据。
4. Roadmap 中模板、周计划、自动生成、减脂模式、离线和 AI 能力继续归入后续版本，不纳入 v0.1.3。

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

### 14.8 Production 反馈修复进度

- 进度：1/4（代码、测试与提交完成；反馈状态待 Production 管理权限更新）。
- Feedback `4571c958-7f36-42e2-b8a1-0f697452d18b`：历史记录列表顶部返回入口已补齐。
  - 按钮始终存在，具有“返回上一页”无障碍标签和至少 44×44px 移动端点击区。
  - 明确设置来源返回 `/settings`；其他有效应用内来源优先返回上一页；直接访问、刷新或详情安全回退时 replace 到 `/settings`。
  - 单条删除或批量删除后继续停留历史列表，返回按钮保持可用；返回操作不修改历史与日期状态。
  - 相关 Commit：待回填
- v0.1.3 尚未正式上线，本项未触发 Production 部署、tag 或上线时间回填。
