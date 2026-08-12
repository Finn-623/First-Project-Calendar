# 当前项目进度

## 连续日期历史错位修复（2026-08-12）

- 根因是当前业务日同时由浏览器本地Date、Sydney转换Date和`recordingDateStr`推导；结束本日、Today写入、Realtime与IndexedDB可能使用相邻日期key，错误key再触发合法的`user_id,archive_date` upsert覆盖。
- 已统一使用严格Sydney业务日`YYYY-MM-DD`字符串：Store的`selectedDateStr`是唯一当前查看日来源，Date只用于UI；归档、Timeline、History/HistoryDetail、Realtime、缓存均复用该key，推进日只创建下一key而不修改旧数据。
- 日期/History/Timeline/IndexedDB专项75项、前端全量45套件327项及Production Build通过；未改数据库结构，未移动任何现有历史。Production连续三日最终验收待完成。

## 建议提交失败修复（2026-08-12）

- Production原始错误为`P0001: invalid target version`：正式应用版本`0.2.1.1`为四段，而Migration 035的反馈版本/编号/RLS/编号函数仅接受三段版本。
- Migration 037已部署到正式Supabase并统一兼容三段或四段版本；authenticated owner写入、匿名拒绝、跨用户拒绝、失败零残留、持久化回读及测试数据清理均已验证，Migration 028保持未部署。
- 前端现在提交完整pending payload，结构化记录Supabase `code/message/details/hint/payload`，失败保留表单并恢复状态；同步提交锁防重复点击，成功后即时合并返回记录并从Supabase强制回读。
- 反馈专项42/42、Migration契约65/65、前端全量44套件322/322及Production Build通过；修复Commit `623c9a351b865090336c74358b2ad842893793ad`已push，Production Deployment `dpl_Do8QJbMFcPjbgYp4czNunbb71xiL`为READY。
- 正式网页登录、提交成功提示、即时历史显示、刷新持久化、重复点击单条写入、未完成/已完成历史和测试数据删除均通过；清理后刷新残留0，可以将该Bug标记为已完成。

## 历史食品记录新增修复（2026-08-10）

- 新增记录已改为Migration 036事务RPC：餐次与food entry同事务、`auth.uid()`归属、mutation幂等、失败整体回滚；前端失败时同步撤销乐观状态，避免污染IndexedDB快照。
- 本地Migration契约62项、前端全量44套件318项及Production Build通过；Today、History、HistoryDetail查看/编辑/删除回归通过。
- Migration 036尚未获远程部署授权；部署前正式环境不会启用新RPC。Migration 028仍保持LOCAL ONLY且不是036依赖。

## Release Strategy

- **当前正式发布版本：v0.2.1.1**。已于2026-08-09 16:58:47（Australia/Sydney）完成Frontend Production紧急发布，仅增加个人食品 kcal/kJ 输入与转换，内部继续保存kcal。
- 功能部署Commit：`ebe7d90edbff35e55079dc7cc17ba603368852e4`；功能部署ID：`dpl_CLJWRGxCphMfSY5Qm1QcEk5pLeJm`；Production：`https://frontend-nu-khaki-18.vercel.app`。
- 发布验证：44套件314项通过，Production Build成功；根地址、登录、食物库、设置及Feedback深链接返回200，线上bundle为v0.2.1.1且username-login正常。
- 数据库边界：未执行db push、未部署任何Migration；Migration 028继续保持LOCAL ONLY / DO NOT DEPLOY。
- **下一个小版本：v0.2.2**。
- **后续版本**：处理 P3。

## P1阶段收尾盘点（2026-08-09）
... [Rest of the file] ...
