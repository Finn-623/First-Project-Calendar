# 日常 · 饮食与训练 (Diet & Schedule Tracker)

## Original Problem Statement
手机优先的个人饮食与日程记录网页应用原型。中文界面，前端 Only（无后端 / 无账号 / 无数据库），使用模拟数据。
主页默认显示今天，采用每日时间轴布局，按开始时间排序。
顶部显示今日总热量 / 蛋白 / 脂肪 / 碳水 / 与计划差距。
时间轴固定：早餐、午餐、晚餐；可添加：加餐、无氧、有氧、其他事件。
底部导航：今日 / 历史 / 食物库 / 摄入计划。

## User Choices (2026-02-17)
- 设计：设计师自由发挥（Organic & Earthy 主题：sage/terracotta/mustard）
- 显示：热量 + 圆环 + 百分比进度条 + 差距文字
- 模拟数据：精简（每餐 1-2 食物，1 条训练）
- 生成范围：**全部 7 个页面/弹窗**（不分阶段）

## Architecture
- **Frontend**: React 19 + React Router 7 + Tailwind + shadcn/ui (Sheet, Input, Button, Textarea) + lucide-react + sonner + Google Fonts (Outfit + Noto Sans SC)
- **Backend**: 未启用（原型阶段，无 API 调用）
- **Data**: `src/mockData.js` 单文件内存 mock；页面级 useState 维持交互状态
- **Container**: `max-w-md mx-auto` 桌面居中，手机全宽，无横向滚动

## What's Implemented (2026-02-17)
- 今日页 (`/`)：日期标题 + 营养汇总卡（大热量圆环 + P/F/C 进度条 + 与目标差距）+ 时间轴（虚线导轨 + 节点 + 卡片）
- 添加食物 Sheet：搜索、10 种预置食物、克重输入 + 快捷预设、实时营养换算
- 添加训练 Sheet：无氧/有氧 tab、名称、时间、时长、预估消耗热量
- 添加其他事件 Sheet：标题、时间、备注
- 编辑餐点时间 Sheet：修改早/午/晚/加餐的时间，触发时间轴重新排序
- 悬浮 FAB + 弹出菜单：加餐 / 无氧 / 有氧 / 其他事件
- 历史页 (`/history`)：4 天历史卡片，热量 + 三大营养素 + 计划完成百分比
- 食物库页 (`/library`)：搜索 + 分类 chips（全部/主食/蛋白/脂肪/蔬菜/水果） + 列表
- 摄入计划页 (`/plan`)：4 大目标字段可编辑 + 由三大营养素折算 kcal 核对 + 保存 toast
- 底部导航：固定悬浮胶囊，4 tab（今日/历史/食物库/摄入计划）

## Testing
- 前端 E2E 测试通过 25/25（iteration_1.json） — 全部弹窗、导航、状态更新、无横向滚动验证通过

## Backlog / Deferred
- P1: 历史详情页（点击某天回看当天完整时间轴）
- P1: 食物库中「自定义食物」创建（当前 chips + toast 占位）
- P2: 摄入计划支持按体重/目标智能推荐
- P2: 历史趋势图（热量/宏观 7 天折线）
- P2: 数据持久化（Supabase 或 IndexedDB）+ 账号系统
- P2: 时间选择器上下拖拽（当前使用原生 time input）
- P2: 每餐卡片可折叠 / 食物条目可删除或编辑
- P3: 深色模式
