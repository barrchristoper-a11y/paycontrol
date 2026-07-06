# PayControl Deployment Guide

**Domain:** `paycontrol.swiftwaveholding.com`  
**Framework:** Node.js + Express + MongoDB  
**Server:** Nginx (reverse proxy)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [GitHub App Registration](#github-app-registration)
3. [Environment Configuration](#environment-configuration)
4. [MongoDB Setup](#mongodb-setup)
5. [Node.js Application Setup](#nodejs-application-setup)
6. [Nginx Configuration](#nginx-configuration)
7. [SSL/TLS Setup](#ssltls-setup)
8. [Testing](#testing)
9. [Production Checklist](#production-checklist)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js:** v18+ installed
- **MongoDB:** Running locally or cloud (Atlas)
- **Nginx:** Installed and configured for reverse proxy
- **OpenSSL:** For generating secrets and key pair
- **PM2 or systemd:** For process management
- **Domain:** `paycontrol.swiftwaveholding.com` (DNS configured)

---

## GitHub App Registration

### Step 1: Create GitHub App

1. Navigate to: https://github.com/settings/apps/new
2. Fill in the form:

```
GitHub App name:          PayControl
Description:              GitHub App access control and webhook management
Homepage URL:             https://paycontrol.swiftwaveholding.com
Webhook Active:           ✓ Check
Webhook URL:              https://paycontrol.swiftwaveholding.com/webhook
Webhook Secret:           [Generate via openssl rand -hex 32]
Authorization callback:   https://paycontrol.swiftwaveholding.com/oauth/callback
```

### Step 2: Configure Permissions

**Repository Permissions:**
- ✓ Contents → Read
- ✓ Metadata → Read  
- ✓ Members → Read
- ✓ Pull Requests → Write
- ✓ Issues → Read & Write

**Organization Permissions:**
- ✓ Members → Read

**User Permissions:**
- ✓ Email addresses → Read

### Step 3: Subscribe to Events

```
✓ Installation
✓ Installation repositories
✓ Push
✓ Pull request
✓ Repository
✓ Ping
```

### Step 4: Generate and Save Credentials

After saving, collect:

- **Client ID** → Copy to `GITHUB_CLIENT_ID` in `.env`
- **Client Secret** → Copy to `GITHUB_CLIENT_SECRET` in `.env`
- **App ID** (top of settings) → Copy to `GITHUB_APP_ID` in `.env`

Go to **Private keys** section:
- Click "Generate a private key"
- Download the `.pem` file
- Open with text editor and copy content
- Format for `.env`: Replace newlines with literal `\n`

---

## Environment Configuration

### Generate Secrets

```bash
# JWT Secret
openssl rand -hex 32
# Output: a7f9e2d4c6b1f3h5j7k9m2n4p6q8r0s2t4u6v8w0x2y4z6a8b0c2d4e6f8g0h2

# Session Secret
openssl rand -hex 32
# Output: b8g0f3e5d7c9b1a3f5h7j9k1m3n5p7q9r1s3t5u7v9w1x3y5z7a9b1c3d5e7f9

# Webhook Secret
openssl rand -hex 32
# Output: c9h1g4f6e8d0c2b4a6f8h0j2k4m6n8p0q2r4s6t8u0v2w4x6y8z0a2b4c6d8e0f
```

### Update .env File

Edit `.env` and replace all placeholders:

```env
# ─── Server ───────────────────────────────────
NODE_ENV=production
PORT=3000
BASE_URL=https://paycontrol.swiftwaveholding.com

# ─── MongoDB ──────────────────────────────────
MONGODB_URI=mongodb://127.0.0.1:27017/paycontrol

# ─── JWT ──────────────────────────────────────
JWT_SECRET=YOUR_32_CHAR_HEX_STRING
JWT_EXPIRES_IN=7d

# ─── Session ──────────────────────────────────
SESSION_SECRET=YOUR_32_CHAR_HEX_STRING

# ─── GitHub OAuth App ─────────────────────────
GITHUB_CLIENT_ID=Iv1.YOUR_ID_FROM_GITHUB
GITHUB_CLIENT_SECRET=ghp_YOUR_SECRET_FROM_GITHUB
GITHUB_CALLBACK_URL=https://paycontrol.swiftwaveholding.com/oauth/callback

# ─── GitHub App ───────────────────────────────
GITHUB_APP_ID=YOUR_APP_ID_NUMBER
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET

# ─── Security ─────────────────────────────────
CORS_ORIGIN=https://paycontrol.swiftwaveholding.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

**⚠️ Important:** Never commit the real `.env` file to GitHub. It's already in `.gitignore`.

---

## MongoDB Setup

### Option A: Local MongoDB (Development/Testing)

**Windows:**
```bash
# Download from https://www.mongodb.com/try/download/community
# Run installer and select "Install MongoDB Community Server"
# Start service: Services → MongoDB Server → Start

# Or via command line:
mongod --dbpath C:\data\db
```

**Linux/macOS:**
```bash
# macOS with Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Ubuntu
sudo apt-get install -y mongodb
sudo systemctl start mongodb
```

### Option B: MongoDB Atlas (Cloud - Recommended)

1. Go to: https://www.mongodb.com/cloud/atlas
2. Create account and cluster
3. Get connection string: `mongodb+srv://user:password@cluster.mongodb.net/paycontrol`
4. Update `MONGODB_URI` in `.env`

**Verify connection:**
```bash
mongo "mongodb://127.0.0.1:27017/paycontrol"
# Should connect without errors
```

---

## Node.js Application Setup

### 1. Install Dependencies

```bash
cd /path/to/paycontrol
npm install
```

### 2. (Optional) Seed Database

```bash
npm run seed
# Creates demo user, installations, and repositories
```

### 3. Start Application

**Development:**
```bash
npm run dev
# Uses nodemon for auto-reload
```

**Production with Node:**
```bash
npm start
```

**Production with PM2 (Recommended):**
```bash
# Install PM2 globally
npm install -g pm2

# Start app
pm2 start app.js --name "paycontrol"

# Auto-start on reboot
pm2 startup
pm2 save

# View logs
pm2 logs paycontrol

# Restart after .env changes
pm2 restart paycontrol

# Stop app
pm2 stop paycontrol
```

---

## Nginx Configuration

### Windows (BtSoft) Setup

Replace your Nginx config with this proxy-enabled version:

**File:** `C:/BtSoft/conf/nginx.conf` or `sites-available/paycontrol.swiftwaveholding.com.conf`

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name paycontrol.swiftwaveholding.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name paycontrol.swiftwaveholding.com;

    # SSL certificates
    ssl_certificate C:/BtSoft/ssl/paycontrol.swiftwaveholding.com/fullchain.pem;
    ssl_certificate_key C:/BtSoft/ssl/paycontrol.swiftwaveholding.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log C:/BtSoft/wwwlogs/paycontrol.access.log;
    error_log C:/BtSoft/wwwlogs/paycontrol.error.log;

    # Proxy all requests to Node.js app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Webhook endpoint (don't buffer for signature verification)
    location /webhook {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_request_buffering off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Deny sensitive files
    location ~ ^/(\.user.ini|\.htaccess|\.git|\.svn|\.project|LICENSE|README.md) {
        return 404;
    }

    # Well-known for SSL renewal
    location ~ \.well-known {
        allow all;
    }
}
```

### Reload Nginx

```bash
# Windows
nginx -s reload

# Linux/macOS
sudo systemctl reload nginx
# OR
sudo nginx -s reload
```

---

## SSL/TLS Setup

### Option A: Let's Encrypt (Recommended)

**Windows with Certbot:**
```bash
# Install Certbot for Windows from https://certbot.eff.org/
certbot certonly --webroot -w C:/BtSoft/wwwroot -d paycontrol.swiftwaveholding.com

# Certificates placed in: C:/BtSoft/etc/letsencrypt/live/paycontrol.swiftwaveholding.com/
```

**Linux:**
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d paycontrol.swiftwaveholding.com
```

### Option B: Self-Signed (Development Only)

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout privkey.pem -out fullchain.pem -days 365 -nodes

# Move to Nginx SSL directory
mv privkey.pem C:/BtSoft/ssl/paycontrol.swiftwaveholding.com/
mv fullchain.pem C:/BtSoft/ssl/paycontrol.swiftwaveholding.com/
```

### Option C: Commercial SSL

Purchase from your SSL provider and place certificates in:
```
C:/BtSoft/ssl/paycontrol.swiftwaveholding.com/fullchain.pem
C:/BtSoft/ssl/paycontrol.swiftwaveholding.com/privkey.pem
```

---

## Testing

### Health Check

```bash
curl https://paycontrol.swiftwaveholding.com/health

# Expected response:
# {"status":"healthy","timestamp":"2024-...","uptime":123.45}
```

### OAuth Flow

1. Open: https://paycontrol.swiftwaveholding.com/setup
2. Click "Sign in with GitHub"
3. Authorize app on GitHub
4. Should redirect to: https://paycontrol.swiftwaveholding.com/dashboard

### Webhook Test

1. Go to: https://github.com/settings/apps/paycontrol/advanced
2. "Recent Deliveries" tab
3. Should show "ping" event on initial setup
4. Install app on a repo and trigger events (push, PR, etc.)

### Dashboard Access

- **Login:** https://paycontrol.swiftwaveholding.com/setup → GitHub OAuth
- **Dashboard:** https://paycontrol.swiftwaveholding.com/dashboard
- **Account:** https://paycontrol.swiftwaveholding.com/dashboard/account
- **Repos:** https://paycontrol.swiftwaveholding.com/dashboard/repos

---

## Production Checklist

Before going live:

- [ ] GitHub App registered with correct URLs
- [ ] All `.env` variables filled (no placeholders)
- [ ] `.env` added to `.gitignore`
- [ ] MongoDB running and accessible
- [ ] Nginx configured with SSL certificates
- [ ] HTTPS redirect working (80 → 443)
- [ ] Health check passing
- [ ] OAuth flow tested
- [ ] Webhook endpoint reachable from GitHub
- [ ] PM2/systemd configured for auto-restart
- [ ] Logs configured and monitored
- [ ] Firewall allows 80, 443
- [ ] Database backups scheduled

---

## Troubleshooting

### App Won't Start

```bash
# Check port 3000 is available
netstat -ano | findstr :3000

# View PM2 logs
pm2 logs paycontrol

# Check .env syntax
node -e "require('dotenv').config(); console.log(process.env.GITHUB_APP_ID)"
```

### OAuth Redirect Error

- Verify `GITHUB_CALLBACK_URL` matches GitHub App settings
- Check `BASE_URL` is correct domain
- Ensure `CORS_ORIGIN` matches domain

### Webhook Not Received

- Check webhook URL in GitHub App settings
- Verify Nginx is proxying to port 3000
- Check firewall allows inbound traffic
- Review GitHub webhook delivery logs

### MongoDB Connection Error

```bash
# Test MongoDB connection
mongo "mongodb://127.0.0.1:27017/paycontrol"

# Verify MONGODB_URI in .env
node -e "require('dotenv').config(); console.log(process.env.MONGODB_URI)"
```

### Nginx SSL Error

```bash
# Test Nginx configuration
nginx -t

# View error logs
tail -f C:/BtSoft/wwwlogs/paycontrol.error.log
```

### 502 Bad Gateway

- Ensure Node.js app is running: `pm2 list`
- Check if port 3000 is listening: `netstat -ano | findstr :3000`
- Review Nginx error log
- Restart app: `pm2 restart paycontrol`

---

## Monitoring & Maintenance

### View Logs

```bash
# PM2 logs
pm2 logs paycontrol

# Nginx access
tail -f C:/BtSoft/wwwlogs/paycontrol.access.log

# Nginx errors
tail -f C:/BtSoft/wwwlogs/paycontrol.error.log
```

### Update App

```bash
# Pull latest changes
git pull

# Install updated dependencies
npm install

# Restart app
pm2 restart paycontrol
```

### SSL Certificate Renewal

```bash
# Let's Encrypt (auto-renews)
sudo certbot renew

# Nginx reloads after renewal
sudo systemctl reload nginx
```

---

## Support URLs

| Function | URL |
|----------|-----|
| Setup & Login | https://paycontrol.swiftwaveholding.com/setup |
| Dashboard | https://paycontrol.swiftwaveholding.com/dashboard |
| Account Settings | https://paycontrol.swiftwaveholding.com/dashboard/account |
| Repositories | https://paycontrol.swiftwaveholding.com/dashboard/repos |
| Health Check | https://paycontrol.swiftwaveholding.com/health |
| OAuth Callback | https://paycontrol.swiftwaveholding.com/oauth/callback |
| Webhook Endpoint | https://paycontrol.swiftwaveholding.com/webhook |
| GitHub App Settings | https://github.com/settings/apps/paycontrol |

---

**Last Updated:** 2024  
**Version:** 1.0.0
