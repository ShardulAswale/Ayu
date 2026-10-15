import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Ayu/',
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: [],
    manifest: {
      name: 'Ayu — Nutrition Care', short_name: 'Ayu',
      description: 'Nutrition care, thoughtfully connected.',
      theme_color: '#153e35', background_color: '#f6f8f4',
      display: 'standalone', start_url: '/Ayu/', scope: '/Ayu/',
      icons: [{ src: '/Ayu/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
    },
    workbox: { globPatterns: ['**/*.{js,css,html,svg}'], navigateFallback: '/Ayu/index.html', runtimeCaching: [] }
  })],
});
