import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useStore } from '../store';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { versionFeedbackService } from '../services/versionFeedbackService';
import { validateFeedbackForm } from '../lib/versionFeedbackValidation';
import {
  formatLocalDateTime,
  getFeedbackStatusLabel,
  getFeedbackStatusVariant,
} from '../lib/versionInfoUtils';

export const VersionFeedbackPage = () => {
  const { user, profile } = useStore();
  const [activeTab, setActiveTab] = useState('submit');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [history, setHistory] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [errors, setErrors] = useState({});

  const isAdmin = useMemo(() => {
    return profile?.role === 'admin' || profile?.is_admin === true;
  }, [profile?.is_admin, profile?.role]);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;

    setLoadingHistory(true);
    setHistoryError('');

    const result = await versionFeedbackService.listFeedback({
      userId: user.id,
      isAdmin,
    });

    if (!result.success) {
      setHistoryError(result.error || '建议历史加载失败，请稍后重试');
      setLoadingHistory(false);
      return;
    }

    setHistory(result.data || []);
    setLoadingHistory(false);
  }, [isAdmin, user?.id]);

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
    toast.success('修改意见已提交');
    setActiveTab('history');
    await loadHistory();
  };

  const handleStatusUpdate = async (id, status) => {
    if (!isAdmin || updatingId) return;

    setUpdatingId(id);

    const result = await versionFeedbackService.updateFeedbackStatus({
      feedbackId: id,
      status,
    });

    if (!result.success) {
      toast.error(result.error || '状态更新失败，请稍后重试');
      setUpdatingId('');
      return;
    }

    setUpdatingId('');
    toast.success(status === 'completed' ? '任务已标记为已完成' : '任务已恢复为未完成');
    await loadHistory();
  };

  useEffect(() => {
    if (activeTab !== 'history') return;
    if (!history.length && !loadingHistory && !historyError) {
      loadHistory();
    }
  }, [activeTab, history.length, historyError, loadHistory, loadingHistory]);

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
                <p className="text-[13px] text-[#A8483E]">{historyError}</p>
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
              <p className="px-4 py-3 text-[13px] text-[#6A6F6C]">暂无修改意见</p>
            ) : null}

            {!loadingHistory && !historyError && history.map((item) => (
              <article key={item.id} className="px-4 py-3 border-b border-[#F0EFE9] last:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] text-[#2C332F] font-medium break-all">{item.title}</p>
                  <Badge variant={getFeedbackStatusVariant(item.status)}>{getFeedbackStatusLabel(item.status)}</Badge>
                </div>

                <p className="text-[13px] text-[#46504B] mt-2 whitespace-pre-wrap break-words">{item.description}</p>
                <p className="text-[11px] text-[#858C88] mt-2">提交时间：{formatLocalDateTime(item.created_at)}</p>
                {item.status === 'completed' && item.completed_at ? (
                  <p className="text-[11px] text-[#858C88] mt-1">完成时间：{formatLocalDateTime(item.completed_at)}</p>
                ) : null}
                {isAdmin ? (
                  <p className="text-[11px] text-[#858C88] mt-1">
                    提交人：{item.submitter?.display_name || item.submitter?.username || '未知用户'}
                  </p>
                ) : null}

                {isAdmin ? (
                  <div className="mt-2 flex items-center gap-2">
                    {item.status === 'pending' ? (
                      <button
                        type="button"
                        disabled={Boolean(updatingId)}
                        onClick={() => handleStatusUpdate(item.id, 'completed')}
                        className="min-h-10 px-3 rounded-lg bg-[#2C332F] text-white text-[12px] disabled:opacity-55"
                      >
                        {updatingId === item.id ? '处理中...' : '标记为已完成'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(updatingId)}
                        onClick={() => handleStatusUpdate(item.id, 'pending')}
                        className="min-h-10 px-3 rounded-lg border border-[#D5DCD2] text-[12px] text-[#2C332F] disabled:opacity-55"
                      >
                        {updatingId === item.id ? '处理中...' : '恢复为未完成'}
                      </button>
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
