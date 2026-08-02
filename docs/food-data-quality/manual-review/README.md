# AFCD 400 条公共食品人工审核清单

本目录用于对当前正式环境中的 400 条 AFCD 公共食品进行人工复核。

## 文件

- `afcd-400-manual-review.csv`：人工审核主清单，包含 400 条食品记录。
- `afcd-400-client-review.csv`：客户端审核视图。

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

- `publish_decision`: 审核决定（初始为空）
- `final_chinese_name`: 客户端显示的最终中文名（初始默认为 `original_chinese_name`）
- `reviewer_notes`: 备注
- `reviewed_at`: 审核时间

## 流程约束

- 如已有人工填写记录，请保留该行 `external_food_id` 的原有数据。
- 严禁修改正式食品数据或远程数据库。
- 不得提交（commit）或推送（push）任何对此 CSV 文件的修改。
