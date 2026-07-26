export const DISPLAY_NAME_MIN_LEN = 1;
export const DISPLAY_NAME_MAX_LEN = 30;
export const PASSWORD_MIN_LEN = 8;

export function normalizeDisplayName(value) {
  return String(value || '').trim();
}

export function validateDisplayNameInput(value) {
  const normalized = normalizeDisplayName(value);

  if (!normalized) {
    return { isValid: false, normalized, error: '展示名称不能为空' };
  }

  if (normalized.length < DISPLAY_NAME_MIN_LEN) {
    return { isValid: false, normalized, error: '展示名称不能为空' };
  }

  if (normalized.length > DISPLAY_NAME_MAX_LEN) {
    return { isValid: false, normalized, error: `展示名称不能超过${DISPLAY_NAME_MAX_LEN}个字符` };
  }

  return { isValid: true, normalized, error: '' };
}

export function mapRoleLabel(profile) {
  const rawRole = String(profile?.role || '').toLowerCase();
  if (rawRole === 'admin' || profile?.is_admin === true) return '管理员';
  return '普通用户';
}

export function mapAccountStatusLabel(profile, user) {
  const raw = String(profile?.account_status || profile?.status || '').toLowerCase();

  if (raw === 'disabled') return '已停用';
  if (raw === 'pending') return '待确认';
  if (raw === 'active') return '正常';
  if (raw === 'locked') return '已锁定';

  return user ? '正常' : '未知';
}

export function validatePasswordForm({ currentPassword, nextPassword, confirmPassword }) {
  const errors = {};

  if (!currentPassword) {
    errors.currentPassword = '请输入现有密码';
  }

  if (!nextPassword) {
    errors.nextPassword = '请输入新密码';
  }

  if (!confirmPassword) {
    errors.confirmPassword = '请再次输入新密码';
  }

  if (nextPassword && nextPassword.length < PASSWORD_MIN_LEN) {
    errors.nextPassword = `新密码至少需要${PASSWORD_MIN_LEN}个字符`;
  }

  if (nextPassword && currentPassword && nextPassword === currentPassword) {
    errors.nextPassword = '新密码不能与现有密码相同';
  }

  if (nextPassword && confirmPassword && nextPassword !== confirmPassword) {
    errors.confirmPassword = '两次输入的新密码不一致';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function mapPasswordErrorMessage(error) {
  const message = String(error?.message || '');
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return '现有密码不正确';
  }

  if (normalized.includes('session') || normalized.includes('jwt') || normalized.includes('token')) {
    return '会话已过期，请重新登录';
  }

  if (normalized.includes('password') && normalized.includes('least')) {
    return `新密码至少需要${PASSWORD_MIN_LEN}个字符`;
  }

  if (normalized.includes('network') || normalized.includes('fetch')) {
    return '网络错误，请检查网络后重试';
  }

  return '密码更新失败，请稍后重试';
}

export function mapDisplayNameUpdateError(error) {
  const message = String(error?.message || '');
  const normalized = message.toLowerCase();

  if (normalized.includes('network') || normalized.includes('fetch')) {
    return '网络错误，请检查网络后重试';
  }

  if (normalized.includes('permission') || normalized.includes('rls') || normalized.includes('policy')) {
    return '当前账号无权限修改展示名称';
  }

  if (normalized.includes('session') || normalized.includes('jwt') || normalized.includes('token')) {
    return '会话已过期，请重新登录';
  }

  return '展示名称保存失败，请稍后重试';
}
