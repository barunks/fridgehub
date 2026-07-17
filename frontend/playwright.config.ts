import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'cd ../backend && rm -f e2e_fridgehub.db && PYTHON_BIN=../.venv/bin/python && if [ ! -x "$PYTHON_BIN" ]; then PYTHON_BIN=python; fi && PYTHONPATH=. DATABASE_URL=sqlite:///./e2e_fridgehub.db CORS_ORIGINS=http://127.0.0.1:5174,http://localhost:5174 LOGIN_RATE_LIMIT_PER_MINUTE=1000 "$PYTHON_BIN" -m uvicorn app.main:app --host 127.0.0.1 --port 8100',
      reuseExistingServer: false,
      timeout: 30_000,
      url: 'http://127.0.0.1:8100/health',
    },
    {
      command: 'VITE_API_URL=http://127.0.0.1:8100 npm run dev -- --host 127.0.0.1 --port 5174',
      reuseExistingServer: false,
      timeout: 30_000,
      url: 'http://127.0.0.1:5174',
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
