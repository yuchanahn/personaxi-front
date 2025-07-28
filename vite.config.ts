import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // SSR 비활성화
  ssr: {
    noExternal: ['@pixiv/three-vrm', 'three'], // SSR에서 Three.js 및 three-vrm을 제외
  },
  build: {
    // 클라이언트 측 빌드만 진행
    ssr: false, // SSR 빌드 비활성화
    ssrManifest: false, // SSR 매니페스트 생성 비활성화
    rollupOptions: {
      // Three.js WebGPU 모듈을 클라이언트 측에서만 로드
      external: ['three/build/three.webgpu.js'],
    },
    target: 'esnext',
  },
  resolve: {
    dedupe: ['three'], // 👈 이거!
  },
  plugins: [
    tailwindcss(),
    sveltekit(),
  ],
  server: {
    proxy: {
      // '/api'로 시작하는 모든 요청을 실제 API 서버로 전달합니다.
      '/api': {
        target: 'https://api.personaxi.com',
        changeOrigin: true,
      },
      '/auth': {
        target: 'https://api.personaxi.com',
        changeOrigin: true,
      },
      '/ws': {
        target: 'wss://api.personaxi.com',
        ws: true,
      },
      'health': {
        target: 'https://api.personaxi.com',
        changeOrigin: true,
      },
    }
  },
  esbuild: {
    target: "es2022"
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2022",
    },
  }
});