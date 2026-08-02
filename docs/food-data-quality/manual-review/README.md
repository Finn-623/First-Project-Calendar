# AFCD 400 条公共食品人工审核清单

本目录用于对当前正式环境中的 400 条 AFCD 公共食品进行人工复核。

## 文件

- `afcd-400-manual-review.csv`：已完成的人工审核主清单，包含 400 条食品记录。
- `afcd-400-client-review.csv`：与主清单逐条一致的客户端审核视图。
- `afcd-400-client-review-actions.json`：结合当前远程状态生成的机器可读实施动作。
- `afcd-400-client-review-plan.md`：审核统计、名称变更及状态闭合实施计划。

## 审核规则

- 审核人只需核对以下两项：
  1. 是否推送到客户端 (`publish_decision`)
  2. 客户端最终中文名 (`final_chinese_name`)
- 食品清单分为 4 批，每批 100 条 (Batch-01 至 Batch-04)。
- 前 5 条食品为固定优先级：`F001884`, `F001885`, `F008359`, `F004256`, `F001905`。其余按一级分类和 external_food_id 排序。

## 可用 `publish_decision` 选项

- `publish`: 发布
- `rename_publish`: 修改后发布
- `hold`: 暂存
- `disable`: 禁用
- `restore`: 恢复

## 审核字段

- `publish_decision`: 最终审核决定；本轮为空的决定已按用户确认规则统一记为 `disable`
- `final_chinese_name`: 用户确认的客户端最终显示中文名；可与审核决定独立变化
- `reviewer_notes`: 备注
- `reviewed_at`: 审核时间

## 流程约束

- 最终统计为 `publish` 136 条、`disable` 264 条；其余决定为 0 条。
- 名称变化严格限于 `F001905`、`F005599`、`F005614`、`F000561`、`F004928`。
- 如已有人工填写记录，必须保留该行 `external_food_id` 的原有决定和最终名称。
- 严禁修改正式食品数据或远程数据库。
- 实际远程执行必须另行授权；本目录文件仅描述已确认结果及后续动作。
