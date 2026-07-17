# FridgeHub — VastSpace VPS Deployment Guide

Full stack: FastAPI + MySQL 8 + Redis + Celery + React + Nginx + Let's Encrypt HTTPS

---

## What's in this folder

```
deploy/
├── deploy.sh                  # Main deploy script (run from your local machine)
├── renew-ssl.sh               # SSL renewal (runs as cron on the VPS)
├── docker-compose.prod.yml    # Production Docker Compose
├── .env.production            # Environment template — copy to project root as .env
└── nginx/
    ├── nginx.conf             # Nginx base config
    └── conf.d/
        └── fridgehub.conf     # Site config (HTTP redirect + HTTPS + proxy)
```

---

## Prerequisites

### On your local machine
- SSH key pair (generate with `ssh-keygen -t ed25519` if you don't have one)
- `git`, `curl`, `openssl` installed

### On VastSpace
1. Order a VPS — **Ubuntu 22.04 LTS**, minimum **2 vCPU / 4 GB RAM / 40 GB SSD**
2. Note the VPS IP address from the VastSpace control panel
3. Add your SSH public key during VPS setup (or via root password first login)

### Domain
- Buy a domain (Namecheap, Cloudflare, etc.) or use a subdomain you own
- Create an **A record**: `fridgehub.yourdomain.com` → `YOUR_VPS_IP`
- DNS propagation takes 5–30 minutes

---

## Step-by-Step Deployment

### Step 1 — Prepare your .env

```bash
cp deploy/.env.production .env
```

Edit `.env` and fill in **every** value:

```bash
# Required — change all of these
DOMAIN=fridgehub.yourdomain.com
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
MYSQL_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
SECRET_KEY=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
CERTBOT_EMAIL=your-email@example.com
CORS_ORIGINS=https://fridgehub.yourdomain.com

# VPS connection
REMOTE_HOST=YOUR_VPS_IP
REMOTE_USER=root
SSH_KEY=~/.ssh/id_rsa        # path to your SSH private key
```

> **Never commit `.env` to git.** It's in `.gitignore`.

---

### Step 2 — First-time setup (run once)

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh --setup
```

This will:
1. SSH into your VPS
2. Install Docker + UFW firewall
3. Open ports 22, 80, 443
4. Clone the repository to `/opt/fridgehub`
5. Copy your `.env` to the server
6. Build all Docker images
7. Run database migrations
8. Issue Let's Encrypt SSL certificate
9. Start all services
10. Validate everything is healthy

**Total time: ~10–15 minutes**

---

### Step 3 — Verify it's live

```bash
./deploy/deploy.sh --validate
```

Expected output:
```
[ OK ]  Backend health: HTTP 200
[ OK ]  HTTPS health: HTTP 200
[ OK ]  Frontend: HTTP 200
[ OK ]  SSL expires: <date>
[ OK ]  HSTS header present
[ OK ]  MySQL: healthy
[ OK ]  Redis: PONG
```

Open your browser: `https://fridgehub.yourdomain.com`

---

### Step 4 — First login (bootstrap)

On first launch the database is empty. The app shows a **Setup** tab:

1. Go to `https://fridgehub.yourdomain.com`
2. Click **Setup** tab
3. Fill in family name, admin username, email, password
4. Register your device
5. Submit — this creates the first family and admin account

After bootstrap, new members join via **invite links** only (Command Center → Security).

---

## Updating the App

Every time you push code to `main`:

```bash
./deploy/deploy.sh --update
```

This pulls the latest code, rebuilds images, runs migrations, and restarts services with zero manual steps.

---

## Database Rename (FamilyHub → FridgeHub)

If you have an existing installation with the old `familyhub_db` database, run the rename script:

```bash
# Local SQLite (dev)
./scripts/rename-db.sh --sqlite

# Local MySQL
./scripts/rename-db.sh --mysql

# MySQL inside Docker Compose
./scripts/rename-db.sh --docker

# Production VPS (reads REMOTE_HOST + MYSQL_ROOT_PASSWORD from .env)
./scripts/rename-db.sh --production
```

The script handles: creating the new DB, moving all tables, dropping the old DB, renaming the user, and re-granting privileges.

---

## Common Commands

```bash
# Deploy / update
./deploy/deploy.sh --update

# Watch live logs
./deploy/deploy.sh --logs

# Renew SSL manually
./deploy/deploy.sh --ssl

# Check service health
./deploy/deploy.sh --validate

# SSH into the server
ssh -i ~/.ssh/id_rsa root@YOUR_VPS_IP

# On the server — view container status
cd /opt/fridgehub
docker compose -f deploy/docker-compose.prod.yml ps

# On the server — restart a single service
docker compose -f deploy/docker-compose.prod.yml restart backend

# On the server — view backend logs
docker compose -f deploy/docker-compose.prod.yml logs -f backend

# On the server — run database migrations manually
docker compose -f deploy/docker-compose.prod.yml run --rm backend_migrate
```

---

## Architecture on VastSpace

```
Internet
    │
    ▼ :443 (HTTPS)
┌─────────────────────────────────────────────┐
│  VastSpace VPS (Ubuntu 22.04)               │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  Docker network: external            │   │
│  │                                      │   │
│  │  Nginx (port 80/443)                 │   │
│  │    ├── /          → frontend:80      │   │
│  │    ├── /api/      → backend:8000     │   │
│  │    └── /health    → backend:8000     │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  Docker network: internal (private)  │   │
│  │                                      │   │
│  │  frontend   (React + Nginx)          │   │
│  │  backend    (FastAPI)                │   │
│  │  celery_worker                       │   │
│  │  celery_beat                         │   │
│  │  mysql      (port 3306, internal)    │   │
│  │  redis      (port 6379, internal)    │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  Certbot (Let's Encrypt, auto-renews)       │
└─────────────────────────────────────────────┘
```

MySQL and Redis are on the **internal** Docker network only — not exposed to the internet.

---

## SSL Certificate

- Issued by **Let's Encrypt** (free, trusted by all browsers)
- Valid for **90 days**, auto-renewed by cron
- Renewal cron is set up automatically by `--setup`
- Manual renewal: `./deploy/deploy.sh --ssl`

---

## Troubleshooting

| Problem | Fix |
|---|---|
| SSH connection refused | Check VastSpace firewall — port 22 must be open |
| DNS not resolving | Wait 5–30 min for propagation, check A record |
| SSL cert fails | Ensure DNS resolves to VPS IP before running `--ssl` |
| Backend unhealthy | `docker compose logs backend` on server |
| MySQL won't start | Check `MYSQL_ROOT_PASSWORD` in `.env` |
| 502 Bad Gateway | Backend not ready yet — wait 30s and retry |
| CORS errors | Ensure `CORS_ORIGINS=https://yourdomain.com` in `.env` |

---

## Security Notes

- MySQL and Redis are **not exposed** to the internet (internal Docker network only)
- HTTPS enforced with HSTS (browsers will always use HTTPS after first visit)
- Rate limiting on all API endpoints, stricter on auth endpoints
- JWT access tokens in memory only, refresh tokens in HttpOnly cookies
- Every session tied to a registered device
