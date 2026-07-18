# FridgeHub — Northflank Deployment Guide

## Services to create

| Service | Type | Source | Port |
|---------|------|--------|------|
| `fridgehub-mysql` | Addon — MySQL 8 | Northflank managed | 3306 |
| `fridgehub-redis` | Addon — Redis 7 | Northflank managed | 6379 |
| `fridgehub-backend-migrate` | Job (run-once) | `./backend` Dockerfile | — |
| `fridgehub-backend` | Deployment | `./backend` Dockerfile | 8000 |
| `fridgehub-celery-worker` | Deployment | `./backend` Dockerfile | — |
| `fridgehub-celery-beat` | Deployment | `./backend` Dockerfile | — |
| `fridgehub-frontend` | Deployment | `./frontend` Dockerfile | 80 |

---

## Step 1 — Create addons

### MySQL 8
- Plan: at least 1 GB RAM
- Database name: `fridgehub_db`
- User: `fridgehub_user`
- Note the connection string — Northflank injects it as `DATABASE_URL` if you link the addon

### Redis 7
- Plan: at least 256 MB
- Note the connection string — Northflank injects it as `REDIS_URL` if you link the addon

---

## Step 2 — Create a secret group

Create a secret group named `fridgehub-secrets` and add the following. All values marked
**REQUIRED** must be set before any service starts.

### Required secrets

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | **REQUIRED** — min 48 chars. Generate: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `MYSQL_PASSWORD` | **REQUIRED** — password for `fridgehub_user` |
| `MYSQL_ROOT_PASSWORD` | **REQUIRED** — MySQL root password |

### SMTP (email OTP + invite emails)

When these are unset, OTPs and invite emails fall back to console logging only.
Set them to enable real email delivery.

| Variable | Example |
|----------|---------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USE_TLS` | `true` |
| `SMTP_USERNAME` | `noreply@yourdomain.com` |
| `SMTP_PASSWORD` | App password from your email provider |
| `SMTP_FROM_EMAIL` | `noreply@yourdomain.com` |

> Gmail: use an App Password (not your account password). Enable 2FA first, then
> generate at myaccount.google.com → Security → App passwords.

### Twilio (SMS OTP)

When these are unset, SMS OTPs fall back to console logging only.
Users without a phone number skip SMS verification entirely — no Twilio required for them.

| Variable | Where to find |
|----------|--------------|
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account Info |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account Info |
| `TWILIO_FROM_NUMBER` | Twilio Console → Phone Numbers (E.164 format, e.g. `+12015551234`) |

---

## Step 3 — Run the migration job

Create a **run-once job** from `./backend` with:

```
Command: alembic upgrade head
```

Environment variables (link the secret group + addon):

```
DATABASE_URL        = <from MySQL addon>
REDIS_URL           = <from Redis addon>
SECRET_KEY          = <from secret group>
ENVIRONMENT         = production
AUTH_COOKIE_SECURE  = true
SEED_ON_STARTUP     = false
```

Run this job **before** starting the backend service. It applies all 12 migrations
including the new OTP verification tables and nullable `phone_otp_hash` column.

---

## Step 4 — Deploy the backend service

Build from `./backend`. Set these environment variables (link the secret group + addons):

```
DATABASE_URL                  = <from MySQL addon>
REDIS_URL                     = <from Redis addon>
SECRET_KEY                    = <from secret group>
ENVIRONMENT                   = production
AUTH_COOKIE_SECURE            = true
SEED_ON_STARTUP               = false
RUN_MIGRATIONS_ON_STARTUP     = false
CORS_ORIGINS                  = https://<your-frontend-domain>
LOGIN_RATE_LIMIT_PER_MINUTE   = 10
REQUIRE_DEVICE_ID_ON_LOGIN    = false

# SMTP
SMTP_HOST         = <from secret group>
SMTP_PORT         = <from secret group>
SMTP_USE_TLS      = true
SMTP_USERNAME     = <from secret group>
SMTP_PASSWORD     = <from secret group>
SMTP_FROM_EMAIL   = <from secret group>

# Twilio
TWILIO_ACCOUNT_SID  = <from secret group>
TWILIO_AUTH_TOKEN   = <from secret group>
TWILIO_FROM_NUMBER  = <from secret group>
```

Health check: `GET /health` on port 8000.

---

## Step 5 — Deploy the frontend service

Build from `./frontend` with build argument:

```
VITE_API_URL = https://<your-backend-domain>
```

Serves on port 80. The `nginx.conf` includes gzip, security headers, and SPA fallback.

---

## Step 6 — Deploy Celery worker and beat

Both use the same `./backend` image.

**celery_worker** command:
```
celery -A app.tasks.celery_app worker --loglevel=info
```

**celery_beat** command:
```
celery -A app.tasks.celery_app beat --loglevel=info
```

Both need:
```
DATABASE_URL          = <from MySQL addon>
REDIS_URL             = <from Redis addon>
CELERY_BROKER_URL     = redis://<host>:6379/1
CELERY_RESULT_BACKEND = redis://<host>:6379/2
SECRET_KEY            = <from secret group>
```

Worker additionally needs the SMTP and Twilio vars if reminder notifications send emails/SMS.

---

## Step 7 — First-time bootstrap

After all services are healthy, create the first admin account:

```bash
curl -X POST https://<backend-domain>/api/v1/auth/signup/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "familyName": "My Family",
    "homeBase": "Singapore",
    "timezone": "Asia/Singapore",
    "fullName": "Admin Name",
    "email": "admin@example.com",
    "phone": "+6591234567",
    "username": "admin",
    "password": "SecurePass1",
    "deviceId": "initial-setup-device",
    "deviceName": "Setup Terminal",
    "deviceType": "other"
  }'
```

The response returns an access token. The admin's email and phone OTPs are sent immediately.
Verify at `POST /api/v1/auth/verify` with the codes received.

Bootstrap is only available when the database has zero active users. After the first signup
it returns 409 for all subsequent calls.

---

## OTP verification behaviour in production

| Scenario | Behaviour |
|----------|-----------|
| SMTP + Twilio configured | Real email and SMS sent |
| Only SMTP configured | Email sent; SMS logged to console |
| Neither configured | Both logged to console (dev/staging only) |
| User has no phone number | Email OTP only; phone OTP skipped entirely |
| Wrong code | HTTP 400 with channel-specific message |
| Expired code (>10 min) | HTTP 400; user must call `POST /auth/resend` |
| 5 wrong attempts | HTTP 400 lockout; user must call `POST /auth/resend` |
| Login while unverified | HTTP 403 with `userId=N`; fresh OTPs re-sent automatically |

---

## Migration history

| Migration | What it does |
|-----------|-------------|
| `0001` | Full initial schema |
| `0002` | Auth and membership hardening |
| `0003` | Permission grants on family_members |
| `0004` | Per-member meal plan unique constraint |
| `0005` | Device management and session tracking |
| `0006` | Max devices constraint |
| `0007` | Scoped meal templates |
| `0008` | Extended grocery frequencies |
| `0009` | Family signup invites |
| `0010` | OTP verification tables + email/phone verified flags on users |
| `0011` | Make max_devices nullable (config-driven limits) |
| `0012` | Make phone_otp_hash nullable (phone-less users skip SMS OTP) |

---

## Rollback plan

If `0012` needs to be rolled back:

```bash
alembic downgrade 0011_remove_device_limits
```

This backfills `phone_otp_hash = ''` and `phone_target = ''` for any NULL rows before
restoring the NOT NULL constraint. No data loss for rows that had a phone OTP.

---

## Checklist before go-live

- [ ] `SECRET_KEY` is at least 48 chars and stored as a Northflank secret
- [ ] `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` are set as secrets
- [ ] `ENVIRONMENT=production` is set on backend, worker, and beat
- [ ] `AUTH_COOKIE_SECURE=true` is set on backend
- [ ] `SEED_ON_STARTUP=false` is set on backend
- [ ] `CORS_ORIGINS` contains only your actual frontend domain(s)
- [ ] Migration job completed successfully (check job logs)
- [ ] Backend `/health` returns 200
- [ ] SMTP credentials tested — send a test email before go-live
- [ ] Twilio credentials tested — send a test SMS before go-live
- [ ] Bootstrap signup completed and OTP verified end-to-end
- [ ] `REQUIRE_DEVICE_ID_ON_LOGIN=true` set after initial testing
