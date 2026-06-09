# Self-Hosting Guide: Turning an Old PC into a Backend Server

This guide provides a comprehensive, step-by-step plan to convert a low-spec PC (e.g., Intel Pentium, 4GB RAM) into a reliable, self-hosted backend server. It details how to connect this server to a frontend deployed on Vercel, secure it against external threats, set up database replication/backups, establish a lightweight CI/CD pipeline, and monitor its performance.

---

## Table of Contents
1. [System Design & Architecture](#1-system-design--architecture)
2. [Server Setup on Low-Spec PC](#2-server-setup-on-low-spec-pc)
3. [Backend Deployment & Process Management](#3-backend-deployment--process-management)
4. [Database Configuration & Backups](#4-database-configuration--backups)
5. [CI/CD Pipeline (Lightweight Deployment)](#5-cicd-pipeline-lightweight-deployment)
6. [Networking, Tunnels & Security](#6-networking-tunnels--security)
7. [Monitoring & Maintenance](#7-monitoring--maintenance)
8. [Hardware Constraints & Scaling Path](#8-hardware-constraints--scaling-path)

---

## 1. System Design & Architecture

For a self-hosted backend paired with a cloud-hosted frontend (Vercel), the architecture must account for the physical isolation of your hardware and the typical limitations of residential internet connections (dynamic IPs, CGNAT, and security risks).

### Architectural Overview
```mermaid
graph TD
    Client[Client Browser / Mobile App] -->|HTTPS| Vercel[Vercel Frontend]
    Client -->|HTTPS API Requests| CloudflareEdge[Cloudflare Edge / DNS]
    CloudflareEdge -->|Secure Tunnel| CFTunnel[Cloudflare Tunnel daemon on Local PC]
    CFTunnel -->|HTTP localhost:3000| Nginx[Nginx Reverse Proxy]
    Nginx -->|HTTP localhost:5000| Backend[Node.js / Python Backend]
    Backend -->|Local TCP/Unix Socket| Database[(SQLite / PostgreSQL)]
```

### Request Flow
1. **Frontend Assets**: The user loads your app. Vercel serves the HTML, CSS, and JS from their global CDN.
2. **API Calls**: When the frontend makes an API call (e.g., `https://api.yourdomain.com/v1/users`), the request resolves to the Cloudflare network.
3. **Tunneling**: Cloudflare routes the request through a secure outbound WebSocket/gRPC connection established by the `cloudflared` daemon running on your local PC. This bypasses the need for port forwarding or a public static IP.
4. **Reverse Proxying**: The local tunnel client forwards the request to your Nginx reverse proxy.
5. **Application Execution**: Nginx receives the request, terminates SSL (handled by Cloudflare in this setup, or locally if desired), and forwards it to your Node.js or Python backend running on a local port (e.g., `5000`).
6. **Database Access**: The backend queries the database (PostgreSQL/SQLite) running on the same machine and returns the response.

### CORS Configuration
Because your frontend is hosted on Vercel (e.g., `https://myproject.vercel.app` or `https://yourdomain.com`) and the backend runs on your local server's public endpoint (e.g., `https://api.yourdomain.com`), you **must** configure Cross-Origin Resource Sharing (CORS) on your backend.

#### Example CORS Configuration (Node.js/Express)
```javascript
const express = require('express');
const cors = require('cors');
const app = express();

const allowedOrigins = [
  'https://myproject.vercel.app',
  'https://yourdomain.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## 2. Server Setup on Low-Spec PC

An old PC with a Pentium processor and 4GB RAM will struggle if loaded with a graphical user interface (GUI). The first step is installing a lightweight, headless operating system.

### Recommended OS: Debian Server (12 "Bookworm") or Ubuntu Server (24.04 LTS)
* **Debian 12 Headless** is the gold standard for low-spec systems. Idle RAM consumption is typically under **150MB**, leaving over 3.8GB of RAM for your database, backend, and system cache.
* **Avoid**: Ubuntu Desktop, Linux Mint, or Windows Server. Their GUIs and telemetry will consume 1.5GB to 2.5GB of RAM just sitting idle.

### OS Installation Steps
1. **Download Image**: Download the [Debian Network Installer ISO](https://www.debian.org/distrib/netinst).
2. **Flash to USB**: Use [Rufus](https://rufus.ie/) (Windows) or [BalenaEtcher](https://etcher.balena.io/) (Mac/Linux) to flash the ISO to a USB drive.
3. **BIOS Configurations**:
   - Plug the USB into the old PC and boot into the BIOS (usually by pressing `F2`, `F12`, or `Del` at startup).
   - **Power Settings**: Enable "Restore on AC Power Loss" (often found under Power Management). This ensures that if a power outage occurs, the PC automatically boots back up when power returns.
   - **Lid Close Settings (If using an old Laptop)**: If your old PC is a laptop, configure the system to not suspend when the lid is closed. In Linux, edit the systemd configuration file:
     ```bash
     sudo nano /etc/systemd/logind.conf
     ```
     Uncomment and change the following lines:
     ```ini
     HandleLidSwitch=ignore
     HandleLidSwitchExternalPower=ignore
     ```
     Restart the service:
     ```bash
     sudo systemctl restart systemd-logind
     ```
4. **Debian Installer Choices**:
   - Choose **Graphical Install**.
   - Set up your hostname, root password, and a standard user account.
   - **Software Selection (CRITICAL)**: Uncheck all desktop environments (GNOME, XFCE, KDE, etc.). Keep **only** "SSH Server" and "Standard System Utilities" checked.

### Performance Tuning for Low RAM (4GB)

#### 1. Configure Swap Space
Swap acts as emergency overflow memory on your disk when RAM is full. Since you only have 4GB of RAM, set up a **4GB swap file**. If you have an SSD, swap will be relatively fast; on an HDD, it will be slow but will prevent Out-Of-Memory (OOM) crashes.

```bash
# Check if swap exists
sudo swapon --show

# Create a 4GB swap file
sudo fallocate -l 4G /swapfile

# Set correct permissions
sudo chmod 600 /swapfile

# Format as swap
sudo mkswap /swapfile

# Enable swap
sudo swapon /swapfile

# Make it permanent by adding it to fstab
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Configure the **swappiness** (how aggressively the OS swaps memory). For servers, a lower swappiness (e.g., `10` or `20`) is preferred so that it keeps data in active RAM as long as possible:
```bash
# Check current swappiness (default is usually 60)
cat /proc/sys/vm/swappiness

# Temporarily set to 15
sudo sysctl vm.swappiness=15

# Make it permanent
echo 'vm.swappiness=15' | sudo tee -a /etc/sysctl.conf
```

#### 2. Install Core Software Stack
Update repositories and install required tools:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ufw fail2ban certbot python3-certbot-nginx nginx
```

##### Installing Node.js (via NodeSource):
```bash
# Install Node.js LTS (e.g., v20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

##### Installing Docker (Optional):
> [!WARNING]
> While Docker makes deployments simple, running Docker containers introduces an overhead of ~50-100MB of RAM per daemon/container group. On a 4GB RAM Pentium, running services **bare-metal** (native Node.js/Python and native Postgres) is highly recommended over Docker to squeeze out maximum performance.

---

## 3. Backend Deployment & Process Management

Never start your backend application using `node index.js` or `python app.py` directly in an SSH terminal. If your SSH connection drops or the app crashes, your server will go offline. Use a process manager instead.

### Option A: Process Management with PM2 (Recommended for Node.js)
PM2 is a production-grade process manager that handles auto-restarts, monitoring, and startup scripting.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Navigate to your backend directory
cd /var/www/my-backend

# Start your application with PM2
pm2 start index.js --name "my-backend-api"

# Save the current list of PM2 processes
pm2 save

# Generate a startup script to launch PM2 on system boot
pm2 startup
```
*Note: The `pm2 startup` command will output a specific command that you must copy-paste and run with `sudo` to register the boot hook.*

#### Key PM2 Commands:
* Check status: `pm2 status`
* View real-time logs: `pm2 logs`
* Restart app: `pm2 restart my-backend-api`
* Monitor CPU/RAM: `pm2 monit`

### Option B: Process Management with systemd (Recommended for Python/General)
For Python (Flask, Django, FastAPI) or Go backends, systemd is built directly into Linux and requires no extra software.

1. **Create service file**:
   ```bash
   sudo nano /etc/systemd/system/backend.service
   ```
2. **Add configuration**:
   ```ini
   [Unit]
   Description=Python Backend Server
   After=network.target

   [Service]
   User=deploy-user
   WorkingDirectory=/var/www/my-backend
   ExecStart=/var/www/my-backend/venv/bin/gunicorn --workers 2 --bind 127.0.0.1:5000 app:app
   Restart=always
   RestartSec=5
   Environment=PORT=5000 NODE_ENV=production DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

   [Install]
   WantedBy=multi-user.target
   ```
3. **Start and Enable Service**:
   ```bash
   sudo systemctl daemon-reload
   # Start the service immediately
   sudo systemctl start backend.service
   # Make the service start automatically on boot
   sudo systemctl enable backend.service
   ```
4. **View logs**:
   ```bash
   # Follow logs in real-time
   sudo journalctl -u backend.service -f
   ```

### Reverse Proxy Setup (Nginx)
Nginx sits in front of your backend, acting as a buffer that manages connections, provides rate limiting, and forwards client requests to the correct local port.

Create a virtual host configuration file:
```bash
sudo nano /etc/nginx/sites-available/backend.conf
```

Paste the configuration below, replacing domain names and ports:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Increase maximum upload size (useful for file uploads)
    client_max_body_size 10M;

    # Gzip Compression to optimize speed over slow connections
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    location / {
        proxy_pass http://127.0.0.1:5000; # Forward request to your Node.js or Python port
        proxy_http_version 1.1;
        
        # Necessary headers for WebSockets / Keep-Alive
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Forward client IP details to backend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts to handle long database operations
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Enable the site configuration and restart Nginx:
```bash
# Link the configuration to make it active
sudo ln -s /etc/nginx/sites-available/backend.conf /etc/nginx/sites-enabled/

# Test Nginx configuration for errors
sudo nginx -t

# Reload configuration changes
sudo systemctl reload nginx
```

---

## 4. Database Configuration & Backups

Choosing the right database and configuring it to be light on memory is vital on a 4GB RAM server.

### Database Trade-offs for Low-Spec PC

| Database | Memory Footprint | Best Use Case | Performance Config Needed |
| :--- | :--- | :--- | :--- |
| **SQLite** | **Near-zero** (<10MB RAM) | Small-to-medium relational projects. App stores database in a single local file. | Set journal mode to WAL (`PRAGMA journal_mode=WAL;`). |
| **PostgreSQL**| **Moderate** (128MB - 512MB RAM) | Standard relational applications requiring strict consistency, concurrency, and scaling. | Limit shared buffers and connection pools (see instructions below). |
| **MongoDB** | **High** (Minimum 512MB+ RAM) | Document-store, NoSQL structures. | Manually restrict WiredTiger cache memory (`--wiredTigerCacheSizeGB 0.25`). |

### SQLite Performance Tuning (WAL Mode)
SQLite is incredibly fast if you enable **Write-Ahead Logging (WAL)**. WAL allows concurrent reads and writes, preventing write locks.
Run these SQL queries once on initialization:
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -64000; -- Uses roughly 64MB of RAM for index caching
```

### PostgreSQL Performance Tuning for 4GB RAM
If you use PostgreSQL, do not run with default configurations, which are designed for high-end systems and can exhaust RAM quickly.

Edit the configuration file (location varies by version, e.g., `/etc/postgresql/16/main/postgresql.conf`):
```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
```

Locate and tune these variables for a 4GB RAM environment:
```ini
max_connections = 30           # Lower connections to save RAM (each connection takes ~10MB)
shared_buffers = 512MB          # Cache memory (set to 12.5% of total RAM)
effective_cache_size = 1536MB   # Expected available system memory cache
work_mem = 8MB                  # RAM allocated per sort operation (lowered)
maintenance_work_mem = 128MB    # RAM for index updates and vaccuum
min_wal_size = 512MB
max_wal_size = 2GB
```
Restart PostgreSQL to apply:
```bash
sudo systemctl restart postgresql
```

### Database Backup & Persistence Strategy
A local disk can fail. You must schedule automated off-site backups using `cron`.

#### Backup Script (`/home/deploy-user/backup_db.sh`):
```bash
#!/bin/bash
# Configuration
BACKUP_DIR="/home/deploy-user/backups"
DB_NAME="myproject_prod"
DB_USER="postgres"
DATE=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Dump database and compress
pg_dump -U "$DB_USER" -h localhost "$DB_NAME" | gzip > "$BACKUP_FILE"

# Delete backups older than 7 days to conserve disk space
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -delete

# (Optional) Upload to external storage. E.g., using Rclone to upload to Google Drive:
# rclone copy "$BACKUP_FILE" gdrive:my-backups/
```
Make the script executable:
```bash
chmod +x /home/deploy-user/backup_db.sh
```

#### Automating the backup with Cron:
```bash
# Edit crontab
crontab -e
```
Add the following line to run the backup daily at 3:00 AM:
```cron
0 3 * * * /home/deploy-user/backup_db.sh
```

---

## 5. CI/CD Pipeline (Lightweight Deployment)

Running full CI/CD runtimes (like Github Actions Runner) on the local machine will quickly saturate memory. Instead, use a **Webhook Receiver** approach: the server listens for code change events from GitHub, triggers a pull script, installs packages, and reloads the process manager.

### Step 1: Write the Deployment Script (`/var/www/deploy.sh`)
Create a shell script that pulls code, builds the app, and restarts the backend process:
```bash
#!/bin/bash
# Go to project directory
cd /var/www/my-backend

# Pull latest code from production branch
git checkout main
git pull origin main

# Install dependencies (production only to save memory)
npm install --production

# Reload application with zero downtime (if using PM2)
pm2 reload my-backend-api

# If using systemd instead of PM2, uncomment this line:
# sudo systemctl restart backend.service

echo "Deployment complete at $(date)"
```
Make the script executable:
```bash
chmod +x /var/www/deploy.sh
```

### Step 2: Implement a Secure Node.js Webhook Server
You can build a small Node.js script that listens on a private port (e.g., `9000`), validates the GitHub signature (so unauthorized users cannot trigger deployments), and triggers the `deploy.sh` script.

#### Install Webhook Listener:
Create a folder `/var/www/webhook` and install the package `github-webhook-handler`:
```bash
mkdir -p /var/www/webhook && cd /var/www/webhook
npm init -y
npm install github-webhook-handler
```

Create `webhook.js`:
```javascript
const http = require('http');
const createHandler = require('github-webhook-handler');
const { exec } = require('child_process');

const secret = 'YOUR_GITHUB_WEBHOOK_SECRET_KEY'; // Choose a secure secret phrase
const port = 9000;

const handler = createHandler({ path: '/webhook', secret: secret });

http.createServer(function (req, res) {
  handler(req, res, function (err) {
    res.statusCode = 404;
    res.end('no such location');
  });
}).listen(port, () => {
  console.log(`Webhook server listening on port ${port}`);
});

handler.on('error', function (err) {
  console.error('Error:', err.message);
});

handler.on('push', function (event) {
  console.log('Received a push event for %s to %s',
    event.payload.repository.name,
    event.payload.ref);
  
  if (event.payload.ref === 'refs/heads/main') {
    console.log('Push is to main branch, running deploy script...');
    exec('/var/www/deploy.sh', (err, stdout, stderr) => {
      if (err) {
        console.error(`Execution error: ${err}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
      if (stderr) console.error(`stderr: ${stderr}`);
    });
  }
});
```

Run this webhook receiver permanently using PM2:
```bash
pm2 start webhook.js --name "github-webhook"
pm2 save
```

### Step 3: Register Webhook on GitHub
1. Go to your GitHub Repository -> **Settings** -> **Webhooks** -> **Add Webhook**.
2. **Payload URL**: `https://api.yourdomain.com/webhook` (or via your tunnel domain).
3. **Content type**: `application/json`.
4. **Secret**: Enter the exact token set in `webhook.js`.
5. Under "Which events would you like to trigger this webhook?", select **Just the push event**.
6. Click **Add webhook**.

---

## 6. Networking, Tunnels & Security

To access your server from Vercel, the backend must be exposed to the public internet securely.

### Exposing the Server: Cloudflare Tunnels (Best Approach)
A Cloudflare Tunnel (`cloudflared`) connects your local server to the Cloudflare network over secure outbound connections. 
* **Benefits**: You do not need to configure port forwarding in your router, purchase a static public IP, or deal with dynamic DNS. It completely hides your home public IP from attackers.

#### Setup Guide:
1. Sign up for a free account at [Cloudflare](https://www.cloudflare.com/).
2. Point your domain nameservers to Cloudflare.
3. In the Cloudflare Dashboard, go to **Zero Trust** -> **Networks** -> **Tunnels** -> **Create a Tunnel**.
4. Choose **Cloudflare Tunnel (Connector)**. Name it `local-backend`.
5. Install the connector on your local PC. Cloudflare will give you a single copy-paste command for Debian, which looks like this:
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && 
   sudo dpkg -i cloudflared.deb && 
   sudo cloudflared service install YOUR_TOKEN_STRING
   ```
6. Once the connector status registers as "Active" in the Cloudflare Dashboard, go to the **Route** tab of your tunnel.
7. Add a public hostname:
   - **Subdomain**: `api`
   - **Domain**: `yourdomain.com`
   - **Service Type**: `HTTP`
   - **URL**: `localhost:80` (or `localhost:5000` if bypassing Nginx, though Nginx is recommended).
8. Save. Cloudflare will automatically route DNS and handle SSL for `https://api.yourdomain.com`.

### Traditional Option: Port Forwarding + Dynamic DNS + Let’s Encrypt
If you prefer not to use Cloudflare, you must manually open port `80` and `443` on your home router pointing to your server's local static IP.

#### Steps:
1. **Local Static IP**: Set a static IP on your server inside your router settings (e.g., `192.168.1.100`).
2. **Port Forwarding**: Forward TCP ports `80` (HTTP) and `443` (HTTPS) to `192.168.1.100` in your router's administration portal.
3. **Dynamic DNS (DDNS)**: If your ISP gives you a dynamic public IP, install a client like `ddclient` or use a service like [DuckDNS](https://www.duckdns.org/) to automatically update your domain to point to your changing public IP.
4. **SSL Setup with Let's Encrypt**:
   Once your domain is resolving to your server's public IP, generate an SSL certificate:
   ```bash
   sudo certbot --nginx -d api.yourdomain.com
   ```
   Certbot will automatically edit your Nginx configuration to add SSL configurations and set up an automatic renewal cron job.

### System Hardening & Firewall
Since the PC is connected to the internet, secure it immediately.

#### 1. Setup UFW (Uncomplicated Firewall)
UFW simplifies iptables management. Block all incoming connections except for SSH, HTTP, and HTTPS:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow standard web traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (If you use a custom SSH port, allow that instead, e.g., 2222/tcp)
sudo ufw allow 22/tcp

# Enable Firewall
sudo ufw enable
```

#### 2. SSH Hardening
Edit the SSH configuration file:
```bash
sudo nano /etc/ssh/sshd_config
```
Modify these properties for enhanced security:
```ini
Port 22                     # Change default port (e.g., 2222) to avoid automatic scanning bots
PermitRootLogin no          # Disable root log-in via SSH
PasswordAuthentication no   # Disable password login; require SSH keys (recommended)
MaxAuthTries 3              # Lock after 3 failed attempts
```
Generate and copy your SSH key from your main computer:
```bash
# Run on your developer machine:
ssh-copy-id -p <port> user@<server_ip>
```
Restart SSH:
```bash
sudo systemctl restart ssh
```

#### 3. Fail2ban Protection
Fail2ban scans system logs and bans IPs that show malicious signs, such as too many password failures.
Create a local config file for Fail2ban:
```bash
sudo nano /etc/fail2ban/jail.local
```
Add configuration:
```ini
[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 1d
findtime = 10m
```
Restart Fail2ban:
```bash
sudo systemctl restart fail2ban
```

---

## 7. Monitoring & Maintenance

Maintaining system health will prevent sudden downtime caused by running out of disk space or memory leaks.

### Resource Monitoring Commands
* **RAM / CPU Usage**: Use `htop` (color-based system monitor):
  ```bash
  htop
  ```
* **Disk Space Usage**: Use `df -h` to verify you aren't running out of space (crucial for databases):
  ```bash
  df -h
  ```
* **Memory Breakdown**: `free -m` displays exact active, free, and swap allocations in Megabytes:
  ```bash
  free -m
  ```

### Handling Disk Space: Log Rotation
Over time, logs generated by Nginx, PM2, and your applications will grow. If they consume 100% of your disk, your database will fail to write data, causing system-wide crashes.

Use `logrotate` to compress and rotate system logs daily. Create a configuration for your backend application:
```bash
sudo nano /etc/logrotate.d/my-backend
```
Add configuration:
```text
/var/www/my-backend/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0660 deploy-user www-data
    sharedscripts
}
```

### Discord/Telegram Webhook Alerts
Create a bash script (`/home/deploy-user/system_check.sh`) to ping a Discord/Telegram channel if RAM or disk space is running dangerously low:

```bash
#!/bin/bash
# Threshold limit (%)
DISK_LIMIT=85
RAM_LIMIT=90
WEBHOOK_URL="YOUR_DISCORD_WEBHOOK_URL"

# Check Disk
DISK_USAGE=$(df / | grep / | awk '{ print $5 }' | sed 's/%//g')
if [ "$DISK_USAGE" -gt "$DISK_LIMIT" ]; then
  curl -H "Content-Type: application/json" -X POST -d "{\"content\": \"⚠️ WARNING: Server Disk space is critically low at ${DISK_USAGE}%\"}" $WEBHOOK_URL
fi

# Check RAM
RAM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
if [ "$RAM_USAGE" -gt "$RAM_LIMIT" ]; then
  curl -H "Content-Type: application/json" -X POST -d "{\"content\": \"⚠️ WARNING: Server RAM usage is extremely high at ${RAM_USAGE}%\"}" $WEBHOOK_URL
fi
```
Add this script to user's crontab to execute every hour.

---

## 8. Hardware Constraints & Scaling Path

Hosting on an old Pentium PC is an excellent, cost-effective way to get started. However, you must understand its constraints and plan your scaling path.

### Constraints of Low-Spec Hardware
1. **CPU Bound Operations**: Modern tasks like PDF generation, file compression, image processing, or cryptography (JWT generation, Bcrypt hashing) run slowly on old Pentiums. Offload CPU-heavy tasks to client-side processes where possible.
2. **HDD vs. SSD**: If your old PC runs on a mechanical HDD, database read/write speeds will be low, leading to high response latencies. **Upgrading to a cheap SATA SSD is the single most effective hardware upgrade you can make.**
3. **Power Outages & Network Outages**: Unlike data centers, home servers don't have redundant power supplies, backup generators, or high-bandwidth enterprise fiber lines. 

### When to Upgrade to Cloud Infrastructure
Move to a cloud provider when:
* **The system requires 99.9% uptime**: If you have active paying customers who cannot tolerate power drops or ISP maintenance windows.
* **Database size grows**: If your database reaches 10GB+, backup uploads will saturate your home connection's upload bandwidth, causing latency spikes for active users.
* **Concurrent Users Increase**: If more than 10-20 active users query your system simultaneously, the Pentium CPU and limited thread pool will create query queues, slowing down response times.

### Recommended Cloud Migration Strategy
When you are ready to scale, follow this progression path:

```mermaid
graph LR
    LocalServer[Local Server / Pentium] -->|Migrate Database| Supabase[Supabase / Postgres Managed]
    LocalServer -->|Deploy APIs| VPS[VPS: DigitalOcean / Hetzner / AWS Lightsail]
    VPS -->|Auto-Scale Containerized| Render[Render / AWS ECS]
```

1. **Step 1: Database Migration**: Migrate your database to a managed service like **Supabase** or **Neon**. Relieving your local server from running database queries will instantly double the remaining system performance.
2. **Step 2: Backend VPS Migration**: Move your backend api into a standard Virtual Private Server (VPS) on **DigitalOcean**, **Hetzner**, or **AWS Lightsail**. A basic $5/month VPS will easily outperform an old local Pentium due to newer CPU architecture, high-speed NVMe drives, and direct connection to major internet backbones.
