import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'firebase';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router') || id.includes('node_modules/framer-motion')) return 'vendor';
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        name: 'Party Hub — เกมปาร์ตี้ออนไลน์',
        short_name: 'Party Hub',
        description: 'รวมเกมปาร์ตี้สุดสนุก เล่นกับเพื่อนได้ทุกที่',
        theme_color: '#f4f5ee',
        background_color: '#f4f5ee',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/partyhub/',
        scope: '/partyhub/',
        icons: [
          { src: '/partyhub/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/partyhub/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/partyhub/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/partyhub/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  base: '/partyhub/',
})
