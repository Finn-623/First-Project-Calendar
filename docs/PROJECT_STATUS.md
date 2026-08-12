# 当前项目进度

## Home / History 统一数据源 P0（2026-08-12）

- 已确认 Production 中 2026-08-11 archive 为 2502 kcal、4 meals、17 foods，而 2026-08-12 是独立 live 数据；错误显示来自 Home 的 live-only 查询、日期无关的 React timeline 及迟到异步结果，History 则独立使用 archive-first 查询。
- 新增 canonical daily-record service，Home、History、HistoryDetail 统一为 Supabase archive-first/live-second 数据规则；日期请求、内存及 IndexedDB key 均绑定 user + business date，远程成功结果具有最高优先级。
- Home 过去日期编辑与 HistoryDetail 编辑写同一 archive；删除历史会同步清空 Home 当前日期及缓存；Migration 039 已部署，跨标签/设备 archive insert/update/delete 可按 business date 失效。
- Production真实验收额外发现live food rows只参与汇总、未挂回meal foods，造成History 12显示1391 kcal而Home 12显示0；补充Commit `02cc779ff5d94ad5ffa3627724352b157e8a6549`已修正统一adapter。
- 日期/History/Realtime 专项40项、前端全量47套件336项、Migration契约68项和Production Build全部通过。主Fix Commit `e85ef5c2e7eba300695dd3bb295fa46a41298adc`。Migration 028未处理。
- 当前状态：等待最新前端 Production 部署及真实测试账号执行 Home↔History 双向编辑、删除、刷新、重登和双设备验收；完成前不关闭P0。

## 跨日覆盖与自动结束联合修复（2026-08-12）

- Production取证确认08-10/08-11为不同archive ID与不同payload hash，但两日内容/17 food/2502 kcal完全相同；08-10在原自动归档count=0后于08-11 22:25被旧手动结束链路覆盖。08-12 live timeline/food仍真实存在。
- 原自动记录设置只保存配置，归档依赖Cron Edge Function；Cron确实00:05执行，但客户端无登录/跨日补偿。自动RPC写长键totals而History只读短键，导致自动归档消耗显示0。
- Migration 038已部署：authenticated客户端只能以`auth.uid()`复用既有事务自动归档核心补偿前一Sydney业务日；Store在登录/启动/午夜/恢复统一触发。History兼容手动和自动totals格式。Migration 028未处理。
- 前端全量46套件330项、Migration/auto-archive契约82项及Production Build通过。核心修复`ab91cf01bfa286c19c5b150f572a3fdcbfb29fd2`及两项History补充已push，Production `dpl_E9Z2f2P7hbcehuNQNWrfZ2ZBE4RD`为READY。
- Production A=111/B=222/C独立事件验收中未手动结束B；登录后B自动归档、History显示222、A仍111、Today仅C，日期/内容互不覆盖。测试数据和临时设置已清理。08-10真实原始内容缺乏可靠恢复来源，未猜测或修改现有历史。

## 连续日期历史错位修复（2026-08-12）

- 根因是当前业务日同时由浏览器本地Date、Sydney转换Date和`recordingDateStr`推导；结束本日、Today写入、Realtime与IndexedDB可能使用相邻日期key，错误key再触发合法的`user_id,archive_date` upsert覆盖。
- 已统一使用严格Sydney业务日`YYYY-MM-DD`字符串：Store的`selectedDateStr`是唯一当前查看日来源，Date只用于UI；归档、Timeline、History/HistoryDetail、Realtime、缓存均复用该key，推进日只创建下一key而不修改旧数据。
- 日期/History/Timeline/IndexedDB专项75项、前端全量45套件327项及Production Build通过；未改数据库结构，未移动任何现有历史。修复Commit `fa1c457c5c9c96c2c3e72fa8beee2e4bad6fd7b9`已push，Production Deployment `dpl_HLs4Sx5DYsLNAJPF59jhsJUzjciS`为READY。
- Production连续三日验收通过：8月10日101g、11日202g、12日独立事件在结束本日、刷新、退出重登后均保持原日期和内容，HistoryDetail逐日匹配；测试数据已清理且归档/timeline残留0。正式库现有6个归档的可关联日期错位统计为0，可将该Bug标记为已完成。

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
