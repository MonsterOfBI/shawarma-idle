import { defineConfig } from 'vite';

// base: './' — относительные пути, чтобы сборку из dist/ можно было загрузить архивом на Яндекс Игры и VK.
export default defineConfig({
  base: './',
  // Phaser весит ~1,2 МБ; лимит Яндекса 100 МБ, так что предупреждение лишнее.
  build: { chunkSizeWarningLimit: 2000 },
});
