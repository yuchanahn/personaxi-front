import adapter from '@sveltejs/adapter-static';

const isAndroidBuild = process.env.npm_lifecycle_event === 'build:android';

export default {
	ssr: false, // 루트 수준에서 ssr 설정
	kit: {
		adapter: adapter({
			strict: false,
			fallback: 'index.html',
			precompress: !isAndroidBuild  // Android asset merge avoids .gz/.br duplicates
		}),
		paths: {
			base: ''
		},
		prerender: {
			// 정적 페이지들 - 검색 엔진이 직접 HTML을 읽을 수 있음
			entries: [
				'/',
				'/hub',
				'/feed',
				'/tutorial',
				'/login'
			]
		},
	},
};
