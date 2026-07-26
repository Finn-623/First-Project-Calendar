import { APP_VERSION_META } from './appVersion';

export const VERSION_HISTORY_ENTRIES = [
  {
    version: APP_VERSION_META.version,
    status: APP_VERSION_META.status,
    releasedAt: APP_VERSION_META.releasedAt,
    summary: APP_VERSION_META.summary,
    docPath: `docs/version-updates/v${APP_VERSION_META.version}.md`,
  },
];
