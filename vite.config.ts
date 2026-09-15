import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1' },
  plugins: [
    react(),
    electron({
      main: { entry: 'electron/main.ts', vite: { build: { outDir: 'dist-electron' } } },
      preload: { input: 'electron/preload.ts', vite: { build: { outDir: 'dist-electron' } } },
    }),
  ],
  build: { outDir: 'dist' },
  test: { environment: 'node' } as any,
})
