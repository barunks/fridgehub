# FridgeHub

FridgeHub is a full-stack family command center built from `docs/Fridge_Hub.docx` and the reference images in `docs/`.

The implementation now includes the React UI, FastAPI backend, SQLAlchemy data model, MySQL schema, Redis cache abstraction, Celery schedules, Docker deployment files, seeded meal/grocery/task templates, JWT auth/RBAC, audit logging, and tests.

## What Is Implemented

- React + TypeScript frontend with routed dashboard, groceries, meal plans, tasks, family workspace, assistant, and implementation-readiness views.
- Dark/light theme persistence, drag-and-drop task reassignment, and lazy-loaded Recharts household analytics.
- Household Command Center — unified admin dashboard with tabbed CRUD for members, contacts, grocery places, recipes, tasks, per-member meal plans, AI insights, and account security.
- Per-member meal plans — each family member gets an independent weekly plan generated from the family template, customizable per individual.
- FastAPI backend with versioned REST routes under `/api/v1`.
- SQLAlchemy models for the document's core tables: users, families, family members, grocery types, frequency types, grocery list types, grocery items, purchase cycles, sub-lists, tasks, meal plans, meal templates, recipes, audit logs, and notifications.
- Extra UI-backed tables for announcements and emergency contacts.
- Seed data matching the screenshots, including all weekly meal-plan cells.
- Redis cache client with in-memory fallback for local development.
- Celery worker/beat tasks for grocery-cycle regeneration and reminder scans.
- MySQL `schema.sql`, Alembic initial migration, Dockerfiles, and `docker-compose.yml`.
- Frontend API hydration from `/api/v1/family/bootstrap`; local demo data is used only before an authenticated API session is established.
- JWT access tokens kept in frontend memory, HttpOnly refresh-token cookies, and role-aware write guards.
- Pagination parameters on API list endpoints, soft-delete routes, and CRUD coverage for members, recipes, emergency contacts, groceries, tasks, notifications, and announcements.

## Project Structure

```text
FridgeHub/
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
|   |   |-- components/
|   |   |   |-- command-center/
|   |   |   |-- analytics/
|   |   |   |-- assistant/
|   |   |   |-- dashboard/
|   |   |   |-- family/
|   |   |   |-- grocery/
|   |   |   |-- mealplan/
|   |   |   |-- tasks/
|   |   |   |-- layout/
|   |   |   `-- ui/
|   |   |-- hooks/
|   |   |-- services/
|   |   |-- types/
|   |   `-- utils/
|   |-- tests/e2e/
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
PYTHONPATH=backend DATABASE_URL=sqlite:///./fridgehub.db CACHE_ENABLED=false SECRET_KEY=local-dev-secret-key-at-least-32-chars uvicorn app.main:app --reload --port 8000
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

The frontend tries `http://localhost:8000` by default. Authenticated app data is reconciled from the backend; the frontend no longer persists full family state in browser storage.

Frontend route map:

```text
/                 Dashboard — stat cards, today's agenda, tasks, meals, groceries, assistant, family
/tasks            Drag-and-drop assignment board
/groceries        Grocery master list and cycle tools
/meals            Weekly meal planner with per-member filtering and recipes
/family           Members, announcements, contacts, notifications
/analytics        Household analytics — task flow, pantry coverage, calories, reward points
/command-center   Household Command Center — unified admin for all CRUD workflows
/assistant        Family assistant chat
/history          Audit log viewer
/demo              Application guide, tutorials, FAQ, and how-to reference
```

## Household Command Center

The `/command-center` route (parent-only) provides a unified admin workspace with tabbed sections:

| Tab | Capabilities |
|-----|-------------|
| Members | List, create, edit role/name/color, delete with confirmation |
| Meal Plans | Per-member plan generation from template, inline meal editing, bulk generate for all |
| Contacts | Emergency contacts CRUD |
| Grocery Places | Shopping list types management, regenerate purchase cycles |
| Recipes | Full list with real-time filter, create, delete |
| Tasks | Status filter, checkbox toggle, delete |
| Insights | Live AI assistant insights from `/api/v1/assistant/insights` |
| Security | Change password with validation, device management (list, rename, trust, revoke), signup invites with QR |

## Signup & Onboarding

FridgeHub does not allow open anonymous signup. Every user must belong to a family, and every session is tied to a registered device.

### Three Signup Flows

| Flow | When | Endpoint |
|------|------|----------|
| Bootstrap | App has no users/families yet | `POST /api/v1/auth/signup/bootstrap` |
| Invite-based | Admin creates invite, new user joins | `POST /api/v1/auth/signup` |
| Existing user new device | User logs in from a new device | `POST /api/v1/auth/login` |

### Bootstrap (First Family Setup)

Available only when the database has zero active users and families. Creates:
- Admin user account
- Family record
- First family membership (admin role)
- Default grocery shopping places (Wet Market, Super Market, Murugan, NTUC)
- Default weekly meal plan template (28 meals across 7 days × 4 meal types)
- First registered device + session

Check availability: `GET /api/v1/auth/signup/status` → `{"bootstrapAllowed": true/false}`

### Invite-Based Signup

1. Admin creates invite: `POST /api/v1/auth/invites` with role, permissions, expiry (1–30 days), max uses (1–10)
2. Backend returns a one-time visible `inviteToken` (stored as SHA-256 hash)
3. Admin shares the invite link or QR code
4. New user opens `/?invite=<token>` or pastes the token
5. Frontend previews the invite: `GET /api/v1/auth/invites/<token>` → family name, role, expiry
6. User fills name/email/username/password + mandatory device registration
7. `POST /api/v1/auth/signup` validates token, creates user + membership + device, returns tokens
8. Invite `used_count` increments; auto-deactivates when `max_uses` reached

Security properties:
- Invite tokens are 32 bytes of `secrets.token_urlsafe` (192 bits entropy)
- Stored as SHA-256 hash — raw token is shown only once at creation
- Email-pinned invites reject signups from other email addresses
- Row-level locking (`SELECT ... FOR UPDATE`) prevents race conditions
- Expired or fully-used invites return 404

### QR Code Support

The Command Center → Security tab generates QR codes for invite links:
- QR contains only the invite URL: `https://app.example.com/?invite=<token>`
- Token is short-lived (configurable 1–30 days) and single/limited-use
- No passwords, user IDs, or permanent secrets are embedded in the QR
- Fallback: copyable invite link for non-camera scenarios

### Rate Limiting

All auth mutation endpoints are rate-limited per IP:
- `POST /api/v1/auth/login` — `LOGIN_RATE_LIMIT_PER_MINUTE` (default: 10)
- `POST /api/v1/auth/signup` — same limit
- `POST /api/v1/auth/signup/bootstrap` — same limit

Uses Redis `INCR` with TTL window; falls back to in-memory sliding window.

### Device Registration on Login

Device registration is mandatory on all signup flows (`deviceId`, `deviceName`, `deviceType` are required fields on `BootstrapSignupRequest` and `InviteSignupRequest`).

For the login endpoint, `deviceId` is optional by default for backward compatibility with API tools (curl, Postman). In production, set `REQUIRE_DEVICE_ID_ON_LOGIN=true` to enforce mandatory device registration on every login. When enabled, login without `deviceId` returns HTTP 400.

Device ID strategy:
- Frontend generates a stable random UUID via `crypto.randomUUID()` on first use
- Stored in `localStorage` under `fridgehub-device-id`
- No browser fingerprinting — avoids privacy concerns and instability across browser updates
- API clients without a device ID get a derived UUID from `uuid5(user_agent|ip)` as fallback

## Device Registration & Access Control

Each login is bound to a device. Devices are automatically registered on first login and tracked for security.

### How It Works

1. The frontend generates a stable `deviceId` (stored in localStorage) and sends it with login requests.
2. The backend creates a `Device` record on first login from a new device and logs a `device_registered` audit event.
3. Each token (access + refresh) is recorded as a `DeviceSession` row linked to the device.
4. On every authenticated request, the backend verifies the device is not revoked.
5. If a device is revoked, all its sessions are invalidated and the user sees a "Device Blocked" screen.

### Device Management

Parents can manage devices from the Command Center → Security tab:

- View all registered devices with last-used timestamps
- Rename devices for easy identification
- Mark devices as trusted
- Revoke sessions (force re-login without blocking the device)
- Revoke a device entirely (blocks all future access from that device)

### API Endpoints

```text
GET    /api/v1/auth/devices                         # List user's devices
PATCH  /api/v1/auth/devices/{device_id}             # Rename or toggle trust
DELETE /api/v1/auth/devices/{device_id}             # Revoke device + all sessions
POST   /api/v1/auth/devices/{device_id}/revoke-sessions  # Revoke sessions only
```

### Frontend Components

- `DeviceBlocked` — Full-screen error shown when a revoked device attempts access
- `DeviceRegistration` — Prompt shown on first login from a new device (name + type selection)
- `DeviceManagement` — Standalone device list with trust/revoke controls (also embedded in Command Center)

### Database

Migration `0005_device_sessions` adds:
- Extended `devices` table with `family_id`, `device_type`, `platform`, `last_ip`, `last_user_agent`, `is_revoked`, `is_trusted`, `registered_at`
- New `device_sessions` table tracking every issued token per device

## Per-Member Meal Plans

Each family member can have an independent weekly meal plan:

1. A parent generates plans from the family template for individual members or all at once.
2. Each member's plan is stored as separate database rows (`assigned_to` column).
3. Plans can be customized per individual (different meals, dietary flags, calories) without affecting other members.
4. The meal plan page includes a member selector dropdown to switch between views.

API support:

```text
GET  /api/v1/meal-plan/week?member_id=3     # Get member 3's plan
POST /api/v1/meal-plan/apply-template        # Body: {"memberId": 3}
POST /api/v1/meal-plan/apply-template        # Body: {} → family-wide plan
```

The unique constraint is `(family_id, plan_date, meal_type, assigned_to)`, allowing one meal per slot per member.

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
GET    /api/v1/auth/devices
PATCH  /api/v1/auth/devices/{device_id}
DELETE /api/v1/auth/devices/{device_id}
POST   /api/v1/auth/devices/{device_id}/revoke-sessions
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
GET    /api/v1/meal-plan/week?member_id={user_id}
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
  "password": "fridgehub"
}
```

`POST /api/v1/auth/login` returns an access token and sets the refresh token as an HttpOnly cookie. `POST /api/v1/auth/refresh` rotates that refresh cookie and returns a new access token. All application routes except `/health`, `/api/versions`, `/api/v1/auth/login`, and `/api/v1/auth/refresh` require `Authorization: Bearer <access-token>`. Parent-role users can perform mutations. Child-role users can read family-scoped data but receive `403` for parent-only operations.

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
- Alembic migrations: `backend/alembic/versions/`
- MySQL schema: `backend/sql/schema.sql`

Migrations:

```text
0001_initial_schema              — Full schema creation
0002_auth_membership_cache_fixes — Auth and membership hardening
0003_membership_permissions      — Permission grants on family_members
0004_per_member_meal_plans       — Unique constraint change for per-member meals
0005_device_sessions             — Device management and session tracking
```

Local SQLite is used only for fast development and tests. Docker uses MySQL:

```text
mysql+mysqlconnector://fridgehub_user:${MYSQL_PASSWORD}@mysql:3306/fridgehub_db
```

## Cache And Background Jobs

Redis:

- `backend/app/core/cache.py` provides JSON cache get/set/delete and prefix invalidation.
- Bootstrap data is cached with a 5-minute TTL.
- Mutating services invalidate the relevant family bootstrap cache.
- Cache invalidation uses Redis `SCAN` pattern iteration instead of an unbounded tracked-key set.
- Bootstrap cache misses use a per-family singleflight lock to reduce stampedes.
- If Redis is unavailable or disabled, the cache falls back to locked process memory for local development. Production startup requires Redis unless `ALLOW_MEMORY_CACHE_IN_PRODUCTION=true` is explicitly set.

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

Backend (87 tests):

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

Test coverage includes:

- Auth flow (login, refresh, logout, change password, validation)
- RBAC enforcement (parent vs child permissions)
- Full CRUD for groceries, tasks, recipes, members, contacts, announcements
- Per-member meal plan generation, filtering, customization, and independence
- Audit log creation on mutations
- Notification generation from template application
- Pagination with filters (status, unread, entity type)
- Soft-delete behavior
- API versioning headers
- Error response format consistency
- Device registration, revocation, and session management
- Login/refresh rejection for revoked devices
- Device lifecycle audit events
- E2E tests for Command Center navigation, tabs, per-member meal plan UI, and device management

## Audit Remediation Notes

Addressed from the audit report:

- Auth enforcement on data routes.
- Family/user impersonation through query params removed from endpoints.
- Parent-only RBAC for destructive/write routes.
- HttpOnly refresh cookie rotation, token-version session revocation, and logout that revokes all active sessions for the user.
- Login rate limiting.
- CORS credentials enabled for the configured origins so refresh cookies work.
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
- Redis `SCAN` prefix invalidation plus bootstrap stampede protection.
- Celery crontab schedules.
- Frontend in-memory access-token integration, loading state, rollback-aware optimistic updates, toast feedback, confirmation prompts, mobile notification access, PWA manifest, and removal of developer metadata.
- React Router route-level navigation.
- Persistent dark/light mode.
- Drag-and-drop task assignment board.
- Lazy-loaded Recharts analytics for task status, grocery coverage, meal calories, and reward points.
- Playwright E2E coverage for routing, theme persistence, drag/drop reassignment, command center, and per-member meal plans.
- API versioning with `X-API-Version` response header, `/api/versions` discovery endpoint, and deprecation/sunset support.
- GroceryType admin CRUD (parent-only) for managing the grocery category reference table.
- Cmd+K command palette for global fuzzy search across tasks, groceries, meals, and family members.
- Service worker for offline PWA support with cache-first static assets and network-first API responses.
- Household Command Center with unified tabbed admin for all family CRUD workflows.
- Device registration and access control with per-device session tracking, revocation, and audit trail.
- Per-member meal plans with template-based generation and individual customization.
