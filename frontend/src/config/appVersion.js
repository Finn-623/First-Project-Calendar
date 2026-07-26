import packageJson from '../../package.json';
import versionConfig from './version.config.json';

export const APP_VERSION_META = {
	version: packageJson.version,
	status: versionConfig.status,
	releasedAt: versionConfig.releasedAt,
	summary: versionConfig.summary,
};

export const APP_VERSION = `v${APP_VERSION_META.version}`;

export function validateAppVersionMeta(meta = APP_VERSION_META) {
	if (!meta?.version || meta.version !== packageJson.version) {
		return {
			valid: false,
			error: '版本配置与 package.json version 不一致',
		};
	}

	if (meta.status === 'released' && !meta.releasedAt) {
		return {
			valid: false,
			error: 'released 状态必须提供 releasedAt',
		};
	}

	return { valid: true, error: '' };
}