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
