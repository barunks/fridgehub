# FamilyHub

FamilyHub is a full-stack family command center built from `docs/Family_Hub.docx` and the reference images in `docs/`.

The implementation now includes the React UI, FastAPI backend, SQLAlchemy data model, MySQL schema, Redis cache abstraction, Celery schedules, Docker deployment files, seeded meal/grocery/task templates, JWT auth/RBAC, audit logging, and tests.

## What Is Implemented

- React + TypeScript frontend with routed dashboard, groceries, meal plans, tasks, family workspace, assistant, and implementation-readiness views.
- Dark/light theme persistence, drag-and-drop task reassignment, and lazy-loaded Recharts household analytics.
- FastAPI backend with versioned REST routes under `/api/v1`.
- SQLAlchemy models for the document's core tables: users, families, family members, grocery types, frequency types, grocery list types, grocery items, purchase cycles, sub-lists, tasks, meal plans, meal templates, recipes, audit logs, and notifications.
- Extra UI-backed tables for announcements and emergency contacts.
- Seed data matching the screenshots, including all weekly meal-plan cells.
- Redis cache client with in-memory fallback for local development.
- Celery worker/beat tasks for grocery-cycle regeneration and reminder scans.
- MySQL `schema.sql`, Alembic initial migration, Dockerfiles, and `docker-compose.yml`.
- Frontend API hydration from `/api/v1/family/bootstrap`, with offline fallback to local demo state.
- JWT-protected API routes with role-aware write guards.
- Pagination, soft-delete routes, and CRUD coverage for members, recipes, emergency contacts, groceries, tasks, notifications, and announcements.

## Project Structure

```text
FamilyHub/
|-- backend/
|   |-- app/
|   |   |-- api/v1/endpoints/
|   |   |-- core/
|   |   |-- models/
|   |   |-- schemas/
|   |   |-- services/
|   |   |-- tasks/
|   |   `-- utils/
|   |-- alembic/
|   |-- sql/schema.sql
|   |-- tests/
|   |-- Dockerfile
|   |-- requirements.txt
|   `-- .env.example
|-- frontend/
|   |-- src/
|   |-- public/assets/
|   |-- Dockerfile
|   `-- package.json
|-- docs/
|-- docker-compose.yml
`-- README.md
```

## Local Development

Backend:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
PYTHONPATH=backend DATABASE_URL=sqlite:///./familyhub.db CACHE_ENABLED=false SECRET_KEY=local-dev-secret-key-at-least-32-chars uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8000
API docs: http://localhost:8000/docs
```

The frontend tries `http://localhost:8000` by default. If the backend is unavailable, it falls back to local browser state.

Frontend route map:

```text
/                 Dashboard — stat cards, today's agenda, tasks, meals, groceries, assistant, family
/tasks            Drag-and-drop assignment board
/groceries        Grocery master list and cycle tools
/meals            Weekly meal planner and recipes
/family           Members, announcements, contacts, notifications
/analytics        Household analytics — task flow, pantry coverage, calories, reward points
/assistant        Family assistant chat
/implementation   Build and deployment readiness
```

## Docker Deployment

```bash
cp .env.example .env
docker compose up --build
```

Services:

- `mysql`: MySQL 8.0 with `backend/sql/schema.sql` mounted for initial schema creation.
- `redis`: Redis 7 for cache and Celery broker/result backend.
- `backend`: FastAPI app on `http://localhost:8000`.
- `frontend`: Nginx-served React build on `http://localhost:8080`.
- `celery_worker`: background job worker.
- `celery_beat`: scheduled grocery/reminder jobs.

Replace every value in `.env` before running Docker. Compose refuses to start if `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, or `SECRET_KEY` are missing.

## API Surface

Key routes:

```text
GET    /health
GET    /api/versions
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/change-password
GET    /api/v1/family/bootstrap
GET    /api/v1/family/members
POST   /api/v1/family/members
PATCH  /api/v1/family/members/{member_user_id}
DELETE /api/v1/family/members/{member_user_id}
GET    /api/v1/family/emergency-contacts
POST   /api/v1/family/emergency-contacts
PATCH  /api/v1/family/emergency-contacts/{contact_id}
DELETE /api/v1/family/emergency-contacts/{contact_id}
POST   /api/v1/family/announcements
DELETE /api/v1/family/announcements/{announcement_id}
GET    /api/v1/family/audit-logs
GET    /api/v1/grocery/types
GET    /api/v1/grocery/types/{type_id}
POST   /api/v1/grocery/types
PATCH  /api/v1/grocery/types/{type_id}
DELETE /api/v1/grocery/types/{type_id}
GET    /api/v1/grocery/list-types
GET    /api/v1/grocery/master-types
GET    /api/v1/grocery/frequency-types
GET    /api/v1/grocery/items
GET    /api/v1/grocery/items/{item_id}
POST   /api/v1/grocery/items
PATCH  /api/v1/grocery/items/{item_id}
DELETE /api/v1/grocery/items/{item_id}
POST   /api/v1/grocery/regenerate-cycles
GET    /api/v1/tasks
GET    /api/v1/tasks/{task_id}
POST   /api/v1/tasks
PATCH  /api/v1/tasks/{task_id}
DELETE /api/v1/tasks/{task_id}
GET    /api/v1/meal-plan/week
PATCH  /api/v1/meal-plan/{meal_id}
POST   /api/v1/meal-plan/apply-template
GET    /api/v1/meal-plan/recipes
POST   /api/v1/meal-plan/recipes
PATCH  /api/v1/meal-plan/recipes/{recipe_id}
DELETE /api/v1/meal-plan/recipes/{recipe_id}
POST   /api/v1/assistant/recommendations
GET    /api/v1/notifications
PATCH  /api/v1/notifications/{notification_id}/read
POST   /api/v1/notifications/mark-all-read
GET    /api/v1/cache/stats
```

Demo login:

```json
{
  "username": "meera",
  "password": "familyhub"
}
```

All application routes except `/health`, `/api/versions`, `/api/v1/auth/login`, and `/api/v1/auth/refresh` require `Authorization: Bearer <access-token>`. Parent-role users can perform mutations. Child-role users can read family-scoped data but receive `403` for parent-only operations.

## API Versioning

The API uses explicit URL-path versioning (`/api/v1/...`). A version discovery endpoint is available:

```text
GET /api/versions
```

Returns the registry of all mounted versions with their deprecation status. All responses under `/api/v1` include an `X-API-Version: v1` header. When a version is deprecated, responses include `Deprecation: true` and an optional `Sunset` header with the removal date.

To add a future `/api/v2`, register it in `app/core/versioning.py` and mount a new router in `main.py`. The v1 router continues to serve traffic until its sunset date.

## Database

Schema locations:

- SQLAlchemy models: `backend/app/models/domain.py`
- Alembic migration: `backend/alembic/versions/0001_initial_schema.py`
- MySQL schema: `backend/sql/schema.sql`

Local SQLite is used only for fast development and tests. Docker uses MySQL:

```text
mysql+mysqlconnector://familyhub_user:${MYSQL_PASSWORD}@mysql:3306/familyhub_db
```

## Cache And Background Jobs

Redis:

- `backend/app/core/cache.py` provides JSON cache get/set/delete and prefix invalidation.
- Bootstrap data is cached with a 5-minute TTL.
- Mutating services invalidate the relevant family bootstrap cache.
- Cache invalidation uses explicit key tracking instead of Redis key scans.
- Bootstrap cache misses use a per-family singleflight lock to reduce stampedes.
- If Redis is unavailable or disabled, the cache falls back to process memory for local development.

Celery:

- `app.tasks.grocery_scheduler.regenerate_all_family_cycles`
- `app.tasks.notification_tasks.scan_due_reminders`

## AI Assistant

The assistant endpoint is deterministic but backend-driven:

```text
POST /api/v1/assistant/recommendations
```

It evaluates current tasks, grocery expiry, pending purchases, today's meal plan, and chores. This can be replaced with an LLM call later without changing the frontend contract.

## Verification

Backend:

```bash
. .venv/bin/activate
PYTHONPATH=backend pytest backend/tests -q
```

Frontend:

```bash
cd frontend
npm run build
npm run lint
npm run test:e2e
```

Alembic smoke test:

```bash
cd backend
PYTHONPATH=. DATABASE_URL=sqlite:///./alembic_test.db ../.venv/bin/alembic upgrade head
```

## Audit Remediation Notes

Addressed from the audit report:

- Auth enforcement on data routes.
- Family/user impersonation through query params removed from endpoints.
- Parent-only RBAC for destructive/write routes.
- Token refresh and logout/revocation.
- Login rate limiting.
- CORS credentials disabled by default.
- Environment-only Docker secrets.
- Dependency-aware health checks.
- Request ID middleware.
- Timezone-aware datetime usage in application code.
- Pagination on list endpoints.
- Soft-delete for grocery items, tasks, and recipes.
- CRUD for members, recipes, emergency contacts, notifications, and announcements.
- AuditLog writes on mutations.
- Safer grocery item numbering based on inserted row ID.
- Basic text sanitization for stored user text.
- Redis invalidation without SCAN plus bootstrap stampede protection.
- Celery crontab schedules.
- Frontend JWT integration, loading state, toast feedback, confirmation prompts, mobile notification access, PWA manifest, and removal of developer metadata.
- React Router route-level navigation.
- Persistent dark/light mode.
- Drag-and-drop task assignment board.
- Lazy-loaded Recharts analytics for task status, grocery coverage, meal calories, and reward points.
- Playwright E2E coverage for routing, theme persistence, and drag/drop reassignment.
- API versioning with `X-API-Version` response header, `/api/versions` discovery endpoint, and deprecation/sunset support.
- GroceryType admin CRUD (parent-only) for managing the grocery category reference table.
- Cmd+K command palette for global fuzzy search across tasks, groceries, meals, and family members.
- Service worker for offline PWA support with cache-first static assets and network-first API responses.
