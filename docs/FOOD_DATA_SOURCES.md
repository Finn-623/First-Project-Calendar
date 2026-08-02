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

## 阶段8/8B正式远程受控发布

- 日期：2026-08-02。
- 写入前分组：370条pending_to_approve、5条already_approved_keep、1条disabled_keep、24条needs_name_review pending；异常映射和未知状态均为0。
- 固定批次：按external_id升序拆为8批，数量为50、50、50、50、50、50、50、20；所有UUID唯一。
- 审核结果：8批合计370 success、0 skipped、0 failed；新增370条pending→approved审核事件，审核事件总数379。
- 最终状态：AFCD pending 24、approved 375、disabled 1；24条名称待审均未发布，F001905西兰花保持disabled。
- Portion边界：远程继续包含501条最终Ready portion；阶段7的3条exclude和40条defer共43条Held portion保持包外。普通用户可读取已批准食品关联的483条portion；无portion食品仍可按克记录。
- Alias边界：远程100条公共alias保持不变；普通用户可读取已批准食品关联的99条，隐藏食品alias不反向泄露。
- 权限验收：匿名与普通账号仅能读取375条approved active食品，不能读取审核事件或调用审核RPC；管理员可读取全部400条及审核事件并执行RPC；service role仅受控读取且不能冒充管理员审核。
- 完整性：重复foods/aliases/portions、孤立aliases/portions、负数营养和糖类关系违规均为0；总foods保持402，2条legacy、1条个人食品和历史食品快照未改变。
- 测试结果：Migration 027专项6/6、导入/Migration/RLS/归档契约105/105、前端32套件219测试、最终数据包与四项数据集验证全部通过；Production Build成功，仅保留既有`fs.F_OK`弃用警告。


## 阶段 7/8 综合质量验证

- 日期：2026-08-02
- 范围：400条AFCD公共食品。
- 状态分布：release_ready 21, release_ready_without_portion 22, needs_name_review 357, needs_portion_review 0, needs_data_review 0, exclude_candidate 0（合计 400）。
- 结果：43 条食品符合进入阶段8的资格，Ready portions 321, Held portions 223。
- 验证：确认数据一致性、可重复性及源数据稳定性。
- 权限：仅为本地验证，未执行远程写入、状态修改或审核变更。

## 阶段 8/8C-1 名单人工复核与名称确认

- 日期：2026-08-02
- 范围：复核剩余24条needs_name_review食品。
- 结论：20条通过override转为Ready，3条因专业定义模糊保持needs_name_review，1条因定义不清 exclude_candidate。
- 结果：release_ready 217, release_ready_without_portion 179, needs_name_review 3, exclude_candidate 1（合计 400）。
- 可发布候选：396 条。
- 验证：确认数据一致性及人工结论的准确性。
- 权限：仅为本地验证，未执行远程写入、状态修改或审核变更。
