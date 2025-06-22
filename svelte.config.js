import adapter from '@sveltejs/adapter-static';

export default {
	ssr: false, // 루트 수준에서 ssr 설정
	kit: {
		adapter: adapter({
			strict: false,
			fallback: 'index.html'
		}),
		paths: {
			base: ''
		},
		prerender: {
			entries: []
		},
	},
};
