## DEV-20260726-001

- 日期：2026-07-26
- 状态：已完成
- Git Commit ID：260e134

### 任务目标

- 建立开发记录与版本管理文档结构。
- 建立 AI 执行和记录规则。
- 验证文件路径及规则可正常使用。

### 实际完成内容

- 创建或确认项目记录文件结构。
- 在 `AGENTS.md` 中建立开发记录、编号、测试、Git和安全规则。
- 确认其他记录文档暂不填写项目规划和历史记录。
- 确认后续代码修改任务可以按照 `AGENTS.md` 更新相关文档。

### 主要修改文件

- `AGENTS.md`（新建并写入规则，来源于本次“建立开发记录与版本管理规则”任务的实际修改）
- `docs/DEVELOPMENT_LOG.md`（本次追加开发记录）

### 测试与验证

- 检查要求的文件路径是否存在：执行文件存在性检查命令，确认 `AGENTS.md`、`CHANGELOG.md`、`docs/ROADMAP.md`、`docs/DEVELOPMENT_LOG.md`、`docs/DATABASE_CHANGES.md`、`docs/DECISIONS.md` 均存在。
- 检查 `AGENTS.md` 是否可以正常读取：通过 `grep` 读取并匹配关键规则片段。
- 检查记录规则是否包含 DEV、DB和ADR编号规则：匹配到 `DEV-YYYYMMDD-序号`、`DB-YYYYMMDD-序号`、`ADR-001`。
- 检查是否包含测试记录规则：匹配到“测试记录规则”章节。
- 检查是否包含Git限制和安全规则：匹配到“Git规则”和“安全规则”章节。
- 检查除本次开发记录外，未误填项目规划或历史版本内容：检查 `CHANGELOG.md`、`docs/ROADMAP.md`、`docs/DATABASE_CHANGES.md`、`docs/DECISIONS.md` 文件大小均为 0。
- 执行 `git status` 检查实际文件变化。
- 确认没有修改业务代码：本次仅追加 `docs/DEVELOPMENT_LOG.md` 记录。

### 测试结果

- 通过的检查：文件路径存在性、`AGENTS.md` 可读取、编号规则存在性、测试规则存在性、Git和安全规则存在性、`CHANGELOG.md`/`docs/ROADMAP.md`/`docs/DATABASE_CHANGES.md`/`docs/DECISIONS.md` 为空。
- 未通过的检查：无。
- 无法确认的项目：无。
- 是否发现路径、格式或规则问题：未发现。

### 未完成事项

- 当前尚未整理项目规划。
- 当前尚未补写历史版本记录。
- 当前尚未确定正式版本号。
- 当前尚未执行 Git commit。

### 风险或注意事项

- `AGENTS.md` 只能约束 AI 后续执行任务时的行为，不能监控用户手动完成的所有代码修改。
- 每次让 AI 修改代码时，仍应要求它遵守 `AGENTS.md` 并更新相关记录。
- Git Commit ID必须在真实提交后才能补充。

### 下一步

- 从下一次实际代码修改任务开始，按照 `AGENTS.md` 自动分配 DEV 编号。
- 完成修改后执行相关测试。
- 更新 `docs/DEVELOPMENT_LOG.md`。
- 仅在确实涉及数据库、正式版本或重要决策时更新其他文档。

## DEV-20260726-003

- 日期：2026-07-26
- 状态：已完成
- 任务目标：精简登录页面 UI，移除非必要提示文案，保留必要输入、登录按钮、加载态和真实错误反馈。
- 实际完成内容：删除登录页中的测试账号提示、示例账号提示、登录说明、开发阶段提示和页面底部说明，仅保留标题、输入框、登录按钮、加载态和登录失败反馈。
- 主要修改文件或模块：`frontend/src/pages/LoginPage.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 遇到的问题：登录成功前的 toast 在无障碍树中不明显，随后补充了页面内可见错误提示。
- 解决方式：在不改变登录逻辑的前提下，增加页面内错误状态显示，并保留原有 toast 反馈。
- 执行的测试：`corepack yarn build`；浏览器打开 `http://localhost:3002/login`；输入用户名和密码；点击登录按钮；检查错误反馈；检查桌面端与手机端布局。
- 测试结果：构建通过；登录页可正常打开；用户名和密码输入正常；登录按钮可正常提交并显示加载状态；错误账号登录后页面内显示“用户名或密码错误”，toast 也可见；桌面端和手机端未见明显布局异常。
- 未完成事项：等待创建第一次提交后回填 Commit ID。
- 风险或注意事项：仅调整登录页文案与布局，不改认证逻辑、Supabase 认证、用户名登录函数或其他页面。
- Git 分支：supabase-v1
- Git Commit ID：未提交

## DEV-20260726-004

- 日期：2026-07-26
- 状态：已完成
- 任务目标：将面向用户展示的项目品牌名称统一为“生活”，并删除登录页宣传文案。
- 实际完成内容：将登录页品牌标题从“饮食记录”改为“生活”，并将站点标题从“日常 · 饮食与训练”改为“生活”。
- 主要修改文件或模块：`frontend/src/pages/LoginPage.jsx`、`frontend/public/index.html`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 遇到的问题：功能语境中的“饮食记录”与品牌名称混用，需要逐处区分。
- 解决方式：仅修改登录页与站点标题这两个品牌展示位；保留 `FoodLibraryPage` 中的业务描述文本不变。
- 执行的测试：`cd frontend && npm run build`；全局搜索 `饮食记录|健康生活从记录开始`；全局搜索 `日常 · 饮食与训练`；浏览器打开 `http://localhost:3002/login`；切换到手机视口检查布局。
- 测试结果：构建通过；登录页品牌标题显示为“生活”；登录页副标题已删除；站点标题显示为“生活”；旧品牌展示文本在前端源代码中未见残留；功能描述中的“饮食记录”保留；手机与桌面视口下未见明显布局异常。
- 未完成事项：等待创建第一次提交后回填 Commit ID。
- 风险或注意事项：仅修改用户可见品牌名称和登录页文案，不改仓库名、数据库、认证逻辑、业务功能或内部技术名称；功能语境中的“饮食记录”保留。
- Git 分支：supabase-v1
- Git Commit ID：cfbe92167a145b800ccbc67f2efc3f17e461c534

## DEV-20260726-005

- 日期：2026-07-26
- 状态：进行中
- 任务目标：在登录页面显示当前正式版本号 v0.1.1，并建立统一版本来源与正式上传同步版本记录的规则。
- 实际完成内容：待完成
- 主要修改文件或模块：`frontend/package.json`、`frontend/src/config/appVersion.js`、`frontend/src/pages/LoginPage.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 遇到的问题：待完成
- 解决方式：待完成
- 执行的测试：待完成
- 测试结果：待完成
- 未完成事项：待完成
- 风险或注意事项：统一版本来源采用 `frontend/package.json` 的标准 `version` 字段；登录页仅展示版本号，不改变认证逻辑或其他页面。
- Git 分支：supabase-v1
- Git Commit ID：737188e4b8619edd172bedce8ff518d1519b3b5c

## DEV-20260726-006

- 日期：2026-07-26
- 状态：已完成
- 修改模块：登录页面 / 移动端 UI
- 任务目标：修复移动端点击账号或密码输入框时页面自动放大。
- 问题描述：移动端聚焦登录输入框后页面会自动放大，切换焦点或收起键盘后可能保持异常缩放感知。
- 问题原因：登录页输入框使用 `text-[14px]`，低于 iPhone Safari 等浏览器的防缩放阈值（16px）。
- 解决方案：将登录页账号和密码输入框设置为 `text-base md:text-[14px]`，保证移动端实际字号为 16px。
- 是否修改公共组件：否。仅修改登录页面局部输入框样式，未改公共 `Input` 组件。
- 实际修改文件：`frontend/src/pages/LoginPage.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际测试范围：登录页输入框字号、焦点切换时缩放表现、移动端与桌面端布局、构建结果。
- 测试方式：浏览器设备模拟（390x844）+ 页面脚本检查；未使用真实手机。
- 执行的测试：`cd frontend && npm run build`；登录页移动视口下计算样式检查；焦点在账号/密码输入框间切换时 `visualViewport.scale` 检查；桌面视口样式检查。
- 测试结果：移动端账号和密码输入框均为 16px；焦点切换时缩放值为 1；按钮与输入框无重叠、无文字截断；桌面端输入框保持 14px；构建通过。
- 构建结果：通过。
- 当前分支：supabase-v1
- Git Commit ID：ed54314cfcf407addf000c101cdc28155c6b9cbd

## DEV-20260726-007

- 日期：2026-07-26
- 状态：已完成
- 模块：认证 / 登录性能
- 修改前问题：登录等待时间长，用户无法判断耗时发生在哪个阶段；重复触发提交会增加不必要请求风险。
- 登录流程结构：登录页提交 -> `authService.signInWithUsername` -> `username-login` 函数 -> `supabase.auth.setSession` -> App 认证状态更新 -> 路由进入登录后页面。
- 各阶段修改前耗时（实测）：
	- `username-login` 首次请求（错误密码）：3197.9ms
	- `username-login` 再次请求（错误密码）：1341.9ms
- 确认的主要瓶颈：`username-login` 首次调用明显慢于再次调用，存在冷启动/首调开销特征；前端存在登录成功路径重复触发 profile 查询的结构性开销风险。
- 实际解决方案：
	- 增加开发环境登录阶段计时（T0/T1/T2/T5/T6/T7/T8），输出无敏感信息摘要。
	- 增加代码级重复提交保护（`submitGuardRef`），避免并发重复认证请求。
	- 增加登录请求超时保护与可重试提示，避免长时间无反馈。
	- 去除登录成功后与 Auth 监听器重复触发的 profile 加载（保留单次加载并加并发去重）。
- 各阶段修改后耗时（实测）：
	- `username-login` 首次请求（错误密码）：4192.1ms
	- `username-login` 再次请求（错误密码）：1766.0ms
	- 前端阶段（错误密码，第1次）：用户名识别耗时 1179.8ms，总耗时 1180.2ms
	- 前端阶段（错误密码，第2次）：用户名识别耗时 893.1ms，总耗时 893.3ms
- 总耗时变化：在错误密码样本中，前端可观测阶段总耗时主要受远端 `username-login` 请求影响；本次前端优化侧重去重复请求、避免重复 profile 加载和改善等待体验。
- 首次登录与再次登录差异：首次请求明显慢于再次请求（远端首调成本更高）。
- 是否修改 Edge Function：否。
- 是否修改 Profile 查询：是（前端去重与并发保护，避免登录成功路径重复加载）。
- 是否调整登录后数据加载：是（移除登录成功回调中的重复 profile 加载，保留监听器单路径加载）。
- 实际修改文件：`frontend/src/lib/loginPerf.js`、`frontend/src/pages/LoginPage.jsx`、`frontend/src/services/authService.js`、`frontend/src/App.js`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际测试范围：登录失败链路耗时采样、连续提交防重、错误后按钮恢复、构建验证、控制台与网络重复请求观察。
- 测试方式：浏览器本地开发环境 + 自动化页面脚本；未使用真实手机。
- 构建结果：通过（`cd frontend && npm run build`）。
- 当前分支：supabase-v1
- Git Commit ID：ef9df7c9c77e0cb4c587faf699fec8fa0dd01533

## DEV-20260726-002

- 日期：2026-07-26
- 状态：已完成
- Git Commit ID：未提交

### 任务目标

- 录入产品Roadmap和Phase 1版本路线。
- 对当前仓库进行实际进度审查并给出版本判断。
- 建立项目状态和版本历史文档。

### 实际完成内容

- 更新 `docs/ROADMAP.md`，写入产品发展路径、Phase 0-4框架、Phase 1详细版本（V0.1-V1.0）。
- 新建 `docs/PROJECT_STATUS.md`，基于仓库证据输出当前阶段、版本判断、完成度与下一里程碑。
- 新建 `docs/VERSION_HISTORY.md`，追加“文档与Roadmap初始化”记录。
- 未修改业务代码、数据库结构、部署配置和依赖。

### 主要修改文件或模块

- `docs/ROADMAP.md`
- `docs/PROJECT_STATUS.md`
- `docs/VERSION_HISTORY.md`
- `docs/DEVELOPMENT_LOG.md`

### 遇到的问题

- 仅通过本地仓库无法确认线上Supabase与Vercel运行态是否满足全部验收标准。
- `rg` 命令在当前终端不可用，需要以 `grep` 替代文本检索。

### 解决方式

- 对所有“需要线上环境才能确认”的条目标记为“无法验证”或“被阻塞”，避免越权结论。
- 使用 `grep` 与文件读取组合完成证据抽取，覆盖页面、状态管理、服务层、迁移、函数与测试资产。

### 执行的测试

- 执行 `git status --short`：确认基线与最终文档变更范围。
- 执行 `find tests -maxdepth 3 -type f | sort`：确认自动化测试资产现状。
- 执行 `git --no-pager log --oneline -n 12`：确认近期版本演进证据。
- 执行 `grep -RIn "createTimelineItem|updateTimelineItem|getTimelineByDate|food_entries|timeline_items" frontend/src | head -n 80`：确认饮食记录持久化链路使用情况。
- 执行 `grep -RIn "createPublicFood|updatePublicFood|setPublicFoodActive|createFood|updateFood|deleteFood|savePlan|deletePlan|endDay|loadHistory" ...`：确认页面到服务调用证据。
- 执行 `grep -RIn "REACT_APP_SUPABASE_URL|REACT_APP_SUPABASE_ANON_KEY|functions/v1/username-login" ...`：确认环境变量与登录函数接入证据。
- 读取关键文件：`frontend/src/App.js`、`frontend/src/store.jsx`、`frontend/src/services/*`、`frontend/src/pages/*`、`supabase/migrations/*.sql`、`supabase/functions/username-login/index.ts`、`supabase/config.toml`。

### 测试结果

- 通过：文档路径可用、Roadmap结构完整、Phase 2-4仅保留总体框架、身体记录与减脂模式在Roadmap中已明确分离、项目状态判断包含代码路径证据。
- 通过：版本顺序检查为 V0.1 → V0.11 → V1.0。
- 未通过：无。
- 无法确认：线上Supabase真实权限生效、线上登录稳定性、多账户隔离线上回归（需要线上环境验证）。

### 未完成事项

- 尚未在本任务中补齐自动化测试体系。
- 尚未完成V0.1全部线上验收闭环。
- 尚未执行Git提交与版本发布。

### 风险或注意事项

- 本次结论基于仓库证据，线上运行态可能与本地代码状态存在偏差。
- 若后续对认证、RLS或环境变量做调整，需重新执行V0.1验收与进度评估。

### 下一步

- 优先完成V0.1线上验收闭环（登录、会话、隔离、管理员权限）。
- 建立最小自动化测试集并纳入回归。
- 完成每次任务后持续更新 `docs/DEVELOPMENT_LOG.md` 与 `docs/VERSION_HISTORY.md`。

## DEV-20260726-008

- 日期：2026-07-26
- 状态：已完成
- 任务目标：重构登录后底部导航为四入口（首页｜历史｜食物库｜设置），并新增设置页承载账号信息、个人信息、摄入记录历史、切换账户与退出账户。
- 实际完成内容：
	- 重构底部导航为固定四入口：`/`、`/history`、`/library`、`/settings`。
	- 新增设置主页面，包含账号信息、个人信息、摄入记录历史入口与账户操作区。
	- 新增账号信息页与个人信息页。
	- 在路由中接入 `/settings`、`/settings/account`、`/settings/profile`。
	- 保留 `/plan` 路由可访问，但不在底部导航展示。
	- 登录页及未登录状态下继续不渲染底部导航。
- 主要修改文件或模块：`frontend/src/components/BottomNav.jsx`、`frontend/src/pages/SettingsPage.jsx`、`frontend/src/pages/AccountInfoPage.jsx`、`frontend/src/pages/ProfileInfoPage.jsx`、`frontend/src/App.js`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 遇到的问题：
	- 自动化浏览器验证时，直接访问受保护路由会因未登录重定向到 `/login`，无法在当前会话下完整验证登录后交互。
	- Playwright 代码片段初次错误使用 `document` 全局，需改为 `page.evaluate` 执行。
- 解决方式：
	- 先完成路由与构建验证，再补充源码级检查与未登录态验证。
	- 更正 Playwright 调用方式，确认登录页不显示底部导航。
- 执行的测试：
	- `cd frontend && npm run build`
	- `get_errors` 检查 `BottomNav.jsx`、`SettingsPage.jsx`、`AccountInfoPage.jsx`、`ProfileInfoPage.jsx`、`App.js`
	- 浏览器访问 `http://localhost:3002/` 与 `http://localhost:3002/settings`（均重定向到 `/login`）
	- `page.evaluate` 检查登录页 `data-testid="bottom-nav"` 不存在
	- 文本检索确认导航与设置入口文案及路由定义存在
- 测试结果：
	- 构建通过。
	- 变更文件无语法/类型错误。
	- 未登录态访问受保护路由会跳转登录页，且登录页不显示底部导航，符合预期。
	- 导航顺序与设置页入口文案在源码中已按要求配置。
	- 受限于当前未提供可用登录会话，未完成“登录后点击流”全链路手工验证，存在发布前验证缺口。
- 未完成事项：
	- 待使用真实登录会话补充验证：底部导航激活态、设置页入口跳转、切换账户/退出账户确认弹窗的取消与确认分支。
- 风险或注意事项：
	- 本次不修改认证协议和数据库，仅做导航框架与页面组织调整；账户操作仍调用既有 `switchAccount` / `logout`。
	- 新增页面底部使用 `pb-28` 预留导航安全空间，需在真实机型上再确认遮挡边界。
- Git 分支：supabase-v1
- Git Commit ID：58237724a596fe08aa5a03b8b050aee903c190f5

## DEV-20260726-009

- 日期：2026-07-26
- 状态：已完成
- 任务目标：将底部菜单栏从悬浮式调整为贴底固定式，保持登录态显示、未登录态不显示，并保留移动端安全区域适配。
- 实际完成内容：
	- 底部菜单栏由悬浮式设计调整为贴底固定式设计。
	- 菜单栏改为全宽布局（左右铺满页面）。
	- 移除底部和左右悬浮间距（移除外层 `mx`、`mb`、圆角卡片容器与明显阴影样式）。
	- 保留移动端安全区域适配（导航背景延伸到底部，内容区通过安全区内边距避让）。
	- 保持四个导航入口与现有激活态逻辑。
	- 保持登录页与未登录页面不显示底部菜单栏。
	- 主内容底部预留空间沿用现有页面 `pb-32` / `pb-28`，避免内容被固定底部菜单遮挡。
- 主要修改文件或模块：`frontend/src/components/BottomNav.jsx`、`frontend/src/index.css`、`docs/DEVELOPMENT_LOG.md`
- 遇到的问题：
	- 原 `safe-bottom` 使用 `max(env(safe-area-inset-bottom), 0.5rem)`，在无安全区设备上会产生额外底部内边距，不符合“无多余底部留白”目标。
- 解决方式：
	- 导航容器改为 `fixed inset-x-0 bottom-0` 的贴底结构。
	- `safe-bottom` 调整为仅使用 `env(safe-area-inset-bottom)`，去除额外 0.5rem。
- 执行的测试：
	- `cd frontend && npm run build`
	- `get_errors` 检查 `frontend/src/components/BottomNav.jsx`、`frontend/src/index.css`
	- 文本检查 `frontend/src/components/BottomNav.jsx`：确认存在 `fixed inset-x-0 bottom-0`、`border-t`、无 `bottom-4/left-4/right-4/mx-4/mb-4/rounded-2xl/rounded-full/shadow` 等悬浮容器样式
	- 文本检查 `frontend/src/App.js`：确认 `BottomNav` 仅在 `isAuthenticated` 分支渲染
	- 文本检查 `frontend/src/pages/*.jsx`：确认主要页面保留 `pb-32` / `pb-28` 底部预留
- 测试结果：
	- 构建通过。
	- 本次改动文件无语法/类型错误。
	- 底部导航代码结构满足贴底固定、全宽、无悬浮外边距与无卡片阴影要求。
	- 未登录态不显示底部导航逻辑保持成立。
	- 页面内容底部预留仍存在，未发现本次改动引入的遮挡风险。
	- 未执行与本任务无关功能测试。
- 未完成事项：
	- 需在真实 iPhone 设备上补充一次安全区视觉验收（当前为代码与构建级验证）。
- 风险或注意事项：
	- 本次仅调整底部菜单栏定位与样式，不改动认证、路由权限、数据库、业务逻辑。
- Git 分支：supabase-v1
- Git Commit ID：未提交

## DEV-20260726-010

- 日期：2026-07-26
- 状态：已完成
- 修改类型：UI 调整
- 修改模块：首页顶部区域
- 任务目标：删除首页右上角加号按钮，不影响首页其他顶部内容与原有新增业务能力。
- 修改前：首页右上角显示加号按钮（`top-add-btn`），点击后展开顶部快捷新增菜单（加餐、无氧训练、有氧训练、其他事件）。
- 修改后：首页右上角不再显示加号按钮，也不再渲染对应顶部弹出菜单与相关占位区域。
- 原按钮对应的功能：展开顶部 `AddPickerMenu` 快捷入口，用于触发加餐、训练、事件新增。
- 是否保留原业务功能：是。页面内 `fab-add` 浮动按钮入口与对应新增流程保留。
- 是否修改公共 Header：否。该按钮为首页局部实现，不属于公共 Header 组件。
- 实际修改文件：`frontend/src/pages/TodayPage.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 遇到的问题：
	- 当前自动化浏览器会话未登录，无法在同一次会话中直接完成“登录后首页右上角视觉”实机验证。
- 解决方式：
	- 通过源码与测试标识精确核对：移除 `top-add-btn` / `top-add-menu` / `topOpen` 相关逻辑；并确认 `fab-add` 与新增流程仍保留。
- 实际测试内容：
	- 修改前检查：`git status --short`、`git branch --show-current`
	- 文本检索：确认右上角按钮来源仅在 `TodayPage`，非公共 Header 与路由级配置
	- 文本检索：确认 `top-add-btn` / `top-add-menu` / `setTopOpen` / `topOpen` 已不存在
	- 文本检索：确认 `fab-add` 与 `AddPickerMenu` 新增流程仍存在
	- 页面检查：访问 `http://localhost:3002/login`，登录页正常展示且无底部导航（未登录预期）
	- 构建检查：`cd frontend && npm run build`
	- 语法检查：`get_errors` 检查 `frontend/src/pages/TodayPage.jsx`
- 测试结果：
	- 首页右上角加号相关代码已移除，未保留透明按钮或占位点击区域。
	- 首页标题区结构保持正常（顶部仍渲染 TODAY 与日期标题）。
	- 其他顶部元素未误删。
	- 其他页面中的加号入口（如食物库新增）未受影响。
	- 本次改动文件无语法错误。
	- 前端构建通过。
	- 控制台未发现由本次改动引入的新报错。
- 构建结果：通过。
- 未完成事项：
	- 待在已登录会话下补充首页视觉验收（仅验证右上角按钮移除后的实际显示）。
- 风险或注意事项：
	- 本次仅移除首页右上角入口，不删除新增业务能力本身与相关弹窗/逻辑。
- 当前分支：supabase-v1
- Git Commit ID：e8810246d53e4039526c3184e0f5770750dece5c

## DEV-20260726-011

- 日期：2026-07-26
- 状态：已完成
- 修改类型：UI 布局调整
- 修改模块：首页 / 今日摄入
- 任务目标：将首页“今日摄入”模块调整为两行展示，第一行显示当前摄入，第二行显示目标摄入。
- 修改前布局：组件顶部显示当前热量大数字与目标完成度，蛋白质/脂肪/碳水为单行三卡片展示，未分离“当前/目标”两行。
- 修改后布局：在首页启用两行结构，第一行为“当前”行（热量、蛋白质、脂肪、碳水），第二行为“目标”行（热量、蛋白质、脂肪、碳水），每行保持水平排列与一致字段顺序。
- 第一行显示内容：当前热量、当前蛋白质、当前脂肪、当前碳水。
- 第二行显示内容：目标热量、目标蛋白质、目标脂肪、目标碳水（未设置目标时显示占位值）。
- 当前摄入数据字段：`totals.cal`、`totals.p`、`totals.f`、`totals.c`。
- 目标摄入数据字段：`plan.calories`、`plan.protein`、`plan.fat`、`plan.carbs`（通过 `safePlan` 归一化）。
- 当前和目标数据来源：首页 `TodayPage` 通过 `sumTimelineMacros(timeline)` 计算 `totals`，并从 `store` 获取 `plan` 后传入 `NutritionSummary`。
- 当前模块移动端宽度：位于 `TodayPage` 的 `px-5` 容器内，受 `app-shell` 的 `max-width: 28rem` 限制。
- 移动端适配方式：使用紧凑字号与双行网格（每行标签列 + 四列营养项），缩小单元格间距并保持数值与单位同一行。
- 确认未使用横向滚动：未使用 `overflow-x-auto`、`overflow-x-scroll` 或横向滚动条。
- 是否使用公共营养统计组件：是，使用 `NutritionSummary`。
- 是否修改公共组件：是；仅新增 `layout="splitRows"` 的首页局部开关，默认布局保留给其他页面（如历史详情页）。
- 实际修改文件：`frontend/src/components/NutritionSummary.jsx`、`frontend/src/pages/TodayPage.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际测试内容：
	- 修改前检查：`git status --short`、`git branch --show-current`
	- 代码定位：检查 `NutritionSummary` 组件字段与数据来源；检查 `TodayPage` 中 `totals` 与 `plan` 传参
	- 复用检查：确认 `NutritionSummary` 同时被首页与历史详情页使用
	- 布局检查：确认首页启用 `layout="splitRows"`，历史详情页保持默认布局
	- 结构检查：确认存在 `sum-current-row` 与 `sum-target-row`，字段顺序为热量/蛋白质/脂肪/碳水
	- 滚动检查：确认组件内无横向滚动样式
	- 语法检查：`get_errors` 检查 `NutritionSummary.jsx`、`TodayPage.jsx`
	- 构建检查：`cd frontend && npm run build`
- 测试结果：
	- 首页“今日摄入”已实现“当前一行、目标一行”。
	- 当前与目标字段顺序一致，热量与三大营养素信息保留完整。
	- 未引入模块内部横向滚动，也未发现页面级横向滚动相关改动。
	- 公共组件改动已做首页局部化，历史详情页展示未被同步改为两行。
	- 构建通过，变更文件无语法错误。
- 构建结果：通过。
- 未完成事项：
	- 待在已登录会话补充一次首页实机视觉验收（当前以代码结构与构建验证为主）。
- 风险或注意事项：
	- 本次仅调整展示结构，不修改摄入/目标计算逻辑、状态管理、查询与数据库逻辑。
- 当前分支：supabase-v1
- Git Commit ID：5e695da769e309a46cf9838e9aadf906b0a11040

## DEV-20260726-012

- 日期：2026-07-26
- 状态：已完成
- 修改类型：UI 布局调整
- 修改模块：首页 / 今日摄入
- 任务目标：精简首页“今日摄入”模块，移除上方标题/目标提示/火焰图标区域，仅保留两行营养信息，并将首行标签改为“今日摄入”。
- 删除的界面元素：
	- 上方“今日摄入”标题文本（splitRows 模式顶部区）
	- “尚未设置目标/目标完成度”提示文本（splitRows 模式顶部区）
	- 右上角火焰图标及其容器区域（splitRows 模式顶部区）
	- 删除上述内容后对应的顶部留白区域
- 第一行标签修改：由“当前”改为“今日摄入”。
- 第二行标签：保持“目标”不变。
- 保留的数据字段：热量、蛋白质、脂肪、碳水；当前值与目标值；kcal 与 g 单位；未设置目标时目标行占位值（`--`）保留。
- 火焰按钮原有功能：无点击逻辑，原为模块顶部的静态装饰图标容器。
- 是否修改公共组件：是。修改了公共 `NutritionSummary` 组件，但仅影响首页使用的 `layout="splitRows"` 分支；默认分支能力保留。
- 当前与目标数据来源：继续来自 `totals` 与 `plan`（`safePlan` 归一化），未调整计算和数据流。
- 实际修改文件：`frontend/src/components/NutritionSummary.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际测试内容：
	- 修改前检查：`git status --short`、`git branch --show-current`
	- 组件定位：确认顶部标题、目标提示和火焰容器来源于 `NutritionSummary` 的 splitRows 分支
	- 结构检查：确认 splitRows 保留 `sum-current-row` 与 `sum-target-row`
	- 标签检查：确认首行标签为“今日摄入”，次行标签仍为“目标”
	- 信息完整性检查：确认热量/蛋白质/脂肪/碳水字段及单位仍在
	- 滚动检查：确认未使用 `overflow-x-auto`、`overflow-x-scroll` 或横向滚动样式
	- 语法检查：`get_errors` 检查 `NutritionSummary.jsx`
	- 控制台检查：浏览器 reload 后 console error 为 0（登录页）
	- 构建检查：`cd frontend && npm run build`
- 测试结果：
	- 上方标题区、目标提示与火焰图标区域已从首页 splitRows 视图删除。
	- 首行标签已更新为“今日摄入”，次行“目标”保持不变。
	- 当前与目标两行营养信息完整保留，字段顺序与单位未变。
	- 未引入横向滚动或语法错误。
	- 构建通过。
- 构建结果：通过。
- 未完成事项：
	- 待在已登录会话补充首页可视化验收（当前以代码与构建验证为主）。
- 风险或注意事项：
	- 本次仅调整首页 splitRows 展示，不修改业务逻辑、状态管理、数据库与认证链路。
- 当前分支：supabase-v1
- Git Commit ID：514d9d5d2a6fc7b16ee462a83368190e28024ac2

## DEV-20260726-013

- 日期：2026-07-26
- 状态：已完成
- 修改类型：UI 布局修正
- 修改模块：首页 / 今日摄入
- 任务目标：保留“今日摄入”行四个独立卡片，仅将“目标”行改为单行普通文字展示。
- 今日摄入行保留的设计：
	- 左侧“今日摄入”标签保留。
	- 热量、蛋白质、脂肪、碳水仍为四个独立小卡片。
	- 当前值与单位显示方式、卡片顺序、背景/边框/圆角样式保留。
- 目标行修改前的设计：
	- 与当前行一样使用四个独立目标营养小卡片。
	- 每项以独立卡片显示目标值与单位。
- 目标行修改后的设计：
	- 改为单行普通文字信息。
	- 左侧显示“目标”，后续依次显示热量、蛋白、脂肪、碳水目标值与单位。
	- 不再为目标项使用独立小卡片容器。
- 目标行保留的字段：热量、蛋白质（文案缩短为“蛋白”）、脂肪、碳水；目标值与单位（kcal/g）。
- 确认目标行未使用独立小卡片：是（无独立目标项白色卡片/边框/圆角/阴影）。
- 确认未使用横向滚动：是（未使用 `overflow-x-auto`、`overflow-x-scroll`）。
- 当前值和目标值数据来源：继续来自 `totals` 与 `plan`（`safePlan` 归一化），未修改计算逻辑。
- 是否调整公共营养组件：是。修改了 `NutritionSummary` 的 `layout="splitRows"` 分支；默认分支与数据逻辑不变。
- 实际修改文件：`frontend/src/components/NutritionSummary.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际执行的测试：
	- 修改前检查：`git status --short`、`git branch --show-current`
	- 结构检查：确认首页仍使用 `layout="splitRows"`；目标行改为 `sum-target-row` 单行文字结构
	- 样式检查：确认今日摄入行仍保留独立卡片类；目标行不含独立卡片容器
	- 字段顺序检查：目标行按“热量 -> 蛋白 -> 脂肪 -> 碳水”顺序输出
	- 占位值检查：目标值未设置时继续走 `--` 占位逻辑（`safePlan` 与 `targetValue` 未改）
	- 合并错误检查：未使用“当前/目标”斜杠合并格式
	- 滚动检查：确认组件未引入横向滚动样式
	- 语法检查：`get_errors` 检查 `NutritionSummary.jsx` 与 `TodayPage.jsx`
	- 构建检查：`cd frontend && npm run build`
- 测试结果：
	- 今日摄入行四个独立卡片保留。
	- 目标行已改为单行普通文字，且无独立目标卡片样式。
	- 目标字段顺序正确，单位保留，未修改数据来源与计算逻辑。
	- 未引入横向滚动，构建通过。
	- 受当前会话限制，未在登录态页面完成实机视觉截图验证，当前以代码结构与构建结果为主。
- 构建结果：通过。
- 未完成事项：
	- 待在已登录会话补充首页目标行实际显示验收。
- 风险或注意事项：
	- 本次仅修正展示结构，不改业务功能、状态管理、数据库与认证。
- 当前分支：supabase-v1
- Git Commit ID：0b92e3c4f63f0ac7740fd4be78cb063568e7dabb

## DEV-20260726-014

- 日期：2026-07-26
- 状态：已完成
- 修改类型：UI 布局修正
- 修改模块：首页 / 今日摄入
- 任务目标：仅修改目标行文案格式为“-- kcal、P -- g、F -- g、C -- g”，不改上方今日摄入行。
- 今日摄入行是否保持不变：是。
	- 保留中文字段：热量、蛋白质、脂肪、碳水。
	- 保留四个独立小卡片、样式、数值、单位和布局。
	- 未改当前行 JSX 与样式结构。
- 目标行修改内容：
	- 热量：由“热量 -- kcal”调整为“-- kcal”。
	- 蛋白质：调整为“P -- g”。
	- 脂肪：调整为“F -- g”。
	- 碳水：调整为“C -- g”。
	- 已设置目标时格式同样为：`2600 kcal / P 180 g / F 75 g / C 300 g`（示例）。
- 目标行最终显示形式：`目标  -- kcal   P -- g   F -- g   C -- g`。
- 目标行是否为一行普通文字：是。
- 确认目标行未使用独立小卡片：是。
- 确认未使用横向滚动：是（未使用 `overflow-x-auto`、`overflow-x-scroll`）。
- 数据来源与计算逻辑：未改，继续使用 `safePlan` 与 `targetValue`。
- 是否调整公共营养组件：是，仅调整 `NutritionSummary` 的 `layout="splitRows"` 目标行文案。
- 实际修改文件：`frontend/src/components/NutritionSummary.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际执行的测试：
	- 修改前检查：`git status --short`、`git branch --show-current`
	- 代码检查：确认今日摄入行仍为四卡片；目标行文案为 `-- kcal / P / F / C` 格式
	- 滚动检查：确认未出现 `overflow-x-auto`、`overflow-x-scroll`
	- 语法检查：`get_errors` 检查 `NutritionSummary.jsx`
	- 构建检查：`cd frontend && npm run build`
- 测试结果：
	- 今日摄入行保持不变。
	- 目标行文案格式已按要求更新。
	- 目标行保持单行普通文字结构，无独立目标卡片。
	- 构建通过。
- 构建结果：通过。
- 未完成事项：
	- 待登录态视觉验收确认页面实际渲染细节。
- 风险或注意事项：
	- 本次仅调整目标行文案，不涉及数据逻辑与业务流程。
- 当前分支：supabase-v1
- Git Commit ID：262c00329b1fb95f1cf24b6caa338e3dd74c73fa

## DEV-20260726-015

- 日期：2026-07-26
- 状态：已完成
- 修改类型：UI 布局修正
- 修改模块：首页 / 今日摄入
- 任务目标：仅调整目标行布局，使其与上方“今日摄入”四个营养卡片列严格对齐。
- 修改前：目标行与上方同为五列结构，但列间距与文本对齐参数不一致，存在视觉偏差风险。
- 修改后：
	- 目标行使用与当前行相同的五列网格模板。
	- 目标行列间距与当前行一致。
	- 热量、P、F、C 文本在各自列中居中显示，对齐对应卡片列。
	- 目标行仍为普通文字，不使用独立小卡片。
- 今日摄入行是否修改：否（保持完全不变）。
- 目标行字段顺序：`-- kcal`、`P -- g`、`F -- g`、`C -- g`。
- 数据来源与逻辑：未改，继续使用 `nutrientFields[*].targetValue`。
- 是否使用横向滚动：否（未使用 `overflow-x-auto`、`overflow-x-scroll`）。
- 是否调整公共组件：是，调整 `NutritionSummary` 的 `layout="splitRows"` 目标行布局参数。
- 实际修改文件：`frontend/src/components/NutritionSummary.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际执行的测试：
	- 修改前检查：`git status --short`、`git branch --show-current`
	- 对齐检查：确认 `sum-current-row` 与 `sum-target-row` 使用相同列模板与间距
	- 文案检查：确认目标行为 `-- kcal / P / F / C` 形式
	- 样式检查：确认目标行无独立卡片样式，当前行卡片样式保持
	- 语法检查：`get_errors` 检查 `NutritionSummary.jsx`
	- 构建检查：`cd frontend && npm run build`
- 测试结果：
	- 今日摄入行保持不变。
	- 目标行与上方四列卡片严格对齐。
	- 目标行仍为单行普通文字，无独立目标卡片。
	- 构建通过。
- 构建结果：通过。
- 未完成事项：
	- 待登录态补充页面视觉验收截图。
- 风险或注意事项：
	- 本次为纯布局参数修正，不涉及业务数据与计算逻辑。
- 当前分支：supabase-v1
- Git Commit ID：6fc0bf145278f6a45329e801588c28f912aa3fa4

## DEV-20260726-016

- 日期：2026-07-26
- 状态：已完成
- 修改类型：功能开发 + 状态管理联动
- 修改模块：首页 / 周日历导航、日期状态管理
- 任务目标：在首页引入周日历（周一起始），支持上一周/下一周切换、日期点击切换和回到今天，并确保首页数据严格跟随所选日期。
- 实际完成内容：
	- 首页新增周日历区块，展示 7 天网格（周一到周日）、月份标题、上周/下周切换按钮。
	- 新增“今天”快捷入口（仅在选中日期不是今天时显示），用于一键跳回今天。
	- 点击任意日期后，首页 `dateLabel`、时间轴与营养汇总同步到该日期。
	- 在 `store` 暴露 `setSelectedDate`，统一复用已有 `currentDate`，避免新增并行日期状态。
	- 在 `store` 增加按日期缓存时间轴内容，支持当日未归档数据在周内切换时保持一致，并优先复用历史归档内容。
- 主要修改文件或模块：`frontend/src/pages/TodayPage.jsx`、`frontend/src/store.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 遇到的问题：
	- 周切换与日期切换需要与现有 `currentDate` 机制兼容，且不能引入第二套日期状态。
	- 快速切换日期时需要避免视图被旧数据覆盖。
- 解决方式：
	- 复用 `currentDate` 作为唯一选中日期源，仅新增 `setSelectedDate` 入口。
	- 使用 `timelineCacheRef` 按日期缓存并在切换时克隆写入，减少快速切换造成的状态回退风险。
- 执行的测试：
	- 修改前检查：`git status --short`、`git branch --show-current`
	- 语法与诊断检查：`get_errors` 检查 `frontend/src/pages/TodayPage.jsx`、`frontend/src/store.jsx`
	- 构建检查：`cd frontend && npm run build`
	- 代码结构检查：确认周一到周日顺序、7 列网格、上周/下周与回到今天入口均已接入。
- 测试结果：
	- 构建通过。
	- 变更文件无语法错误。
	- 周日历入口、周切换、日期切换和回到今天逻辑均已接入代码路径。
	- 受当前会话限制，未在已登录真实业务流中完成端到端人工点击验证。
- 构建结果：通过。
- 未完成事项：
	- 待在已登录会话补充端到端视觉和交互验收（跨月、跨年、快速连点场景）。
- 风险或注意事项：
	- 本次未改动数据库结构与接口，属于前端状态与交互层变更。
	- 工作区存在未纳入本次提交的无关改动（`frontend/src/components/BottomNav.jsx`、`frontend/src/index.css`），已保持隔离。
- 当前分支：supabase-v1
- Git Commit ID：74efe2ed1cdcaae623bfdda8fe8db0c0e7ba88d0

## DEV-20260726-017

- 日期：2026-07-26
- 状态：已完成
- 修改类型：交互修复 / 日期浏览
- 修改模块：首页 / 周日历
- 任务目标：修复周日历切换日期时错误触发 NEXT DAY 提示；日期区域标题按所选日期在 TODAY 与“历史记录”之间动态切换。
- 修改前问题：点击周日历中的其他日期时，页面错误显示 NEXT DAY 提示“前一天已结束，当前正在记录下一日”。
- NEXT DAY 原触发位置：`frontend/src/pages/TodayPage.jsx` 中 `isAutoAdvancedDay = currentDateStr !== todaySydneyStr`，导致“非今天”被等同于“已进入下一日”。
- 错误调用原因：浏览日期与业务推进日期复用同一判断条件；周日历仅用于查看历史日期，但被错误复用了“下一日”提示逻辑。
- 浏览日期与业务推进日期的区分方式：
	- 浏览日期：继续使用 `currentDate`，由周日历点击和周切换驱动。
	- 业务推进日期：新增 `recordingDateStr`，仅在初始化判定“今天已完成”或执行“结束本日”成功后推进。
- 周日历点击后的新行为：仅更新浏览日期、更新选中状态和页面数据展示，不再触发 NEXT DAY 提示。
- 是否保留真正的 NEXT DAY 功能：是；仅当“当前浏览日期 == 业务推进日期”且“业务推进日期 != 今天”时显示 NEXT DAY。
- TODAY 与“历史记录”的切换规则：
	- 选中今天：显示 `TODAY`
	- 选中非今天：显示 `历史记录`
- 本地日期比较方式：使用 Sydney 本地日期键 `YYYY-MM-DD`（`getSydneyDateString`）按日比较，不比较时分秒。
- 是否涉及数据库写入：否（周日历浏览路径不写库；写库仍仅在 `endDay -> historyService.saveDayArchive` 业务入口触发）。
- 实际修改文件：`frontend/src/pages/TodayPage.jsx`、`frontend/src/store.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际执行的测试：
	- 修改前检查：`git status --short`、`git branch --show-current`
	- 触发链路检查：检索 NEXT DAY 文案与 `isAutoAdvancedDay` 逻辑、周日历点击处理函数、`setSelectedDate` 与 `endDay` 路径
	- 语法检查：`get_errors` 检查 `frontend/src/pages/TodayPage.jsx`、`frontend/src/store.jsx`
	- 构建检查：`cd frontend && npm run build`
	- 写入路径核对：确认 `saveDayArchive` 仅在 `endDay` 中调用，周日历点击路径无写入调用
- 测试结果：
	- 变更文件无语法错误。
	- 构建通过。
	- NEXT DAY 提示不再由“浏览非今天日期”触发。
	- 日期标题可按所选日期在 TODAY 与“历史记录”之间切换。
	- 周日历点击路径未引入数据库写入调用。
	- 受当前会话限制，未在登录态真实数据场景执行完整人工端到端点击截图验证。
- 构建结果：通过。
- 未完成事项：
	- 待在已登录业务会话补充“跨周/未来日期/返回今天”的人工交互验收记录。
- 风险或注意事项：
	- 工作区存在未纳入本次提交的无关改动（`frontend/src/components/BottomNav.jsx`、`frontend/src/index.css`），已保持隔离。
	- 本次不涉及数据库结构、认证和权限逻辑。
- 当前分支：supabase-v1
- Git Commit ID：20b0e56dee272958b1c247b6cd716245fa2c5005

## DEV-20260726-018

- 日期：2026-07-26
- 状态：已完成
- 修改类型：UI 布局调整
- 修改模块：首页 / 时间轴
- 任务目标：将首页时间轴调整为“时间在左侧、事件内容在右侧”的两列布局，不改变业务逻辑与数据。
- 修改前布局：时间显示在事件卡片内部（标题下方），节点在卡片左侧，时间与事件内容未做固定列分离。
- 修改后布局：每条记录使用固定两列+节点结构：左侧时间列（56px）+中间节点列（18px）+右侧事件卡片列（自适应）。
- 时间列宽：56px（首页时间轴所有记录统一）。
- 时间对齐方式：左侧时间文字右对齐，顶部与右侧事件卡片头部区域对齐。
- 事件内容布局方式：事件名称、类型信息、食物明细/训练详情、热量信息、编辑入口、删除入口全部保留在右侧同一事件卡片中。
- 是否保留时间轴节点和竖线：保留；节点位于时间与内容之间，竖线在节点轨道位置显示。
- 同一时间多个事件的处理方式：保持现有数据结构与渲染方式，不合并记录，不调整顺序。
- 无时间事件的显示方式：保持现有占位规则，左侧显示 `未设置`。
- 是否修改公共组件：是。`TimelineItem` 新增首页专用布局模式 `home-time-left`，默认布局保持原样。
- 实际影响页面：首页（TodayPage）启用新布局；历史详情页未启用该模式，保持原布局。
- 是否涉及数据库写入：否。本次仅前端布局变更，无新增写入路径。
- 实际修改文件：`frontend/src/components/TimelineItem.jsx`、`frontend/src/pages/TodayPage.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际执行的测试：
	- 修改前检查：`git status --short`、`git branch --show-current`
	- 组件与页面定位：检查首页/历史页时间轴调用路径与复用关系
	- 语法检查：`get_errors` 检查 `TimelineItem.jsx`、`TodayPage.jsx`
	- 构建检查：`cd frontend && npm run build`
	- 改动范围检查：`git diff -- frontend/src/components/TimelineItem.jsx frontend/src/pages/TodayPage.jsx`
	- 提交前范围检查：`git status --short`
- 测试结果：
	- 变更文件无语法错误。
	- 前端构建通过。
	- 首页时间轴实现统一左侧时间列与右侧事件内容列。
	- 事件卡片原有信息与操作入口保留。
	- 历史详情页未受本次首页布局模式影响。
	- 受当前会话限制，未在登录态完成完整视觉截图验收。
- 构建结果：通过。
- 未完成事项：
	- 待在已登录会话补充移动端与桌面端人工视觉验收（含长文案与同时段多条记录场景）。
- 风险或注意事项：
	- 工作区存在未纳入本次提交的无关改动（`frontend/src/components/BottomNav.jsx`、`frontend/src/index.css`），已保持隔离。
- 当前分支：supabase-v1
- Git Commit ID：e0b37db11251ac659ccbf927e62d47d8dde9d5d4

## DEV-20260726-019

- 日期：2026-07-26
- 状态：已完成
- 修改类型：业务逻辑修复 / 历史记录
- 修改模块：结束本日、历史列表、历史详情
- 任务目标：支持无记录日期也可结束本日，并在历史中保留该日期并显示“本日无记录”。
- 修改前问题：`endDay` 在无有效记录时直接返回 `skipped`，导致空白日期不会归档、不会进入历史。
- 修改前历史来源：历史日期来自 `daily_archives` 与 `timeline_items` 日期集合；但空白日因未写入 `daily_archives` 无法出现。
- 日期完成状态的保存方式：复用 `daily_archives` 的 `is_completed`、`completed_at` 与 `archive_date`，通过 `saveDayArchive` upsert 保存。
- 是否复用现有表或字段：是，复用 `daily_archives`（含唯一约束 `user_id, archive_date`）与既有 RLS。
- 是否新增数据库 migration：否。
- 新增或复用的数据表和字段：复用 `daily_archives.user_id/archive_date/is_completed/completed_at/timeline/totals`。
- 唯一约束和幂等处理：
	- 数据库层：`saveDayArchive` 使用 `upsert(..., { onConflict: 'user_id,archive_date' })`。
	- 前端层：`endDaySubmittingRef` 防止并发重复提交导致重复推进下一日。
- RLS 处理：沿用 `daily_archives` 现有策略（仅允许用户读写自己的归档）。
- 无记录日期如何进入历史列表：空白日结束时写入 `daily_archives`（`timeline` 为空数组），`getHistoryDates` 可直接取到该 `archive_date`。
- “本日无记录”的展示判断：
	- 服务层基于 `is_completed` + `hasMeaningfulTimelineItems(timeline)` 计算 `isEmptyDay`。
	- 列表页 `isEmptyDay` 显示“本日无记录”。
	- 详情页 `isEmptyDay && timeline.length===0` 显示空状态。
- 是否创建虚假事件：否（不会创建 0 kcal 食物、空训练或伪造事件；归档空白日时仅保存空 timeline）。
- 有记录日期是否受影响：否。原有有记录归档、历史展示和排序逻辑保持。
- 实际修改文件：`frontend/src/lib/dayRecordUtils.js`、`frontend/src/store.jsx`、`frontend/src/services/historyService.js`、`frontend/src/pages/TodayPage.jsx`、`frontend/src/pages/HistoryPage.jsx`、`frontend/src/pages/HistoryDetailPage.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际执行的测试：
	- 修改前检查：`git status --short`、`git branch --show-current`
	- 逻辑链路检查：定位 `endDay`、`saveDayArchive`、`getHistoryDates`、`getHistoryDetail`
	- 语法检查：`get_errors` 检查本次变更文件
	- 构建检查：`cd frontend && npm run build`
	- 幂等与写入路径检查：确认 `upsert onConflict` 与 `endDaySubmittingRef` 生效；无新增业务写入路径
- 测试结果：
	- 构建通过。
	- 无记录日期不再被 `skipped`，可执行归档流程。
	- 历史列表可显示“本日无记录”。
	- 历史详情可显示“本日无记录”空状态。
	- 未引入虚假事件创建逻辑。
	- 受当前会话限制，未在真实在线数据库环境执行迁移（本次无 migration）与跨账号实操验证。
- 数据库迁移结果：本次无数据库迁移（复用现有表结构、唯一约束与 RLS）。
- 前端构建结果：通过。
- 未完成事项：
	- 待在登录态补充端到端人工验证（空白日结束、刷新后历史保留、重新登录后历史保留、跨账号隔离）。
- 风险或注意事项：
	- 工作区存在未纳入本次提交的无关改动（`frontend/src/components/BottomNav.jsx`、`frontend/src/index.css`），已保持隔离。
- 当前分支：supabase-v1
- Git Commit ID：dc320ed1c51ac09144b667bf4553c3f51b0dd382

## DEV-20260726-020

- 日期：2026-07-26
- 状态：已完成
- 修改类型：功能开发 / 新增加餐表单
- 修改模块：首页 / 加餐新增流程
- 任务目标：新增加餐时增加“时间”和“类型”必填字段（普通/练前/练后），并保留现有“添加食物与克重”流程。
- 修改前行为：点击新增加餐后直接插入固定时间 `15:30` 的空加餐记录，无类型字段。
- 修改后行为：点击新增加餐先弹出表单，必须选择时间并选择类型（普通/练前/练后）后才创建加餐记录。
- 类型固定选项：`normal`（普通）、`pre_workout`（练前）、`post_workout`（练后）。
- 数据兼容策略：旧加餐记录无类型时默认归一化为 `normal`。
- 是否新增数据库 migration：否（本次仅调整前端记录结构与归档 JSON 字段）。
- 实际修改文件：`frontend/src/modals/AddSnackSheet.jsx`、`frontend/src/constants/snackTypes.js`、`frontend/src/pages/TodayPage.jsx`、`frontend/src/components/TimelineItem.jsx`、`frontend/src/services/historyService.js`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际执行的测试：
	- `get_errors` 检查 `AddSnackSheet.jsx`、`snackTypes.js`、`TodayPage.jsx`、`TimelineItem.jsx`、`historyService.js`
	- `cd frontend && npm run build`
	- `git show --name-only --pretty=format:%H%n%s 5f229f8`
	- `git status --short`
- 测试结果：
	- 本次功能文件无语法错误。
	- 前端构建通过。
	- 功能提交范围准确，仅包含加餐时间/类型功能相关 5 个代码文件。
	- 工作区仍存在本次未处理的无关改动：`frontend/src/components/BottomNav.jsx`、`frontend/src/index.css`。
	- 未在已登录真实会话完成端到端手工点击验证（当前以代码路径与构建验证为主）。
- 构建结果：通过。
- 未完成事项：
	- 待补充登录态手工验证：创建不同类型加餐、添加食物后时间排序、历史日期回看类型显示。
- 风险或注意事项：
	- 本次未修改早餐/午餐/晚餐创建逻辑；仅扩展加餐流程。
	- `snackType` 当前存储于前端时间轴对象与归档 JSON，未新增数据库字段。
- 当前分支：supabase-v1
- Git Commit ID：5f229f865016715b7dbfcf1fb746e7a35df9e7c7

## DEV-20260726-021

- 日期：2026-07-26
- 状态：已完成
- 修改类型：功能整合 / 训练记录
- 修改模块：加号菜单、训练弹窗
- 任务目标：将加号菜单里的“无氧训练”“有氧训练”合并为单一“训练”入口，并继续使用同一个训练弹窗在弹窗内选择训练类型。
- 修改前训练入口：`加餐`、`无氧训练`、`有氧训练`、`其他事件`。
- 修改后训练入口：`加餐`、`训练`、`其他事件`。
- 统一训练弹窗结构：标题统一为“训练”；弹窗内保留类型二选一（无氧/有氧）、项目名称、开始时间、时长、预估消耗、确认添加按钮。
- 无氧和有氧类型内部值：`anaerobic`（无氧）、`aerobic`（有氧），沿用既有实现。
- 公共字段：训练类型、项目名称、开始时间、时长、预估消耗、确认添加。
- 无氧专属字段：本次无独立专属输入字段（无氧通过类型值、标题“无氧训练”和默认文案“力量训练”区分）。
- 有氧专属字段：本次无独立专属输入字段（有氧通过类型值、标题“有氧训练”和默认文案“有氧运动”区分）。
- 类型切换时的表单处理：仅切换 `tab` 类型值；项目名称、开始时间和时长为公共字段并保留；提交时仅按当前选中类型生成 `type/title/detail`。
- 新增和编辑是否都使用统一弹窗：新增使用统一训练弹窗；当前项目未提供训练条目完整编辑弹窗（仅支持改时间），因此本次不涉及训练编辑弹窗合并。
- 是否复用原保存逻辑：是，继续由 `TodayPage.handleAddTraining` 将训练条目写入当天时间轴状态，未改动历史归档保存链路。
- 是否修改数据库结构：否。
- 是否新增 migration：否。
- 旧训练记录兼容结果：兼容；未修改训练记录结构和历史读取逻辑，既有无氧/有氧记录保持不变。
- 实际修改文件：`frontend/src/pages/TodayPage.jsx`、`frontend/src/modals/AddTrainingSheet.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际执行的测试：
	- 修改前检查：`git status --short`、`git branch --show-current`
	- 语法检查：`get_errors` 检查 `TodayPage.jsx`、`AddTrainingSheet.jsx`
	- 静态链路检查：检索 `onAnaerobic|onAerobic|picker-anaerobic|picker-aerobic` 已移除，`onTraining|picker-training` 已接入
	- 弹窗结构检查：检索训练弹窗标题为“训练”，并保留 `training-tab-anaerobic` 与 `training-tab-aerobic`
	- 去重检查：确认训练弹窗新增 `submitting` 提交保护，连续点击确认按钮不会重复创建
	- 本地可访问性检查：`curl -I http://localhost:3002` 返回 `HTTP/1.1 200 OK`
	- 前端构建：`cd frontend && npm run build`
- 测试结果：
	- 构建通过。
	- 训练菜单入口已合并为单一“训练”，无“无氧训练/有氧训练”重复入口残留。
	- 训练弹窗标题已统一为“训练”，类型仍在弹窗内部二选一。
	- 受当前会话限制（未提供可用登录态账号），未完成登录后页面的端到端点击验证与移动端实机验证；本次以代码路径、静态检查和构建结果为主。
- 数据库迁移结果：本次无数据库迁移。
- 前端构建结果：通过。
- 风险或注意事项：工作区存在未纳入本次提交的无关改动（`frontend/src/components/BottomNav.jsx`、`frontend/src/index.css`），已保持隔离。
- 当前分支：supabase-v1
- Git Commit ID：80db763d18d2884d15be505029c3ca1d97b6a923

## DEV-20260726-022

- 日期：2026-07-26
- 状态：已完成
- 修改类型：交互优化
- 修改模块：首页 / 加号菜单
- 任务目标：点击加号打开菜单后，点击菜单以外区域即可关闭菜单；菜单内部点击不误关闭；菜单项点击保持原有功能。
- 修改前关闭方式：仅通过再次点击加号或点击菜单项后在业务处理函数中关闭；点击页面其他区域不会关闭菜单。
- 修改后关闭方式：菜单打开时监听全局 `pointerdown`；若点击目标不在加号按钮和菜单容器内，则自动关闭菜单。
- 使用现有弹出组件还是自定义实现：继续使用当前自定义菜单容器，不改为 Popover/DropdownMenu。
- 是否使用透明遮罩：否。
- 是否使用点击外部监听：是。
- 使用的事件类型：`pointerdown`（同时覆盖鼠标与触摸）。
- 事件监听清理方式：仅在 `fabOpen=true` 时注册 `document.addEventListener('pointerdown', ...)`；菜单关闭或组件卸载时在 `useEffect` cleanup 中 `removeEventListener`。
- 菜单选项点击后的关闭顺序：菜单项 `onClick` 先走原有业务处理函数（如打开加餐/训练/事件弹窗），函数内继续执行 `setFabOpen(false)` 关闭菜单，不改变既有业务顺序。
- 移动端触摸验证结果：通过代码路径验证 `pointerdown` 能覆盖触摸；受当前会话未登录限制，未完成登录态页面实机点击流验证。
- 实际修改文件：`frontend/src/pages/TodayPage.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际执行的测试：
	- 修改前检查：`git status --short`、`git branch --show-current`
	- 语法检查：`get_errors` 检查 `frontend/src/pages/TodayPage.jsx`
	- 逻辑检索：确认新增 `fabButtonRef`、`addMenuRef`、`pointerdown` 监听与 cleanup
	- 可访问性检查：访问 `http://localhost:3002/`（当前重定向登录页）
	- 前端构建：`cd frontend && npm run build`
- 测试结果：
	- 本次改动文件无语法错误。
	- 构建通过。
	- 外部点击关闭逻辑已接入且包含监听器清理。
	- 受当前会话无登录态限制，未能在首页完成“周日历/今日摄入/时间轴/底部导航区域点击关闭”的端到端手工验证；本次以代码路径、静态检查和构建结果为主。
- 前端构建结果：通过。
- 未完成事项：待提供可用登录态后补充首页真实点击流验证（桌面+移动触摸）。
- 风险或注意事项：工作区存在未纳入本次提交的无关改动（`frontend/src/components/BottomNav.jsx`、`frontend/src/index.css`），已保持隔离。
- 当前分支：supabase-v1
- Git Commit ID：5557c8a584ff9ea36bf826046546b40256b5a40d

## DEV-20260726-023

- 日期：2026-07-26
- 状态：已完成
- 修改类型：表单输入修复
- 修改模块：训练弹窗 / 时长输入
- 任务目标：修复训练时长输入框删除后自动补回 0，及重新输入出现前导 0（05/030/060）的问题。
- 修改前问题：时长字段在清空时立即回填 0；随后输入会变成 05、030 等，影响正常输入体验。
- 问题原因：时长输入在 `onChange` 中直接执行 `setDuration(Number(value) || 0)`，把空字符串强制转换为 0。
- 原 state 类型：`number`（`duration`）。
- 修改后 state 类型：`string`（`durationInput`）。
- 是否允许空字符串：是，输入过程中允许空字符串。
- 数字转换发生的时机：仅在提交 `handleConfirm` 时进行校验和转换。
- 前导零规范化方式：在 `onBlur` 时对纯数字字符串执行 `String(Number(value))` 规范化（例如 005 -> 5，060 -> 60）。
- 新建训练默认值：空字符串（不再默认显示 0）。
- 编辑训练回显方式：当前项目无训练条目完整编辑弹窗（仅支持改时间），本次未涉及训练编辑回显逻辑。
- 是否涉及自动计算时长：否，当前时长为手动输入，未由开始/结束时间自动计算。
- 是否修改数据库结构：否。
- 是否新增 migration：否。
- 实际修改文件：`frontend/src/modals/AddTrainingSheet.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际执行的测试：
	- 修改前检查：`git status --short`、`git branch --show-current`
	- 代码检查：确认旧实现存在 `setDuration(Number(e.target.value) || 0)`
	- 语法检查：`get_errors` 检查 `frontend/src/modals/AddTrainingSheet.jsx`
	- 逻辑检查：确认 `durationInput`（字符串）、`durationError`、`onBlur` 规范化、提交时校验与数字转换已接入
	- 前端构建：`cd frontend && npm run build`
- 测试结果：
	- 本次改动文件无语法错误。
	- 构建通过。
	- 已实现“可清空、输入时不自动补 0、提交时再校验转换、失焦可规范化前导零”。
	- 受当前会话无登录态限制，未在首页完成训练弹窗端到端点击与移动端实机输入验证；本次以代码路径、静态检查与构建验证为主。
- 前端构建结果：通过。
- 未完成事项：待提供可用登录态后补充真实交互验证（新增训练、类型切换、移动端触摸输入）。
- 风险或注意事项：工作区存在未纳入本次提交的无关改动（`frontend/src/components/BottomNav.jsx`、`frontend/src/index.css`），已保持隔离。
- 当前分支：supabase-v1
- Git Commit ID：afd6b50ab2e8d93a9b3486525736e01c026a598a

## DEV-20260726-024

- 日期：2026-07-26
- 状态：已完成
- 修改类型：UI / 表单精简
- 修改模块：训练弹窗
- 任务目标：移除统一训练弹窗中的“预估消耗”字段及其相关提交参数。
- 修改前字段：训练弹窗包含“预估消耗”展示卡片（标题 + 数值 + kcal），并在提交对象中携带 `caloriesBurned`。
- 删除的界面内容：`预估消耗` 标题、数值展示区域、`kcal` 单位提示、对应展示容器。
- 是否同时修改新增和编辑弹窗：新增训练弹窗已移除；当前项目无训练条目独立编辑弹窗（仅支持改时间），因此无额外编辑弹窗可移除。
- 是否移除提交参数：是，新增训练提交对象不再包含 `caloriesBurned`。
- 旧训练数据的兼容方式：不删除历史数据；时间轴和历史读取仍支持旧记录中的 `caloriesBurned` 字段，旧数据保留。
- 是否修改时间轴或历史展示：否（仅移除训练弹窗字段，未改时间轴/历史展示逻辑）。
- 是否修改数据库结构：否。
- 是否新增 migration：否。
- 实际修改文件：`frontend/src/modals/AddTrainingSheet.jsx`、`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROJECT_STATUS.md`、`docs/VERSION_HISTORY.md`
- 实际执行的测试：
	- 修改前检查：`git status --short`、`git branch --show-current`
	- 语法检查：`get_errors` 检查 `frontend/src/modals/AddTrainingSheet.jsx`
	- 逻辑检索：确认训练弹窗文件内无 `预估消耗`、`training-preview-cal`、`caloriesBurned`、`kcal` 残留
	- 兼容检索：确认 `caloriesBurned` 仅保留在 `TimelineItem` 与 `historyService` 的旧数据读取路径
	- 前端构建：`cd frontend && npm run build`
- 测试结果：
	- 本次改动文件无语法错误。
	- 构建通过。
	- 训练弹窗不再显示预估消耗字段，新增训练保存不再依赖该字段。
	- 当前项目无训练完整编辑弹窗，因此“编辑弹窗字段移除”无可执行对象；旧记录兼容路径保持。
- 数据库迁移结果：本次无数据库迁移。
- 前端构建结果：通过。
- 未完成事项：待提供登录态后补充首页手工点击流验证（新增训练弹窗可视化检查）。
- 风险或注意事项：工作区存在未纳入本次提交的无关改动（`frontend/src/components/BottomNav.jsx`、`frontend/src/index.css`），已保持隔离。
- 当前分支：supabase-v1
- Git Commit ID：1330c03b53a17bf6d040e4de8cc0259da915f852
