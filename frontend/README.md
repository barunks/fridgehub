# FamilyHub Frontend

Vite React + TypeScript frontend for the FamilyHub command center. It hydrates from `VITE_API_URL` when available and falls back to local demo data when the backend is offline.

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
```

See the root `README.md` for the document analysis, implementation scope, and backend integration map.
