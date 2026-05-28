import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
	appName: 'perochat',
	brand: {
		displayName: 'PeroChat',
		primaryColor: '#a855f7',
		icon: './static/logo.png',
	},
	web: {
		host: 'localhost',
		port: 5173,
		commands: {
			dev: 'npm run dev:web',
			build: 'npm run build:web',
		},
	},
	permissions: [],
	outdir: 'build',
	webViewProps: {
		type: 'partner',
		allowsInlineMediaPlayback: true,
		mediaPlaybackRequiresUserAction: false,
		bounces: false,
		pullToRefreshEnabled: false,
		overScrollMode: 'never',
		allowsBackForwardNavigationGestures: true,
	},
});
