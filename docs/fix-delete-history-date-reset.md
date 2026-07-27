# 删除本日历史后的日期状态重置修复

**修复日期**：2026-07-27  
**修复编号**：DEV-20260727-067  
**Commit IDs**：`8ea36e8`（修复）、`64c5014`（文档）

## 问题描述

用户删除了本日的历史记录后，点击"首页"按钮时会被错误地跳转到下一日，而不是返回当前的真实记录。

### 根本原因

1. 用户在某一天记录了数据，点击"结束本日"
   - `daily_archives` 中创建记录，`is_completed = true`
   - `recordingDateStr` 被设置为下一日

2. 用户进入历史页面，删除了那一天的历史记录
   - 数据库中的 `timeline_items` 和 `daily_archives` 被删除
   - **但** `recordingDateStr` 和 `currentDate` 仍然指向下一日

3. 用户点击"首页"按钮
   - `initializeSelectedDate` 被调用
   - 尽管数据库中那一天的记录已被删除，但内存中的状态仍然是"已结束"
   - 导致用户被跳转到下一日而不是当天

## 解决方案

### 1. 添加 `resetDeletedDateState()` 函数

在 `store.jsx` 中添加辅助函数：

```javascript
const resetDeletedDateState = useCallback((deletedDateStr) => {
  if (!deletedDateStr) return;

  const today = getSydneyDateString();
  
  // 如果被删除的日期正好是当前查看的日期
  if (deletedDateStr === recordingDateStr) {
    // 重置为当前真实的今天
    setRecordingDateStr(today);
    setCurrentDate(createDateFromString(today));
  }
}, [recordingDateStr]);
```

**作用**：
- 检查被删除的日期是否等于当前查看的日期
- 如果相等，重置 `recordingDateStr` 和 `currentDate` 为当前真实的今天
- 如果不相等，保持原有状态

### 2. 在 `HistoryDetailPage` 中调用

删除整天时：

```javascript
if (confirmKind === 'day') {
  const { error } = await historyService.deleteFullDayRecords(dateStr);
  if (error) {
    toast.error(error?.message || '删除失败，请稍后重试');
    return;
  }

  await loadHistory(user.id);
  
  // ← 新增：清除被删除日期的状态
  resetDeletedDateState(dateStr);
  
  setConfirmOpen(false);
  toast.success('历史记录已删除');
  navigate('/history', { state: isFromSettings ? { returnTo: 'settings' } : {} });
  return;
}
```

### 3. 在 `HistoryPage` 中调用

批量删除时：

```javascript
const selectedLookup = new Set(selectedDateKeys);
setHistory((prev) => prev.filter((item) => !selectedLookup.has(item.dateStr)));

// ← 新增：如果被删除的日期中包含当前查看的日期，重置状态
if (selectedLookup.has(recordingDateStr)) {
  resetDeletedDateState(recordingDateStr);
}
```

## 修复后的行为

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| **删除本日后点击首页** | ❌ 跳转到下一日 | ✅ 返回当日 |
| **删除其他日期** | ✓ 首页不变 | ✓ 首页不变 |
| **删除后刷新页面** | ❌ 仍然是下一日 | ✅ 正确回到当日 |
| **页面停留** | ✓ 停留在历史页 | ✓ 停留在历史页 |
| **状态清除** | ❌ 记录已删除但状态未清除 | ✅ 状态完全重置 |

### 流程示例

```
1. 用户于 2026-07-27 记录数据，点击"结束本日"
   → recordingDateStr = '2026-07-28' (下一日)
   → daily_archives.is_completed = true

2. 用户进入历史，删除 2026-07-27 的记录
   → 数据库删除 timeline_items 和 daily_archives
   → resetDeletedDateState('2026-07-27') 被调用
   → recordingDateStr 重置为 '2026-07-27' (当日)

3. 用户点击首页
   → initializeSelectedDate 查询 getDayCompletion('2026-07-27')
   → 返回 null（因为记录已被删除）
   → initialDate = null ? addDaysToDateString(today, 1) : today
   → initialDate = '2026-07-27' ✅ 正确！

4. 用户刷新页面
   → resetDeletedDateState 是本地状态，不被保存
   → 但 initializeSelectedDate 会重新查询数据库
   → getDayCompletion 仍然返回 null
   → 正确回到当日 ✅
```

## 数据完整性保证

### 状态重置的范围

- ✅ `recordingDateStr` - 重置为当日
- ✅ `currentDate` - 重置为当日  
- ✅ `is_completed` 状态 - 通过 getDayCompletion 查询（删除后返回 null）
- ✅ 历史详情缓存 - 被删除日期的缓存自动失效

### 原子性

- `deleteFullDayRecords` 删除整天的所有 `timeline_items` 和 `daily_archives` 记录（数据库端 RPC）
- `deleteHistoryDays` 批量删除多天的记录（原子操作）
- 要么全部删除，要么全部保留，不存在部分删除的情况

### 其他日期不受影响

- 只有当 `deletedDateStr === recordingDateStr` 时才会重置
- 删除其他日期时，`recordingDateStr` 保持不变
- 其他日期的历史记录完全保留

## 测试覆盖

添加了 16 个新的测试用例（在 `delete-history-date-reset.test.js`）：

### 核心逻辑测试
- ✅ 被删除日期等于当前查看日期时重置状态
- ✅ 被删除日期不等于当前查看日期时保持原状态
- ✅ 处理 null/undefined 参数

### 日期初始化测试
- ✅ 删除本日后 `initializeSelectedDate` 返回当日
- ✅ `recordingDateStr` 正确指向当日
- ✅ 批量删除中包含当前日期时正确重置
- ✅ 批量删除中不包含当前日期时保持原状态

### 刷新和缓存测试
- ✅ 刷新页面后 `initializeSelectedDate` 返回正确的当日
- ✅ 刷新后依赖数据库查询而不是 localStorage 缓存

### 数据完整性测试
- ✅ 删除本日历史不影响其他日期记录
- ✅ 删除操作保证原子性

## 验证结果

| 项目 | 结果 |
|------|------|
| **构建** | ✅ 成功（240.01 kB） |
| **测试** | ✅ 96/96 通过（12 个套件） |
| **新增测试** | ✅ 16 个全部通过 |
| **回归** | ✅ 无回归 |

---

## 相关文件

- **核心修复**：[store.jsx](../frontend/src/store.jsx#resetDeletedDateState)
- **删除整天调用**：[HistoryDetailPage.jsx](../frontend/src/pages/HistoryDetailPage.jsx#handleConfirmDelete)
- **批量删除调用**：[HistoryPage.jsx](../frontend/src/pages/HistoryPage.jsx#handleBatchDelete)
- **完整测试**：[delete-history-date-reset.test.js](../frontend/src/__tests__/delete-history-date-reset.test.js)
- **开发日志**：[DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md#DEV-20260727-067)
