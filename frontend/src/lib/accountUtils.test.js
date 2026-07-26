import {
  MIN_PASSWORD_LENGTH,
  mapPasswordErrorMessage,
  mapAccountStatusLabel,
  mapRoleLabel,
  validateDisplayNameInput,
  validatePasswordForm,
} from './accountUtils';

describe('accountUtils', () => {
  test('validateDisplayNameInput should trim and reject empty value', () => {
    const result = validateDisplayNameInput('   ');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('展示名称不能为空');
  });

  test('validateDisplayNameInput should accept valid value', () => {
    const result = validateDisplayNameInput('  Finn 用户  ');
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe('Finn 用户');
  });

  test('validatePasswordForm should enforce mismatch and same password rule', () => {
    const result = validatePasswordForm({
      currentPassword: 'old-password',
      nextPassword: 'old-password',
      confirmPassword: 'new-password',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.nextPassword).toBe('新密码不能与现有密码相同');
    expect(result.errors.confirmPassword).toBe('两次输入的新密码不一致');
  });

  test('validatePasswordForm should reject password shorter than minimum length', () => {
    const result = validatePasswordForm({
      currentPassword: 'old',
      nextPassword: 'ab',
      confirmPassword: 'ab',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.nextPassword).toBe(`密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符`);
  });

  test('validatePasswordForm should allow minimum length password', () => {
    const result = validatePasswordForm({
      currentPassword: 'old',
      nextPassword: 'abc',
      confirmPassword: 'abc',
    });

    expect(result.errors.nextPassword).toBeUndefined();
  });

  test('validatePasswordForm should allow password longer than minimum length', () => {
    const result = validatePasswordForm({
      currentPassword: 'old',
      nextPassword: 'abcdef',
      confirmPassword: 'abcdef',
    });

    expect(result.errors.nextPassword).toBeUndefined();
  });

  test('mapRoleLabel should map admin and user', () => {
    expect(mapRoleLabel({ role: 'admin' })).toBe('管理员');
    expect(mapRoleLabel({ role: 'user' })).toBe('普通用户');
  });

  test('mapAccountStatusLabel should map known statuses', () => {
    expect(mapAccountStatusLabel({ account_status: 'active' }, { id: '1' })).toBe('正常');
    expect(mapAccountStatusLabel({ account_status: 'disabled' }, { id: '1' })).toBe('已停用');
    expect(mapAccountStatusLabel({ account_status: 'pending' }, { id: '1' })).toBe('待确认');
  });

  test('mapPasswordErrorMessage should keep product minimum message even when backend returns another value', () => {
    const msg = mapPasswordErrorMessage({ message: 'Password should be at least 6 characters.' });
    expect(msg).toBe(`密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符`);
  });
});
