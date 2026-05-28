import { env } from '$env/dynamic/public';

const ABSOLUTE_URL_RE = /^(https?:)?\/\//i;

function normalizeBaseUrl(value: string | undefined): string {
	return (value || '').trim().replace(/\/+$/, '');
}

export function resolveStaticAssetPath(path: string): string {
	const normalizedPath = path.trim();

	if (
		!normalizedPath ||
		ABSOLUTE_URL_RE.test(normalizedPath) ||
		normalizedPath.startsWith('data:') ||
		normalizedPath.startsWith('blob:')
	) {
		return normalizedPath;
	}

	const assetBaseUrl = normalizeBaseUrl(
		env.PUBLIC_STATIC_ASSET_BASE || env.PUBLIC_TOSS_ASSET_BASE,
	);

	if (!assetBaseUrl) {
		return normalizedPath;
	}

	return `${assetBaseUrl}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
}
