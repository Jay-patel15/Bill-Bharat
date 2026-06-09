# BillBharat — Self-Hosted Deployment Guide

Complete guide to deploying BillBharat on a Linux server using Docker Compose,
PostgreSQL, Redis, MinIO, and Nginx Proxy Manager.

---

## Prerequisites

- Linux server (Ubuntu 22.04+ recommended), minimum **2 GB RAM / 2 vCPU / 20 GB disk**
- Docker Engine ≥ 24 and Docker Compose v2 installed
- Nginx Proxy Manager (NPM) running with an external Docker network named `platform-network`
- A domain name pointing to your server (or use a local IP for internal access)

---

## Step 1 — Create the External Docker Network

If `platform-network` doesn't exist yet (shared with Nginx Proxy Manager):

```bash
docker network create platform-network
```

---

## Step 2 — Clone the Repository

```bash
git clone https://github.com/Jay-patel15/Bill-Bharat.git /opt/billbharat
cd /opt/billbharat
git checkout self-hosted-migration
```

---

## Step 3 — Configure Environment

```bash
cp .env.example .env
nano .env   # or use your preferred editor
```

Fill in every required value:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string — matches `POSTGRES_USER/PASSWORD/DB` |
| `POSTGRES_PASSWORD` | Strong random password for PostgreSQL |
| `MINIO_ACCESS_KEY` | MinIO username (≥ 3 chars) |
| `MINIO_SECRET_KEY` | MinIO password (≥ 8 chars) |
| `JWT_SECRET` | ≥ 32 random characters — generate with command below |
| `NEXT_PUBLIC_APP_URL` | Your public domain, e.g. `https://bill.example.com` |

**Generate a strong JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Minimal .env example
```env
DATABASE_URL=postgresql://admin:MyStr0ngPass@postgres:5432/billbharat_db
POSTGRES_USER=admin
POSTGRES_PASSWORD=MyStr0ngPass
POSTGRES_DB=billbharat_db

REDIS_URL=redis://redis:6379

MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=billbharat
MINIO_SECRET_KEY=MyStr0ngMinIOPass
MINIO_BUCKET=billbharat-storage
STORAGE_BACKEND=minio

JWT_SECRET=<32-char-hex-from-command-above>
SESSION_COOKIE_NAME=bb_session

NEXT_PUBLIC_APP_NAME=BillBharat
NEXT_PUBLIC_APP_URL=https://bill.example.com
```

---

## Step 4 — Start All Services

```bash
# Build the Next.js image and start all containers
docker compose -f docker/docker-compose.yml up -d --build
```

Wait ~60 seconds for all services to pass their health checks:

```bash
docker compose -f docker/docker-compose.yml ps
```

All services should show `healthy`.

---

## Step 5 — Initialise the Database (First Run Only)

```bash
docker compose -f docker/docker-compose.yml exec billbharat node scripts/init-db.js
```

Expected output:
```
🔌  Connecting to PostgreSQL...
✅  Connected.
📄  Applying database/schema.sql...
✅  Schema applied successfully.

📊  Tables in database (12):
    • audit_logs
    • companies
    • customers
    ...
🎉  Database initialisation complete!
```

> **Safe to re-run** — all schema statements are idempotent (`CREATE IF NOT EXISTS`).

---

## Step 6 — Configure Nginx Proxy Manager

1. Open Nginx Proxy Manager UI (typically `http://server-ip:81`)
2. Add a **Proxy Host**:
   - **Domain**: `bill.example.com`
   - **Forward Hostname**: `billbharat` (Docker service name)
   - **Forward Port**: `3000`
   - Enable **Block Common Exploits** and **Websockets Support**
   - Request an SSL certificate via Let's Encrypt

---

## Step 7 — Verify Deployment

```bash
# Check app is responding
curl https://bill.example.com/api/health

# Expected response:
# {"ok":true,"data":{"status":"ok"}}
```

Open `https://bill.example.com` in your browser — you should see the BillBharat login page.

---

## Migrating Existing Data

### From Supabase (PostgreSQL export)

```bash
# On Supabase dashboard: Settings → Database → Connection string
# Then dump:
pg_dump "postgresql://postgres:[PASSWORD]@db.[project].supabase.co:5432/postgres" \
  --data-only --no-owner --no-privileges \
  -f supabase_data.sql

# Import into self-hosted PostgreSQL
docker compose -f docker/docker-compose.yml exec -T postgres \
  psql -U admin billbharat_db < supabase_data.sql
```

### From Local JSON Files (.data/*.json)

```bash
docker compose -f docker/docker-compose.yml exec billbharat \
  node scripts/migrate-json-to-pg.js --dry-run   # preview first

docker compose -f docker/docker-compose.yml exec billbharat \
  node scripts/migrate-json-to-pg.js              # run migration
```

---

## Maintenance

### View logs
```bash
docker compose -f docker/docker-compose.yml logs -f billbharat
docker compose -f docker/docker-compose.yml logs -f postgres
```

### Update the application
```bash
cd /opt/billbharat
git pull
docker compose -f docker/docker-compose.yml up -d --build billbharat
```

### Backup PostgreSQL
```bash
docker compose -f docker/docker-compose.yml exec postgres \
  pg_dump -U admin billbharat_db > backup-$(date +%Y%m%d).sql
```

### Backup MinIO data
MinIO data lives in the `minio_data` Docker volume. Back it up with:
```bash
docker run --rm \
  -v billbharat_minio_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/minio-backup-$(date +%Y%m%d).tar.gz /data
```

### Restore PostgreSQL backup
```bash
docker compose -f docker/docker-compose.yml exec -T postgres \
  psql -U admin billbharat_db < backup-20260101.sql
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `DATABASE_URL is not set` | .env not loaded | Verify .env file path and contents |
| `MINIO_ENDPOINT is not set` | Storage env missing | Check MINIO_* vars in .env |
| `ECONNREFUSED` on startup | PostgreSQL not ready | Wait for health checks; check postgres logs |
| `JWT_SECRET not set` | .env missing | Set JWT_SECRET in .env |
| Images not loading | MinIO domain not in next.config.js | Add `MINIO_PUBLIC_DOMAIN` to .env |
| Login redirects in loop | JWT cookie domain mismatch | Ensure `NEXT_PUBLIC_APP_URL` matches actual domain |

---

## Architecture Overview

```
Internet
    │
    ▼
Nginx Proxy Manager   (port 80/443)
    │
    │  platform-network (Docker bridge)
    │
    ▼
billbharat            (port 3000, internal only)
    │
    ├──► postgres      (port 5432, internal only)
    ├──► redis         (port 6379, internal only)
    └──► minio         (port 9000, internal only)
```

All service-to-service communication uses Docker's internal DNS (service names as hostnames). Nothing is exposed to the internet except through Nginx Proxy Manager.
