import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  envPrefix: ['VITE_', 'API_URL'],
  build: {
    copyPublicDir: !isSsrBuild,
    ...(isSsrBuild ? { rollupOptions: { output: { entryFileNames: '[name].mjs' } } } : {}),
  },
}))
