# 食品数据来源与导入记录

## AFCD 首批公共食品

- 当前来源：Australian Food Composition Database（AFCD）。
- 最终候选包：400条食品，导入状态统一为`pending`。
- 数据包SHA-256：`4b9b3f342727ff39aafa1fb189496f13a76c3e11d5c125c55b858076c5d4696b`。
- 关联数据：100条公共aliases、501条ready portions。
- USDA数据尚未合并进本批AFCD数据包。

## 阶段8C-3B1正式远程trial

- 日期：2026-07-31。
- 正式项目：`Calendar`（project ref：`ragxhkzvaaoembqudnux`）。
- 输入：`remote-trial-20.json`，严格来自最终400条数据包的既有manifest。
- Import run安全缩写：`0a84d27b…`。
- 执行结果：total 20、success 20、failed 0、skipped 0、status`completed`。
- 实际新增：20条public食品、7条公共aliases、45条portions。
- 审核状态：pending 20、approved 0。
- 数据完整性：20个唯一source identities，duplicate foods、orphan aliases、orphan portions均为0。
- 正式foods总数：22，其中原有legacy食品2条、本批AFCD食品20条；原有2条仍存在。
- 匿名权限：本批pending食品、aliases和portions可见数量均为0；import audit读取被拒绝。
- 服务端审计：能够读取本次completed run，统计为20/20/0/0。

## 阶段8C-3B2正式远程首批导入

- 日期：2026-07-31。
- 正式项目：`Calendar`（project ref：`ragxhkzvaaoembqudnux`）。
- 输入：最终400条`public-foods-afcd-initial.json`；SHA-256保持`4b9b3f342727ff39aafa1fb189496f13a76c3e11d5c125c55b858076c5d4696b`。
- trial包含关系：8C-3B1的20条食品全部属于本批，未删除或重复创建。
- 分类数量：主食谷物49、薯类25、肉禽50、水产35、蛋类8、奶制品32、豆类豆制品25、蔬菜65、水果50、坚果20、油脂15、调味品18、非酒精饮品8、简单混合食品0，合计400。
- 第一次整包运行：total 400、success 380、failed 0、skipped 20、status`completed`。
- 实际增量：foods 380、公共aliases 93、portions 456；与trial合计后为400条AFCD foods、100条aliases、501条portions。
- 第二次幂等复跑：total 400、success 0、failed 0、skipped 400、status`completed`；数据行数保持不变。
- 审核状态：pending 400、approved 0、disabled 0；全部active，尚未向普通用户开放。
- 数据完整性：重复source identities、重复aliases、重复portions、孤立aliases和孤立portions均为0；营养非负和糖类关系无违规。
- 兼容结果：正式foods总数402；2条legacy和既有1条private食品保持不变，trial 20条完整保留。
- 权限结果：匿名和通过正式username-login登录的非管理员普通用户均无法读取pending foods、aliases、portions和import audit；服务端可读取两次completed审计且计数与实际数据一致。
- 测试结果：导入/Migration/RLS/归档/批次门禁99项Node测试、五项数据集验证、前端31套件210测试全部通过；Production Build成功，仅保留既有`fs.F_OK`弃用警告。

## 当前边界

- 正式400条AFCD首批食品及幂等复跑已经完成。
- 阶段8C-3B3A已受控审核6条：`F007661`、`F002594`、`F007827`、`F005634`、`F001905`、`F000262`，覆盖谷物、肉类、水产、奶制品、蔬菜和水果。
- 最终保留approved 5条；`F001905`西兰花完成批准、停用及恢复转换验证后保持disabled；其余394条保持pending。
- Migration 027审核审计已部署，9条真实状态转换审计完整；重复批准安全跳过。
- 普通用户只能读取5条approved食品；停用的西兰花及其alias/portion不可见，相关历史快照未改变。
- 尚未开发或部署公共食品搜索和正式前端展示。
- 尚未执行cleanup或新的数据库Migration。
- 旧Legacy API Keys仍需在后台依赖检查完成后安全停用。
- 本文档不记录密钥、JWT、Authorization header、用户标识或完整import run标识。
