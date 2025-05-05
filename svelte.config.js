// svelte.config.js
import adapter from '@sveltejs/adapter-static';

export default {
	kit: {
		adapter: adapter(),
		paths: {
			base: '', // GitHub Pages 하위 경로일 경우 '/repo-name'
		},
		prerender: {
			entries: ['*'] // 🔥 기본값. '*'는 모든 경로를 정적 빌드 대상으로 포함
		}
	}
};
