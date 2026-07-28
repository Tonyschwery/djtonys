import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Vite's dev server does not resolve "folder -> index.html" for files inside
// the public folder, so visiting /blog/ would fall through to the homepage.
// Real hosts (Netlify, Vercel, etc.) do resolve it, so this plugin just makes
// local development behave the same way the live site will.
function serveStaticBlogPages() {
  return {
    name: 'serve-static-blog-pages',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]

        if (!url.startsWith('/blog')) return next()

        // Work out which file on disk this URL is asking for.
        const relative = url.endsWith('/') ? path.join(url, 'index.html') : url
        const filePath = path.join(server.config.publicDir, relative)

        // If it isn't an existing file, let Vite handle it normally.
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          return next()
        }

        const contentType = filePath.endsWith('.css')
          ? 'text/css'
          : 'text/html'

        res.setHeader('Content-Type', `${contentType}; charset=utf-8`)
        res.end(fs.readFileSync(filePath))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveStaticBlogPages()],
})
