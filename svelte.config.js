import adapter from '@sveltejs/adapter-static';

export default {
	ssr: false, // 루트 수준에서 ssr 설정
	kit: {
		adapter: adapter({
			strict: false,
			fallback: 'index.html',
			precompress: true  // gzip/brotli 압축 활성화
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
				'/terms',
				'/policy',
				'/licenses',
				'/tutorial',
				'/login'
			]
		},
	},
};
