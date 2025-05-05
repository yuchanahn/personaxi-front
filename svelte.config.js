import adapter from '@sveltejs/adapter-static';

export default {
	kit: {
		adapter: adapter({
			strict: false
		}),
		paths: {
			base: '/personaxi-front' // 너의 리포지토리 이름이랑 정확히 일치해야 함
		},
		prerender: {
			entries: ['*']
		}
	}
};
