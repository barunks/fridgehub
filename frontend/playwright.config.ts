import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'cd ../backend && PYTHONPATH=. DATABASE_URL=sqlite:///./e2e_familyhub.db python -m uvicorn app.main:app --host 127.0.0.1 --port 8000',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      url: 'http://127.0.0.1:8000/health',
    },
    {
      command: 'VITE_API_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      url: 'http://127.0.0.1:5173',
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
