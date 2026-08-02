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


## 阶段 7/8 综合质量验证

- 日期：2026-08-02
- 范围：400条AFCD公共食品。
- 阶段8/8A-1发现并修复翻译生成器未加载集中规则与显式override造成的源文件分叉；正式数据包本身内容正确，SHA-256继续为`4b9b3f342727ff39aafa1fb189496f13a76c3e11d5c125c55b858076c5d4696b`。
- 旧包与修复前最新源的差异：中文名/翻译状态涉及400条，alias涉及79条；intake_types、portion、分类、营养和身份差异均为0。修复后全部字段差异为0。
- 翻译结果：376 Ready、24 needs_review；复用既有显式override确认大西洋三文鱼柳、全脂牛奶、卡文迪什香蕉和西兰花，无新增宽泛规则。
- 状态分布：release_ready 213、release_ready_without_portion 163、needs_name_review 24，其余三类均为0（合计400）。
- Portion发布边界：321条原始Ready加180条阶段7明确批准，最终501条进入包；3条exclude与40条defer共43条保持包外。
- 远程只读对账：370 pending_to_approve、5 already_approved_keep、1 disabled_keep；24条needs_name_review全部为pending，映射异常和未知状态均为0。
- 权限：本阶段远程写入为0，未执行批准、停用或恢复。
