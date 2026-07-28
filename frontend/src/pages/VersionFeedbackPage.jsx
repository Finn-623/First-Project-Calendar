import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { showSuccess } from '../lib/notifications';
import { useStore } from '../store';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { versionFeedbackService } from '../services/versionFeedbackService';
import { VERSION_RECORDS } from '../data/versionHistory';
import { validateCompletedVersion, validateFeedbackForm } from '../lib/versionFeedbackValidation';
import {
  formatLocalDateTime,
  getFeedbackStatusLabel,
  getFeedbackStatusVariant,
} from '../lib/versionInfoUtils';

const DESCRIPTION_PREVIEW_LIMIT = 120;

export const VersionFeedbackPage = () => {
  const { user, profile } = useStore();
  const [activeTab, setActiveTab] = useState('submit');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [historyError, setHistoryError] = useState('');
  const [history, setHistory] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingForm, setEditingForm] = useState({ title: '', description: '' });
  const [editingErrors, setEditingErrors] = useState({});
  const [savingEditId, setSavingEditId] = useState('');
  const [expandedMap, setExpandedMap] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState('');
  const [completeVersionMap, setCompleteVersionMap] = useState({});
  const [completeVersionErrors, setCompleteVersionErrors] = useState({});
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [errors, setErrors] = useState({});

  const availableVersions = useMemo(() => {
    const values = VERSION_RECORDS
      .map((item) => `v${item.version}`)
      .filter(Boolean);
    return [...new Set(values)];
  }, []);

  const isAdmin = useMemo(() => {
    return profile?.role === 'admin' || profile?.is_admin === true;
  }, [profile?.is_admin, profile?.role]);

  const mergeAndSortHistory = useCallback((items) => {
    return [...items].sort((a, b) => {
      const left = new Date(a.created_at || 0).getTime();
      const right = new Date(b.created_at || 0).getTime();
      return right - left;
    });
  }, []);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;

    setLoadingHistory(true);
    setHistoryError('');

    const result = await versionFeedbackService.listFeedback({
      userId: user.id,
      isAdmin,
      limit: 10,
      cursor: null,
    });

    if (!result.success) {
      setHistoryError('记录加载失败，请重试');
      setLoadingHistory(false);
      return;
    }

    const nextRows = result.data || [];

    setHistory(mergeAndSortHistory(nextRows));
    setLoadingHistory(false);

    setHasMore(Boolean(result.hasMore));
    setNextCursor(result.nextCursor || null);
  }, [isAdmin, mergeAndSortHistory, user?.id]);

  const loadMoreHistory = useCallback(async () => {
    if (!user?.id || !hasMore || loadingMore || loadingHistory || !nextCursor) {
      return;
    }

    setLoadingMore(true);

    const result = await versionFeedbackService.listFeedback({
      userId: user.id,
      isAdmin,
      limit: 10,
      cursor: nextCursor,
    });

    if (!result.success) {
      toast.error(result.error || '记录加载失败，请重试');
      setLoadingMore(false);
      return;
    }

    const nextRows = result.data || [];
    setHistory((prev) => mergeAndSortHistory([...prev, ...nextRows]));
    setHasMore(Boolean(result.hasMore));
    setNextCursor(result.nextCursor || null);
    setLoadingMore(false);
  }, [hasMore, isAdmin, loadingHistory, loadingMore, mergeAndSortHistory, nextCursor, user?.id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !user?.id) return;

    const validated = validateFeedbackForm(formData);
    if (!validated.valid) {
      setErrors(validated.errors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    const result = await versionFeedbackService.createFeedback({
      userId: user.id,
      title: validated.normalized.title,
      description: validated.normalized.description,
    });

    if (!result.success) {
      toast.error(result.error || '提交失败，请稍后重试');
      setSubmitting(false);
      return;
    }

    setFormData({ title: '', description: '' });
    setSubmitting(false);
    showSuccess('修改意见已提交');
    setActiveTab('history');
    await loadHistory();
  };

  const handleEditStart = (item) => {
    setEditingId(item.id);
    setEditingForm({
      title: item.title || '',
      description: item.description || '',
    });
    setEditingErrors({});
  };

  const handleEditCancel = () => {
    setEditingId('');
    setEditingErrors({});
  };

  const handleSaveEdit = async (item) => {
    if (savingEditId || editingId !== item.id) return;

    const validated = validateFeedbackForm(editingForm);
    if (!validated.valid) {
      setEditingErrors(validated.errors);
      return;
    }

    const titleUnchanged = validated.normalized.title === String(item.title || '').trim();
    const descriptionUnchanged = validated.normalized.description === String(item.description || '').trim();
    if (titleUnchanged && descriptionUnchanged) {
      handleEditCancel();
      return;
    }

    setSavingEditId(item.id);

    const result = await versionFeedbackService.updateFeedbackContent({
      feedbackId: item.id,
      title: validated.normalized.title,
      description: validated.normalized.description,
    });

    if (!result.success) {
      toast.error(result.error || '修改失败，请稍后重试');
      setSavingEditId('');
      return;
    }

    setHistory((prev) => prev.map((record) => (record.id === item.id ? { ...record, ...result.data } : record)));
    setSavingEditId('');
    setEditingId('');
    showSuccess('修改意见已更新');
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id || deletingId) return;

    setDeletingId(deleteTarget.id);
    const result = await versionFeedbackService.deleteFeedback({ feedbackId: deleteTarget.id });

    if (!result.success) {
      toast.error(result.error || '删除失败，请稍后重试');
      setDeletingId('');
      return;
    }

    setHistory((prev) => prev.filter((record) => record.id !== deleteTarget.id));
    setDeletingId('');
    setDeleteTarget(null);
    showSuccess('修改意见已删除');
  };

  const handleComplete = async (item) => {
    if (!isAdmin || updatingStatusId) return;

    const validation = validateCompletedVersion(completeVersionMap[item.id]);
    if (!validation.valid) {
      setCompleteVersionErrors((prev) => ({
        ...prev,
        [item.id]: validation.error,
      }));
      return;
    }

    setCompleteVersionErrors((prev) => ({ ...prev, [item.id]: '' }));
    setUpdatingStatusId(item.id);

    const result = await versionFeedbackService.completeFeedback({
      feedbackId: item.id,
      completedVersion: validation.normalized,
    });

    if (!result.success) {
      toast.error(result.error || '状态更新失败，请稍后重试');
      setUpdatingStatusId('');
      return;
    }

    setHistory((prev) => prev.map((record) => (record.id === item.id ? { ...record, ...result.data } : record)));
    setCompleteVersionMap((prev) => ({ ...prev, [item.id]: validation.normalized }));
    setUpdatingStatusId('');
    showSuccess('任务已标记为已完成');
  };

  const handleReopen = async (item) => {
    if (!isAdmin || updatingStatusId) return;

    setUpdatingStatusId(item.id);
    const result = await versionFeedbackService.reopenFeedback({ feedbackId: item.id });

    if (!result.success) {
      toast.error(result.error || '状态更新失败，请稍后重试');
      setUpdatingStatusId('');
      return;
    }

    setHistory((prev) => prev.map((record) => (record.id === item.id ? { ...record, ...result.data } : record)));
    setCompleteVersionMap((prev) => ({ ...prev, [item.id]: '' }));
    setUpdatingStatusId('');
    showSuccess('任务已恢复为未完成');
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, isAdmin, loadHistory, user?.id]);

  const toggleExpanded = (id) => {
    setExpandedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <SettingsSubpageHeader
        title="修改意见"
        description="提交使用建议，并查看建议的处理进度。"
      />

      <Link
        to="/settings/version"
        className="inline-flex mb-4 min-h-11 items-center rounded-lg px-3 text-[13px] text-[#6B8067] hover:bg-[#EEF2EC]"
      >
        返回版本信息
      </Link>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-11">
          <TabsTrigger value="submit">提交建议</TabsTrigger>
          <TabsTrigger
            value="history"
          >
            建议历史
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submit">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-[#E5E5E0] bg-white p-4 mt-3 space-y-3">
            <div>
              <label htmlFor="feedback-title" className="text-[12px] text-[#6A6F6C]">建议标题</label>
              <input
                id="feedback-title"
                value={formData.title}
                onChange={(event) => {
                  setFormData((prev) => ({ ...prev, title: event.target.value }));
                  setErrors((prev) => ({ ...prev, title: '' }));
                }}
                placeholder="简要说明希望修改的内容"
                className="mt-1 w-full min-h-11 rounded-lg border border-[#D5DCD2] bg-white px-3 text-[14px] text-[#2C332F]"
              />
              {errors.title ? <p className="mt-1 text-[12px] text-[#A8483E]">{errors.title}</p> : null}
            </div>

            <div>
              <label htmlFor="feedback-description" className="text-[12px] text-[#6A6F6C]">详细说明</label>
              <textarea
                id="feedback-description"
                value={formData.description}
                onChange={(event) => {
                  setFormData((prev) => ({ ...prev, description: event.target.value }));
                  setErrors((prev) => ({ ...prev, description: '' }));
                }}
                rows={6}
                placeholder="请描述遇到的问题、希望的改动或具体使用场景"
                className="mt-1 w-full rounded-lg border border-[#D5DCD2] bg-white px-3 py-2 text-[14px] text-[#2C332F] resize-y"
              />
              {errors.description ? <p className="mt-1 text-[12px] text-[#A8483E]">{errors.description}</p> : null}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-11 rounded-xl bg-[#6B8067] text-white text-[14px] hover:bg-[#5D725A] disabled:opacity-55"
            >
              {submitting ? '提交中...' : '提交修改意见'}
            </button>
          </form>
        </TabsContent>

        <TabsContent value="history">
          <div className="rounded-2xl border border-[#E5E5E0] bg-white mt-3 overflow-hidden">
            {loadingHistory ? <p className="px-4 py-3 text-[13px] text-[#6A6F6C]">正在加载建议历史...</p> : null}
            {!loadingHistory && historyError ? (
              <div className="px-4 py-3">
                <p className="text-[13px] text-[#A8483E]">记录加载失败，请重试</p>
                <button
                  type="button"
                  onClick={loadHistory}
                  className="mt-2 min-h-11 px-3 rounded-lg border border-[#D5DCD2] text-[13px] text-[#2C332F]"
                >
                  重试
                </button>
              </div>
            ) : null}

            {!loadingHistory && !historyError && history.length === 0 ? (
              <div className="px-4 py-3">
                <p className="text-[13px] text-[#6A6F6C]">目前没有记录</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('submit')}
                  className="mt-2 min-h-11 px-3 rounded-lg border border-[#D5DCD2] text-[13px] text-[#2C332F]"
                >
                  提交修改意见
                </button>
              </div>
            ) : null}

            {!loadingHistory && !historyError && history.map((item) => (
              <article key={item.id} className="px-4 py-3 border-b border-[#F0EFE9] last:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] text-[#2C332F] font-medium break-all">{item.title}</p>
                  <Badge variant={getFeedbackStatusVariant(item.status)}>{getFeedbackStatusLabel(item.status)}</Badge>
                </div>

                {editingId === item.id ? (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label htmlFor={`edit-title-${item.id}`} className="text-[12px] text-[#6A6F6C]">建议标题</label>
                      <input
                        id={`edit-title-${item.id}`}
                        value={editingForm.title}
                        onChange={(event) => {
                          setEditingForm((prev) => ({ ...prev, title: event.target.value }));
                          setEditingErrors((prev) => ({ ...prev, title: '' }));
                        }}
                        className="mt-1 w-full min-h-11 rounded-lg border border-[#D5DCD2] bg-white px-3 text-[14px] text-[#2C332F]"
                      />
                      {editingErrors.title ? <p className="mt-1 text-[12px] text-[#A8483E]">{editingErrors.title}</p> : null}
                    </div>

                    <div>
                      <label htmlFor={`edit-description-${item.id}`} className="text-[12px] text-[#6A6F6C]">详细说明</label>
                      <textarea
                        id={`edit-description-${item.id}`}
                        rows={5}
                        value={editingForm.description}
                        onChange={(event) => {
                          setEditingForm((prev) => ({ ...prev, description: event.target.value }));
                          setEditingErrors((prev) => ({ ...prev, description: '' }));
                        }}
                        className="mt-1 w-full rounded-lg border border-[#D5DCD2] bg-white px-3 py-2 text-[14px] text-[#2C332F] resize-y"
                      />
                      {editingErrors.description ? <p className="mt-1 text-[12px] text-[#A8483E]">{editingErrors.description}</p> : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleEditCancel}
                        disabled={savingEditId === item.id}
                        className="min-h-10 px-3 rounded-lg border border-[#D5DCD2] text-[12px] text-[#2C332F] disabled:opacity-55"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(item)}
                        disabled={savingEditId === item.id}
                        className="min-h-10 px-3 rounded-lg bg-[#2C332F] text-[12px] text-white disabled:opacity-55"
                      >
                        {savingEditId === item.id ? '保存中...' : '保存修改'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[13px] text-[#46504B] mt-2 whitespace-pre-wrap break-words">
                      {expandedMap[item.id] || !item.description || item.description.length <= DESCRIPTION_PREVIEW_LIMIT
                        ? item.description
                        : `${item.description.slice(0, DESCRIPTION_PREVIEW_LIMIT)}...`}
                    </p>
                    {item.description && item.description.length > DESCRIPTION_PREVIEW_LIMIT ? (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(item.id)}
                        className="mt-1 text-[12px] text-[#6B8067]"
                      >
                        {expandedMap[item.id] ? '收起' : '查看'}
                      </button>
                    ) : null}
                  </>
                )}

                <p className="text-[11px] text-[#858C88] mt-2">提交时间：{formatLocalDateTime(item.created_at)}</p>
                <p className="text-[11px] text-[#858C88] mt-1">最后修改：{formatLocalDateTime(item.updated_at)}</p>
                {item.status === 'completed' && item.completed_at ? (
                  <p className="text-[11px] text-[#858C88] mt-1">完成时间：{formatLocalDateTime(item.completed_at)}</p>
                ) : null}
                {item.status === 'completed' && item.completed_version ? (
                  <p className="text-[11px] text-[#858C88] mt-1">完成版本：{item.completed_version}</p>
                ) : null}
                {isAdmin ? (
                  <p className="text-[11px] text-[#858C88] mt-1">
                    提交人：{item.submitter?.display_name || item.submitter?.username || '未知用户'}
                  </p>
                ) : null}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {item.user_id === user?.id ? (
                    <>
                      {editingId !== item.id ? (
                        <button
                          type="button"
                          onClick={() => handleEditStart(item)}
                          className="min-h-10 px-3 rounded-lg border border-[#D5DCD2] text-[12px] text-[#2C332F]"
                        >
                          编辑
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        disabled={deletingId === item.id}
                        className="min-h-10 px-3 rounded-lg border border-[#E5C5C1] text-[12px] text-[#8A3B34] disabled:opacity-55"
                      >
                        {deletingId === item.id ? '删除中...' : '删除'}
                      </button>
                    </>
                  ) : null}

                  {isAdmin ? (
                    item.status === 'pending' ? (
                      <>
                        <select
                          value={completeVersionMap[item.id] || ''}
                          onChange={(event) => {
                            setCompleteVersionMap((prev) => ({
                              ...prev,
                              [item.id]: event.target.value,
                            }));
                            setCompleteVersionErrors((prev) => ({ ...prev, [item.id]: '' }));
                          }}
                          className="min-h-10 rounded-lg border border-[#D5DCD2] bg-white px-2 text-[12px] text-[#2C332F]"
                        >
                          <option value="">选择完成版本</option>
                          {availableVersions.map((version) => (
                            <option key={version} value={version}>{version}</option>
                          ))}
                        </select>

                        <button
                          type="button"
                          disabled={Boolean(updatingStatusId)}
                          onClick={() => handleComplete(item)}
                          className="min-h-10 px-3 rounded-lg bg-[#2C332F] text-white text-[12px] disabled:opacity-55"
                        >
                          {updatingStatusId === item.id ? '处理中...' : '标记为已完成'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(updatingStatusId)}
                        onClick={() => handleReopen(item)}
                        className="min-h-10 px-3 rounded-lg border border-[#D5DCD2] text-[12px] text-[#2C332F] disabled:opacity-55"
                      >
                        {updatingStatusId === item.id ? '处理中...' : '恢复为未完成'}
                      </button>
                    )
                  ) : null}
                </div>

                {isAdmin && item.status === 'pending' && completeVersionErrors[item.id] ? (
                  <p className="text-[12px] text-[#A8483E] mt-1">{completeVersionErrors[item.id]}</p>
                ) : null}
              </article>
            ))}

            {!loadingHistory && !historyError && history.length > 0 && hasMore ? (
              <div className="px-4 py-3 border-t border-[#F0EFE9]">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={loadMoreHistory}
                  className="w-full min-h-11 rounded-lg border border-[#D5DCD2] text-[13px] text-[#2C332F] disabled:opacity-55"
                >
                  {loadingMore ? '加载中...' : '查看更多'}
                </button>
              </div>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
        if (!open && !deletingId) {
          setDeleteTarget(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除修改意见？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将无法恢复，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={Boolean(deletingId)}
              className="bg-[#A8483E] hover:bg-[#923D36]"
            >
              {deletingId ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
