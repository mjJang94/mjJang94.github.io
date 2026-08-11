// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 저장소 이름이 mjJang94.github.io 인 경우: site만 설정하고 base는 생략합니다.
// 저장소 이름이 portfolio 등 일반 저장소인 경우: base를 함께 설정합니다.
export default defineConfig({
  site: 'https://mjJang94.github.io',
  // base: '/portfolio',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
  },
});
