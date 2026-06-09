# Self-Hosting Guide: Ultra-Low Spec PC (Intel Celeron, 3GB RAM)

This guide provides a specialized implementation plan for setting up a backend server on an **Intel Celeron CPU with only 3GB of RAM**. 

At this tier of hardware, standard configurations will cause immediate Out-Of-Memory (OOM) crashes, system freezing, and high response latencies. This guide focuses on **aggressive resource optimization, native execution, memory limits, and CPU tuning** to keep your server fast and stable.

---

## Table of Contents
1. [Core Constraints: Celeron & 3GB RAM](#1-core-constraints-celeron--3gb-ram)
2. [Server Setup & Deactivating Unused Services](#2-server-setup--deactivating-unused-services)
3. [Aggressive Memory Management (3GB RAM)](#3-aggressive-memory-management-3gb-ram)
4. [CPU Tuning for Intel Celeron](#4-cpu-tuning-for-intel-celeron)
5. [Database Configurations (SQLite Mandate)](#5-database-configurations-sqlite-mandate)
6. [Single-Worker Backend Configuration](#6-single-worker-backend-configuration)
7. [Nginx Tuning for Low-CPU/Low-Memory](#7-nginx-tuning-for-low-cpulow-memory)
8. [Domain-Less Setup (Vercel Rewrite + Ngrok)](#8-domain-less-setup-vercel-rewrite--ngrok)

---

## 1. Core Constraints: Celeron & 3GB RAM

Operating with a Celeron and 3GB of RAM requires strict rules:
* **No Docker**: Do not run Docker or containers. Container runtime overhead consumes ~150-300MB of RAM just sitting idle. Run your services **bare-metal (natively)** instead.
* **No Process Clusters**: Do not run PM2 in cluster mode. You must run a **single process** of your Node.js or Python backend.
* **No High-RAM Databases**: Running PostgreSQL or MongoDB is highly discouraged. **SQLite is the primary choice** because its RAM footprint is under 15MB.
* **Offload Cryptography**: The Celeron CPU will choke on cryptography. Lower bcrypt salt rounds to prevent API requests from hanging.

---

## 2. Server Setup & Deactivating Unused Services

### 1. Install Debian 12 (Netinstaller)
Install Debian 12 with **no graphical interface**. A GUI (like GNOME or KDE) will consume 1.5GB to 2GB of RAM, leaving only 1GB for your entire application. Headless Debian runs at around **110MB - 130MB RAM** at idle.

### 2. Disable Unnecessary System Services
Linux installs utility services that run in the background. Disable them to reclaim RAM:
```bash
# Disable snapd (if installed, consumes significant memory)
sudo systemctl stop snapd
sudo systemctl disable snapd

# Disable unattended upgrades (prevents sudden 100% CPU spikes during operation)
# You should update system packages manually: sudo apt update && sudo apt upgrade -y
sudo systemctl stop unattended-upgrades
sudo systemctl disable unattended-upgrades

# Disable modem manager
sudo systemctl stop ModemManager
sudo systemctl disable ModemManager
```

---

## 3. Aggressive Memory Management (3GB RAM)

### 1. Set Up a 6GB Swap File
Because 3GB RAM is extremely small, we must set up a larger swap space (6GB) to absorb peak memory usages during builds or deployment updates.
```bash
sudo swapon --show
sudo fallocate -l 6G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Set swappiness to `10` so that swap is only used to prevent crashes, keeping the active execution in physical RAM:
```bash
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
```

### 2. Configure Node.js Memory Limits
Node.js processes default to managing memory allocation dynamically (up to 1.5GB on 64-bit systems). If it exceeds this, the OS will terminate it.
Limit the V8 engine's memory pool manually when launching your app:

#### Command Line Option:
```bash
# Limit Node memory to 512MB RAM
node --max-old-space-size=512 index.js
```

#### If using PM2 (ecosystem.config.js):
Create an ecosystem file to enforce this limit:
```bash
pm2 init
```
Edit the generated `ecosystem.config.js`:
```javascript
module.exports = {
  apps : [{
    name: 'my-backend',
    script: 'index.js',
    instances: 1, // DO NOT use 'max'. Limit to exactly 1 instance!
    exec_mode: 'fork', // Runs as a single process, not cluster
    max_memory_restart: '500M', // Restart process if it exceeds 500MB RAM
    node_args: '--max-old-space-size=512',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```
Start your app using this ecosystem file:
```bash
pm2 start ecosystem.config.js
pm2 save
```

---

## 4. CPU Tuning for Intel Celeron

Celeron CPUs have weak single-core performance. Cryptographic operations (like password hashing) will block your server's single thread, causing all incoming API requests to time out.

### 1. Bcrypt Tuning
Bcrypt is designed to be slow to prevent brute-force attacks. However, on a Celeron, high work factors will freeze the API.
* **Standard default**: 10 to 12 rounds (takes 1-3 seconds on Celeron).
* **Celeron Tuning**: Set bcrypt rounds to **8** (takes ~100-200ms on Celeron).

```javascript
// Node.js Bcrypt Configuration
const bcrypt = require('bcryptjs'); // Use bcryptjs as it has fewer native build dependencies

// Lower work factor to 8 for low-spec CPU
const SALT_ROUNDS = 8; 

async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}
```

### 2. Offload CPU Tasks to the Client (Vercel Frontend)
If your app performs heavy processing (such as parsing CSVs, sorting large datasets, or rendering PDFs), **do not do it on the backend**. Instead, write JavaScript in your React/Vue frontend to handle these tasks directly in the user's browser.

---

## 5. Database Configurations (SQLite Mandate)

On a 3GB RAM PC, running a database server (like Postgres) alongside your web server and OS will consume ~1.2GB of RAM just idling. **SQLite is highly recommended.**

### 1. Setup SQLite in WAL Mode
Add this configuration code to your SQLite connection file (e.g., `sqlite3` or `better-sqlite3`):
```javascript
const Database = require('better-sqlite3');
const db = new Database('production.db');

// Run performance optimizations
db.pragma('journal_mode = WAL');       // Concurrent reads and writes
db.pragma('synchronous = NORMAL');     // Faster writes
db.pragma('temp_store = MEMORY');      // Use RAM for temp tables instead of slow disk writes
db.pragma('cache_size = -32000');      // Limit buffer cache memory to exactly 32MB
```

### 2. If PostgreSQL is Mandatory
If you must use PostgreSQL, apply these ultra-conservative configuration parameters:
```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
```
Update configuration:
```ini
max_connections = 12           # Low connection limit prevents spawning memory-hungry threads
shared_buffers = 128MB          # Keep this small to free up system memory
work_mem = 2MB                 # RAM allocated per query sort operation
maintenance_work_mem = 32MB
effective_cache_size = 512MB
```
Save and restart:
```bash
sudo systemctl restart postgresql
```

---

## 6. Single-Worker Backend Configuration

If using Python with Gunicorn, do not run with the standard formula of `(2 * CPU cores) + 1` workers. Running multiple worker processes will exhaust the 3GB RAM quickly.

Modify your Gunicorn/Uvicorn configuration to run exactly **1 worker**:
```bash
# Python Backend Start command (limit to 1 worker)
gunicorn --workers 1 --bind 127.0.0.1:5000 app:app
```

For Node.js, running one node instance naturally uses a single thread. Avoid any package that implements cluster modules.

---

## 7. Nginx Tuning for Low-CPU/Low-Memory

Nginx is efficient, but we must configure it to reduce CPU usage.

### 1. Optimize Gzip Compression (Lower CPU Overhead)
Gzip level defaults to 6, which uses significant CPU. Lower it to **2** or **3**. It still offers ~80% of the compression savings but uses a fraction of the Celeron's CPU cycles.

Edit Nginx Configuration:
```bash
sudo nano /etc/nginx/nginx.conf
```

Uncomment/edit the gzip section:
```nginx
gzip on;
gzip_comp_level 3; # Lower CPU compression level (1-9)
gzip_min_length 1000;
gzip_types text/plain text/css application/json application/javascript text/xml;
```

### 2. Disable Access Logs (Saves Disk I/O)
Continuous writing to the disk consumes CPU interrupts and disk performance. Disable regular access logging and only write error logs:
```bash
sudo nano /etc/nginx/sites-available/backend.conf
```
Edit Nginx Site file:
```nginx
server {
    listen 80;
    server_name localhost;

    # Disable access log; keep error log
    access_log off;
    error_log /var/log/nginx/error.log crit; # Only log critical errors

    location / {
        proxy_pass http://127.0.0.1:5000;
        # ... proxy headers
    }
}
```
Test and reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. Domain-Less Setup (Vercel Rewrite + Ngrok)

To avoid managing SSL certificates locally (which consumes CPU cycles for cryptography handshakes), route all traffic through Vercel. Vercel acts as your public SSL endpoint.

### Step 1: Deploy Webhook & Backend Tunnel
Run Ngrok pointing to your local port. Since we are on a 3GB RAM PC, configure Ngrok to run as a single background daemon:
```bash
sudo nano /etc/ngrok.yml
```
```yaml
version: "2"
authtoken: YOUR_NGROK_AUTHTOKEN
tunnels:
  backend:
    proto: http
    addr: 80 # Forward to Nginx port 80
    domain: app-backend-123.ngrok-free.app # Your free claimed domain
```
Start Ngrok:
```bash
sudo systemctl restart ngrok
```

### Step 2: Configure `vercel.json` in Frontend Root
Ensure Vercel proxies your API calls directly to Ngrok:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://app-backend-123.ngrok-free.app/:path*"
    }
  ],
  "headers": [
    {
      "source": "/api/:path*",
      "headers": [
        {
          "key": "x-proxy-header-secret",
          "value": "MY_CELERON_PROXY_TOKEN_9988"
        }
      ]
    }
  ]
}
```

### Step 3: Auth Validation Middleware
Verify the secret token on incoming requests to prevent direct scanning bots from overloading your Celeron processor:
```javascript
const EXPRESS_PORT = 5000;
const PROXY_TOKEN = "MY_CELERON_PROXY_TOKEN_9988";

app.use((req, res, next) => {
  if (req.headers['x-proxy-header-secret'] !== PROXY_TOKEN) {
    // Drop the connection immediately to save CPU cycles
    return res.status(403).end(); 
  }
  next();
});
```
