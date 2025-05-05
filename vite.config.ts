import { sveltekit } from '@sveltejs/kit/vite';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [sveltekit()],
  base: '/personaxi-front/' // ✅ 이거도 필요함!
};

export default config;
