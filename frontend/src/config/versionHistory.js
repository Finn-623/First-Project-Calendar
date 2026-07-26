import { VERSION_RECORDS } from '../data/versionHistory';

export const VERSION_HISTORY_ENTRIES = [
  {
    version: VERSION_RECORDS[0]?.version,
    status: VERSION_RECORDS[0]?.status,
    releasedAt: VERSION_RECORDS[0]?.releaseDate,
    summary: VERSION_RECORDS[0]?.summary,
    docPath: `docs/version-updates/v${VERSION_RECORDS[0]?.version}.md`,
  },
];
