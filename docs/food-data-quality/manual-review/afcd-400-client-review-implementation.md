# AFCD 400条客户端人工审核实施报告

## 实施范围

- 日期：2026-08-02
- 目标环境：正式 `Calendar` Supabase 项目
- 唯一业务依据：本目录客户端审核CSV、actions JSON和实施计划
- 人工决定：publish 136、disable 264

## 状态执行

| 操作 | 批次 | 请求 | 成功 | 跳过 | 失败 |
|---|---:|---:|---:|---:|---:|
| approved/pending → disabled | 1 | 50 | 50 | 0 | 0 |
| approved/pending → disabled | 2 | 50 | 50 | 0 | 0 |
| approved/pending → disabled | 3 | 50 | 50 | 0 | 0 |
| approved/pending → disabled | 4 | 50 | 50 | 0 | 0 |
| approved/pending → disabled | 5 | 50 | 50 | 0 | 0 |
| approved/pending → disabled | 6 | 13 | 13 | 0 | 0 |
| F001905 disabled → approved | 1 | 1 | 1 | 0 | 0 |

- 最终状态：approved 136、pending 0、disabled 264。
- 审核事件：新增264，最终664。

## 名称实施

- F001905：西兰花
- F005599：无乳糖全脂牛奶（约3.5%）
- F005614：低脂牛奶（约1%）
- F000561：瘦牛肉丁（生）
- F004928：瘦羊肉丁（生）

名称通过管理员RLS受控更新；`updated_by/updated_at`保留数据库操作归属，实施详情由本报告与受控脚本记录。未删除旧名称alias，未新增重复alias。

## 验收

- 匿名和普通用户：136 foods、28 aliases、203 portions；审核事件不可读且审核RPC不可调用。
- 管理员：400 AFCD foods、664审核事件；角色由服务端确认。
- service role：可受控读取，不能冒充管理员调用审核RPC。
- 总量：402 foods、100 aliases、501 portions；43条Held portions保持包外。
- 兼容：2条legacy、1条private与历史食品/归档快照未改变。
- 完整性：重复foods/aliases/portions、孤立aliases/portions、非法营养和糖类约束违规均为0。
- 测试：数据集验证通过；契约测试90/90；前端32套件219测试通过；Production Build成功。
- 已知警告：仅有既有Node `fs.F_OK`弃用警告，以及测试环境未注入前端Supabase变量时的预期console输出。

## Git记录

- 本阶段Commit ID由本提交自身记录，以`git rev-parse HEAD`为准。
