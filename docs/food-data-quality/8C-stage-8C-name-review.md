# 阶段 8C-1：24条 AFCD 公共食品中文名称人工复核报告

## 1. 阶段目标
对 AFCD 候选食品中剩余 24 条 `needs_name_review` 状态的食品进行人工复核，确认其准确的中文名称，并更新翻译映射。

## 2. 复核统计

| 结论 | 数量 | 说明 |
| :--- | :--- | :--- |
| **translation_ready_override** | 20 | 中文名已确认，通过显式 override 转为 Ready |
| **keep_needs_name_review** | 3 | 仍存在品种、加工方式等疑问，保持 pending |
| **exclude_candidate** | 1 | 明显重复、定义不清或不适合首批发布 |
| **合计** | **24** | |

## 3. 逐条结论与理由

| External ID | 英文名称 | 原中文名 | 最终中文名 | 结论 | 理由 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| F001884 | Bream, fillet, raw | 鲷鱼（鱼柳、生） | - | keep | 物种定义模糊 |
| F001885 | Bream, fillet, steamed | 鲷鱼（鱼柳、蒸） | - | keep | 物种定义模糊 |
| F001920 | Buffalo, riverine, cube roll | 河水牛眼肉（生） | 河水牛眼肉（生） | override | 手动复核 |
| F001921 | Buffalo, riverine, topside | 河水牛后腿内侧肉（生） | 河水牛后腿内侧肉（生） | override | 手动复核 |
| F001922 | Buffalo, swamp, cube roll | 沼泽水牛眼肉（生） | 沼泽水牛眼肉（生） | override | 手动复核 |
| F001923 | Buffalo, swamp, topside | 沼泽水牛后腿内侧肉（生） | 沼泽水牛后腿内侧肉（生） | override | 手动复核 |
| F002205 | Camel, cube roll | 骆驼眼肉（生） | 骆驼眼肉（生） | override | 手动复核 |
| F003776 | Emu, fan fillet | 鸸鹋扇形里脊（生） | 鸸鹋扇形里脊（生） | override | 手动复核 |
| F003973 | Flathead, fillet, raw | 平头鱼（鱼柳、生） | 平头鱼（鱼柳、生） | override | 手动复核 |
| F003974 | Flathead, fillet, steamed | 平头鱼（鱼柳、蒸） | 平头鱼（鱼柳、蒸） | override | 手动复核 |
| F004202 | Gemfish, fillet, raw | 银鳞鲳鱼（鱼柳、生） | 银鳞鲳鱼（鱼柳、生） | override | 手动复核 |
| F004203 | Gemfish, fillet, steamed | 银鳞鲳鱼（鱼柳、蒸） | 银鳞鲳鱼（鱼柳、蒸） | override | 手动复核 |
| F004256 | Grape, cornichon | 科尼雄葡萄（生） | - | exclude | 定义不清 |
| F004261 | Grape, waltham cross | 沃尔瑟姆十字葡萄（生） | 沃尔瑟姆十字葡萄（生） | override | 手动复核 |
| F005193 | Lettuce, mignonette | 奶油生菜（生） | 奶油生菜（生） | override | 手动复核 |
| F005824 | Morwong, fillet, raw | 唇指鲈（鱼柳、生） | 唇指鲈（鱼柳、生） | override | 手动复核 |
| F005825 | Morwong, fillet, steamed | 唇指鲈（鱼柳、蒸） | 唇指鲈（鱼柳、蒸） | override | 手动复核 |
| F005930 | Mulloway, fillet, raw | 澳洲石首鱼（鱼柳、生） | 澳洲石首鱼（鱼柳、生） | override | 手动复核 |
| F005932 | Mulloway, fillet, steamed | 澳洲石首鱼（鱼柳、蒸） | 澳洲石首鱼（鱼柳、蒸） | override | 手动复核 |
| F006282 | Ostrich, fan fillet | 鸵鸟扇形里脊（生） | 鸵鸟扇形里脊（生） | override | 手动复核 |
| F006283 | Ostrich, moon steak | 鸵鸟月牙排（生） | 鸵鸟月牙排（生） | override | 手动复核 |
| F008263 | Silver perch, aquacultured | 银鲈（养殖、生） | 银鲈（养殖、生） | override | 手动复核 |
| F008359 | Snapper, fillet, raw | 笛鲷（鱼柳、生） | - | keep | 物种定义模糊 |
| F009560 | Whiting, King George | 乔治王牙鳕（鱼柳、生） | 乔治王牙鳕（鱼柳、生） | override | 手动复核 |

## 4. 结论与下一步

- 20 条食品完成名称确认，成功转为 ready。
- 3 条食品因物种模糊，仍需进一步专业复核，保持 needs_name_review。
- 1 条食品因定义不明确，建议排除。
- 本阶段仅为本地数据复核与记录，未修改远程数据库，未执行任何审核状态变更或 RPC。
