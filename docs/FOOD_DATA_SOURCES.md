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

## 当前边界

- 本阶段只执行过一次正式remote trial execute。
- 尚未执行远程幂等重跑。
- 尚未批准任何trial食品。
- 尚未导入剩余380条食品。
- 尚未执行cleanup或新的数据库Migration。
- 旧Legacy API Keys仍需在后台依赖检查完成后安全停用。
- 本文档不记录密钥、JWT、Authorization header、用户标识或完整import run标识。
