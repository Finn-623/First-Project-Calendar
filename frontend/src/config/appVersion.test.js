import { APP_VERSION, APP_VERSION_META, validateAppVersionMeta } from './appVersion';

describe('appVersion config', () => {
  test('should pass with current config', () => {
    const result = validateAppVersionMeta(APP_VERSION_META);
    expect(result.valid).toBe(true);
    expect(APP_VERSION).toBe('v0.1.3');
  });

  test('released without releasedAt should fail', () => {
    const result = validateAppVersionMeta({
      ...APP_VERSION_META,
      status: 'released',
      releasedAt: null,
    });

    expect(result.valid).toBe(false);
  });
});
