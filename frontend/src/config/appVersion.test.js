import { APP_VERSION_META, validateAppVersionMeta } from './appVersion';

describe('appVersion config', () => {
  test('should pass with current config', () => {
    const result = validateAppVersionMeta(APP_VERSION_META);
    expect(result.valid).toBe(true);
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
