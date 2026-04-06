import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import https from 'https'; // ❗ 이 한 줄을 추가해주세요

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brandingConfigPath = path.resolve(
  __dirname,
  'src/lib/branding/branding.config.json',
);
const branding = JSON.parse(
  fs.readFileSync(brandingConfigPath, 'utf8'),
) as {
  publicBrandName: string;
  publicOrigin: string;
  apiOrigin: string;
};

const apiOrigin = branding.apiOrigin.replace(/\/+$/, '');

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
      output: {
        manualChunks(id) {
          // three.js + VRM 관련 → 별도 chunk (VRM/Live2D 페이지에서만 로드)
          if (id.includes('node_modules/three') || id.includes('node_modules/@pixiv/three-vrm')) {
            return 'vendor-three';
          }
          // Markdown 파싱 → 별도 chunk (채팅 페이지에서만 로드)
          if (id.includes('node_modules/marked') || id.includes('node_modules/isomorphic-dompurify') || id.includes('node_modules/dompurify')) {
            return 'vendor-markdown';
          }
        },
      },
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
        target: apiOrigin,
        changeOrigin: true,
        agent: new https.Agent({ keepAlive: true }),
      },

      '/ws': {
        target: apiOrigin,
        ws: true,
        secure: false,
        changeOrigin: true,
      },
      'health': {
        target: apiOrigin,
        changeOrigin: true,
        agent: new https.Agent({ keepAlive: true }),
      },
      '/storage': {
        target: 'https://uohepkqmwbstbmnkoqju.supabase.co',
        changeOrigin: true,
        secure: false,
      },
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  esbuild: {
    target: "es2022"
  },
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
    esbuildOptions: {
      target: "es2022",
    },
  }
});
