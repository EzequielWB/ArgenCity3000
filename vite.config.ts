import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  server: { port: 5273 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  plugins: [
    VitePWA({
      // El SW se actualiza solo cuando hay un build nuevo; el juego no guarda estado fuera de
      // localStorage, así que el auto-update no puede perder nada.
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.woff2', 'icons/*.png', 'favicon.svg'],
      manifest: {
        name: 'ArgenCity 3000',
        short_name: 'ArgenCity',
        description: 'City-builder isométrico para navegador con identidad argentina.',
        lang: 'es',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0a241b',
        background_color: '#0a241b',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Los nueve mapas reales suman 1,7 MB: entran al precache y son la diferencia entre
        // "abre sin conexión" y "no abre sin conexión". Ningún archivo pasa de 263 KB.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
      },
      devOptions: { enabled: false },
    }),
  ],
});
