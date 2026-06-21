import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-static-html',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url?.split('?')[0]
          if (url === '/review' || url === '/review/') {
            const filePath = path.resolve(__dirname, 'public/review/index.html')
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(fs.readFileSync(filePath))
            return
          }
          next()
        })
      },
    },
  ],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
  },
})