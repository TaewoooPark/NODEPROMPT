import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//
// 각 LLM 프로바이더의 브라우저 CORS를 우회하기 위한 개발용 프록시.
// 프로덕션 배포시에는 서버사이드 프록시로 대체해야 한다.

const PROVIDER_PROXIES = [
  { path: '/api/anthropic', target: 'https://api.anthropic.com' },
  { path: '/api/openai',    target: 'https://api.openai.com' },
  { path: '/api/gemini',    target: 'https://generativelanguage.googleapis.com' },
  { path: '/api/xai',       target: 'https://api.x.ai' },
  { path: '/api/deepseek',  target: 'https://api.deepseek.com' },
  { path: '/api/qwen',      target: 'https://dashscope-intl.aliyuncs.com' },
] as const;

function buildProxy() {
  const out: Record<string, import('vite').ProxyOptions> = {};
  for (const { path, target } of PROVIDER_PROXIES) {
    out[path] = {
      target,
      changeOrigin: true,
      rewrite: (p) => p.replace(new RegExp(`^${path}`), ''),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          // 브라우저 CORS 헤더 제거 → 각 API가 서버 요청으로 인식
          proxyReq.removeHeader('origin');
          proxyReq.removeHeader('referer');
        });
      },
    };
  }
  return out;
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: buildProxy(),
  },
})
