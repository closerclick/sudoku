import { defineConfig, devices } from '@playwright/test'

// E2E sobre el build de producción servido por `vite preview`. El store
// (store.closer.click) puede no estar disponible en test → la app cae al shim de
// localStorage. Los tests conducen la app por window.__sudoku + data-testid.
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 7000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
