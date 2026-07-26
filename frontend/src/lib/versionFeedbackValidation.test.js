import {
  validateCompletedVersion,
  validateFeedbackForm,
  validateFeedbackStatus,
} from './versionFeedbackValidation';

describe('versionFeedbackValidation', () => {
  test('title is required', () => {
    const result = validateFeedbackForm({ title: '', description: '这是有效描述内容' });
    expect(result.valid).toBe(false);
    expect(result.errors.title).toBe('请填写建议标题');
  });

  test('description is required', () => {
    const result = validateFeedbackForm({ title: '有效标题', description: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.description).toBe('请填写详细说明');
  });

  test('whitespace-only values should fail', () => {
    const result = validateFeedbackForm({ title: '   ', description: '    ' });
    expect(result.valid).toBe(false);
    expect(result.errors.title).toBe('请填写建议标题');
    expect(result.errors.description).toBe('请填写详细说明');
  });

  test('valid input should pass with trimmed values', () => {
    const result = validateFeedbackForm({
      title: '  版本页优化建议  ',
      description: '  希望增加上线时间说明，避免与更新时间混淆。  ',
    });

    expect(result.valid).toBe(true);
    expect(result.normalized.title).toBe('版本页优化建议');
    expect(result.normalized.description).toBe('希望增加上线时间说明，避免与更新时间混淆。');
  });

  test('status validation should only allow pending and completed', () => {
    expect(validateFeedbackStatus('pending')).toBe(true);
    expect(validateFeedbackStatus('completed')).toBe(true);
    expect(validateFeedbackStatus('other')).toBe(false);
  });

  test('completed version should be required and trimmed', () => {
    const emptyResult = validateCompletedVersion('   ');
    expect(emptyResult.valid).toBe(false);
    expect(emptyResult.error).toBe('请选择完成版本');

    const validResult = validateCompletedVersion('  v0.2.0  ');
    expect(validResult.valid).toBe(true);
    expect(validResult.normalized).toBe('v0.2.0');
  });
});
