# FridgeHub Frontend

Vite React + TypeScript frontend for the FridgeHub command center. It hydrates authenticated app state from `VITE_API_URL`; local demo data is only the pre-auth/session placeholder.

Implemented UI platform features:

- React Router routes for dashboard, tasks, groceries, meals, family, assistant, and implementation views.
- In-memory access-token handling with HttpOnly refresh-cookie rotation through the backend.
- Rollback-aware optimistic updates for the main mutation workflows.
- Persistent light/dark theme toggle.
- Drag-and-drop task reassignment board powered by `@dnd-kit`.
- Lazy-loaded Recharts analytics for household operations.
- Playwright E2E tests for routing, theme persistence, and drag/drop behavior.

```bash
npm install
npm run dev
```

Optional API override:

```bash
VITE_API_URL=http://localhost:8000 npm run dev
```

Verification:

```bash
npm run build
npm run lint
npm run test:e2e
```

See the root `README.md` for the document analysis, implementation scope, and backend integration map.
