# 当前项目进度

## 1. 审查信息

- 审查日期：2026-07-26
- 审查范围：本地仓库代码、迁移文件、函数配置、测试目录、Git提交记录、现有文档
- 审查方式：静态代码与文件证据审查（未执行业务功能开发、未改动数据库结构、未部署）
- 重要限制：无法直接访问线上Supabase与Vercel运行态，因此涉及线上行为的结论标记为“无法验证”或“需要线上环境验证”

## 2. 当前阶段和版本判断

## 当前版本判断

- 当前Phase：Phase 1（完整饮食管理 App）
- 当前版本：V0.1.1（账号、权限与真实数据底层）
- 当前状态：部分完成（存在后续版本功能实现，但V0.1验收项尚未形成可确认闭环）
- 判断结论：项目已具备V0.2/V0.3/V0.6的部分实现，但按“满足的最高完整版本”为准，当前仍处于V0.1收敛阶段。

### 判断原因

1. 账号登录、会话恢复、登出清理、profiles读取、Supabase环境变量门禁与提示均有真实实现，但“线上可用性”与“跨账户隔离”仍需线上验证。
2. 食物库、历史归档、计划页面与管理公共食品功能存在实现，但不等于V0.1已完整验收。
3. 自动化测试资产不足（仅存在测试包初始化文件），稳定性与回归证据不充分。
4. 版本判断遵循“先完成前置版本再进入后续版本验收”的依赖顺序，故当前归类为V0.1部分完成。

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
- `已完成` 登出/切换账户时清理本地用户态
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
  - 说明：登录页底部显示 `当前版本：v0.1.1`，版本来源统一为 `frontend/package.json`。
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
  - 说明：底部导航统一为“首页｜历史｜食物库｜设置”，设置页承载账号信息、个人信息、摄入记录历史以及切换账户/退出账户入口；`/plan` 路由保留但不再作为底部一级入口。
  - 相关 Commit：58237724a596fe08aa5a03b8b050aee903c190f5
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

## 5. 尚未开始

以下在仓库中未找到可确认实现（非仅文件名判断）：

- `尚未开始` V0.5 身体记录（体重/围度长期记录与对比）
  - 证据：frontend/src/pages 仅含 Login/Today/History/HistoryDetail/FoodLibrary/Plan
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
- [ ] 登录、刷新、登出、切换账户行为稳定可复现
- [ ] 至少具备一组可重复执行的自动化验证
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