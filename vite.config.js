import { defineConfig } from 'vite'

// base './' → rutas relativas, para servir bajo el subdominio sudoku.closer.click
// (y también bajo el mirror closerclick.github.io/sudoku/). Los assets PWA viven
// en public/ y se copian tal cual a la raíz de dist/.
export default defineConfig({
  base: './',
  server: { port: 3300, host: true }
})
