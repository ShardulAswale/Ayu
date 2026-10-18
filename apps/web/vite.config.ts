import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const base = loadEnv(mode, '.', 'VITE_').VITE_BASE_PATH || '/';
  return {
  base,
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: [],
    manifest: {
      name: 'Ayu — Nutrition Care', short_name: 'Ayu',
      description: 'Nutrition care, thoughtfully connected.',
      theme_color: '#153e35', background_color: '#f6f8f4',
      display: 'standalone', start_url: base, scope: base,
      icons: [{ src: `${base}icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg}'],
      navigateFallback: `${base}index.html`,
      // Sensitive application routes must be served from the network.
      navigateFallbackDenylist: [/^\/login(?:\/|$)/, /^\/dashboard(?:\/|$)/, /^\/api(?:\/|$)/],
      cleanupOutdatedCaches: true, skipWaiting: true, clientsClaim: true,
      runtimeCaching: [],
    }
  })],
  };
});
