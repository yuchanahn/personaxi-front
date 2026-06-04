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

	// Prioritize PUBLIC_CDN_URL, fallback to STATIC/TOSS asset base, then use default Supabase CDN bucket
	const assetBaseUrl = normalizeBaseUrl(
		env.PUBLIC_CDN_URL ||
		env.PUBLIC_STATIC_ASSET_BASE ||
		env.PUBLIC_TOSS_ASSET_BASE ||
		'https://uohepkqmwbstbmnkoqju.supabase.co/storage/v1/object/public/assets'
	);

	if (!assetBaseUrl) {
		return normalizedPath;
	}

	return `${assetBaseUrl}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
}
