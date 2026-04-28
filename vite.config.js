import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const INPUT_ENTRIES = {
  background: path.resolve(__dirname, 'src/background/index.js'),
  content: path.resolve(__dirname, 'src/content/index.js'),
  intercept: path.resolve(__dirname, 'src/content/intercept.js'),
  isolation: path.resolve(__dirname, 'src/content/isolation.js'),
  popup: path.resolve(__dirname, 'src/popup/app/main.jsx'),
}

const STATIC_COPY_TARGETS = [
  { from: 'images', to: 'images' },
  { from: 'styles', to: 'styles' },
  { from: 'assets', to: 'assets' },
  { from: 'src/popup/assets', to: 'assets' },
]

function rewritePopupHtml(rawHtml) {
  return rawHtml
    .replace(/<link\s+href="assets\/dist\/css\/bootstrap\.min\.css"\s+rel="stylesheet">\n?/g, '')
    .replace(/<script\s+src="assets\/dist\/js\/bootstrap\.bundle\.min\.js"><\/script>\n?/g, '')
    .replace('src="./src/popup/index.js"', 'src="./popup.js"')
    .replace('</head>', '  <link rel="stylesheet" href="./assets/style.css">\n</head>')
}

function rewriteManifest(rawManifest) {
  const manifest = JSON.parse(rawManifest)

  if (!manifest.background) {
    manifest.background = {}
  }

  manifest.background.service_worker = 'background.js'
  delete manifest.background.type

  if (Array.isArray(manifest.content_scripts) && manifest.content_scripts[0]) {
    manifest.content_scripts[0].js = ['content.js']
  }

  if (Array.isArray(manifest.web_accessible_resources) && manifest.web_accessible_resources[0]) {
    manifest.web_accessible_resources[0].resources = ['intercept.js']
  }

  if (!manifest.action) {
    manifest.action = {}
  }

  manifest.action.default_popup = 'popup.html'

  return JSON.stringify(manifest, null, 2)
}

function copyRecursive(source, target) {
  if (!fs.existsSync(source)) {
    return
  }

  const stats = fs.statSync(source)

  if (stats.isDirectory()) {
    fs.mkdirSync(target, { recursive: true })

    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry))
    }

    return
  }

  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(source, target)
}

function mv3CopyPlugin() {
  return {
    name: 'mv3-copy-plugin',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist')
      const popupSourcePath = path.resolve(__dirname, 'popup.html')
      const popupTargetPath = path.join(distDir, 'popup.html')
      const manifestSourcePath = path.resolve(__dirname, 'manifest.json')
      const manifestTargetPath = path.join(distDir, 'manifest.json')

      const popupHtml = fs.readFileSync(popupSourcePath, 'utf8')
      fs.writeFileSync(popupTargetPath, rewritePopupHtml(popupHtml), 'utf8')

      const manifestRaw = fs.readFileSync(manifestSourcePath, 'utf8')
      fs.writeFileSync(manifestTargetPath, rewriteManifest(manifestRaw), 'utf8')

      for (const target of STATIC_COPY_TARGETS) {
        const fromPath = path.resolve(__dirname, target.from)
        const toPath = path.join(distDir, target.to)
        copyRecursive(fromPath, toPath)
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), mv3CopyPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: mode !== 'production',
    minify: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: INPUT_ENTRIES,
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
}))
