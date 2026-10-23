import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

// Флаги сборки Phaser (как DefinePlugin в его webpack): что включить, что выкинуть.
const PHASER_FLAGS: Record<string, boolean> = {
  CANVAS_RENDERER: true,
  WEBGL_RENDERER: true,
  WEBGL_DEBUG: false,
  FEATURE_SOUND: false,
  PLUGIN_CAMERA3D: false,
  PLUGIN_FBINSTANT: false,
};

function phaserFlags(): Plugin {
  const re = new RegExp(`typeof (${Object.keys(PHASER_FLAGS).join('|')})\\b`, 'g');
  return {
    name: 'phaser-flags',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/phaser/src/') && !id.includes('phaser-lite')) return null;
      if (!re.test(code)) return null;
      return { code: code.replace(re, (_, k: string) => String(PHASER_FLAGS[k])), map: null };
    },
  };
}

// base: './' — относительные пути, чтобы сборку из dist/ можно было загрузить архивом на Яндекс Игры и VK.
export default defineConfig(({ command }) => ({
  base: './',
  plugins: command === 'build' ? [phaserFlags()] : [],
  // В сборке Phaser собирается из исходников без физики, тайлмапов и своего звука.
  resolve: command === 'build' ? { alias: [{ find: /^phaser$/, replacement: fileURLToPath(new URL('./src/phaser-lite.cjs', import.meta.url)) }] } : {},
  build: {
    chunkSizeWarningLimit: 2000,
    commonjsOptions: { include: [/node_modules/, /phaser-lite/], transformMixedEsModules: true },
  },
}));
