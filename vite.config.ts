import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import plosMockApi from './mock/apiPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    // PLOS mock backend — /api/* isteklerini karşılar, veriler mock/db.json'da
    plosMockApi(),
  ],
  server: {
    proxy: {
      // Finans API — tarayıcı same-origin görür, CORS ve self-signed sertifika sorunu olmaz
      '/finance-api': {
        target: 'https://localhost:7297',
        changeOrigin: true,
        secure: false,
        rewrite: p => p.replace(/^\/finance-api/, ''),
      },
    },
  },
})
