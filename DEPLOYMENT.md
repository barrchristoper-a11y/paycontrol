# PayControl Deployment Guide

**Domain:** `paycontrol.swiftwaveholding.com`  
**Framework:** Node.js + Express + PostgreSQL  
**Server:** Nginx (reverse proxy)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [PostgreSQL Setup](#postgresql-setup)
4. [Node.js Application Setup](#nodejs-application-setup)
5. [Nginx Configuration](#nginx-configuration)
6. [SSL/TLS Setup](#ssltls-setup)
7. [Testing](#testing)
8. [Production Checklist](#production-checklist)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js:** v18+ installed
- **PostgreSQL:** v12+ running locally, on Neon, or cloud (AWS RDS, DigitalOcean, etc.)
- **Nginx:** Installed and configured for reverse proxy
- **OpenSSL:** For generating secrets and key pair
- **PM2 or systemd:** For process management
- **Domain:** `paycontrol.swiftwaveholding.com` (DNS configured)

---

## Environment Configuration

### Generate Secrets

```bash
# JWT Secret
openssl rand -hex 32

# JWT Refresh Secret  
openssl rand -hex 32

# Webhook Secret (for Stripe/Plaid)
openssl rand -hex 32
```

### Create .env File

Copy `.env.example` to `.env` and fill in all required values:

```bash
cd backend
cp .env.example .env
# Edit .env with real secrets (NEVER commit this file)
```

**Critical Environment Variables:**
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@host:5432/paycontrol
JWT_SECRET=<generated-secret>
JWT_REFRESH_SECRET=<generated-secret>
FRONTEND_URL=https://paycontrol.swiftwaveholding.com
PLAID_CLIENT_ID=<from-plaid-dashboard>
PLAID_SECRET=<from-plaid-dashboard>
STRIPE_SECRET_KEY=sk_live_<your-key>
STRIPE_WEBHOOK_SECRET=whsec_<your-secret>
```

---

## PostgreSQL Setup

### Option 1: Using Neon (Recommended for Cloud)

1. Create account at https://neon.tech
2. Create a project and database
3. Copy connection string to `DATABASE_URL` in `.env`
4. Connection string format: `postgresql://user:password@host:5432/dbname?sslmode=require`

### Option 2: Local PostgreSQL

```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib  # Ubuntu/Debian
brew install postgresql  # macOS

# Start service
sudo systemctl start postgresql  # Ubuntu/Debian
brew services start postgresql  # macOS

# Create database and user
sudo -u postgres psql
CREATE DATABASE paycontrol;
CREATE USER paycontrol_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE paycontrol TO paycontrol_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO paycontrol_user;
\q
```

### Initialize Database Schema

```bash
# Navigate to project root
cd /path/to/paycontrol

# Run schema setup script
bash scripts/setup-database.sh

# Or manually:
psql $DATABASE_URL -f database/schema.sql

# Optional: Seed demo data
psql $DATABASE_URL -f database/seeders/demoData.sql
```

---

## Node.js Application Setup

```bash
# Install backend dependencies
cd backend
npm install

# Test the connection
node -e "require('dotenv').config(); const db = require('./config/db'); db.query('SELECT NOW()').then(r => console.log('DB Connected:', r.rows[0]))"

# Start server (test)
npm start

# Should see: "Server running on port 3000"
```

### Production Process Manager

#### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file: ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'paycontrol-backend',
      script: './backend/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G',
      watch: false
    }
  ]
};
EOF

# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Auto-start on system reboot
pm2 startup systemd -u $USER --hp /home/$USER
```

#### Using Systemd

Create `/etc/systemd/system/paycontrol.service`:

```ini
[Unit]
Description=PayControl Backend
After=network.target

[Service]
Type=simple
User=paycontrol
WorkingDirectory=/opt/paycontrol
EnvironmentFile=/opt/paycontrol/.env
ExecStart=/usr/bin/node /opt/paycontrol/backend/server.js
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable paycontrol
sudo systemctl start paycontrol
sudo systemctl status paycontrol
```

---

## Nginx Configuration

Create `/etc/nginx/sites-available/paycontrol`:

```nginx
upstream paycontrol_backend {
    server 127.0.0.1:3000;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name paycontrol.swiftwaveholding.com;
    return 301 https://$server_name$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name paycontrol.swiftwaveholding.com;

    # SSL Certificates (see SSL/TLS Setup section)
    ssl_certificate /etc/letsencrypt/live/paycontrol.swiftwaveholding.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/paycontrol.swiftwaveholding.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logging
    access_log /var/log/nginx/paycontrol_access.log combined;
    error_log /var/log/nginx/paycontrol_error.log warn;

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1000;

    # Frontend (static files)
    location / {
        root /opt/paycontrol/frontend;
        try_files $uri $uri/ /index.html;
        
        # Cache control for static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # API proxy
    location /api/ {
        proxy_pass http://paycontrol_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://paycontrol_backend;
        access_log off;
    }
}
```

Enable the configuration:

```bash
sudo ln -s /etc/nginx/sites-available/paycontrol /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

---

## SSL/TLS Setup

### Using Let's Encrypt (Free & Automated)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx  # Ubuntu/Debian
brew install certbot  # macOS

# Generate certificate
sudo certbot certonly --nginx -d paycontrol.swiftwaveholding.com

# Auto-renewal (runs daily)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Test renewal
sudo certbot renew --dry-run
```

### Manual Certificate (Self-signed for testing only)

```bash
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365
```

---

## Testing

### Health Check

```bash
curl https://paycontrol.swiftwaveholding.com/api/health
# Should return: {"status":"OK","timestamp":"2024-01-01T12:00:00.000Z"}
```

### Database Connection Test

```bash
psql $DATABASE_URL -c "SELECT NOW();"
```

### Login Test

```bash
curl -X POST https://paycontrol.swiftwaveholding.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

---

## Production Checklist

- [ ] All secrets generated and in `.env` (not in repo)
- [ ] Database created and schema initialized
- [ ] PostgreSQL backup strategy configured
- [ ] Node.js process manager configured (PM2 or systemd)
- [ ] Nginx reverse proxy configured
- [ ] SSL certificate installed and auto-renewal working
- [ ] Security headers configured in Nginx
- [ ] Firewall rules configured (port 443, 80 open)
- [ ] Logs directory created with proper permissions
- [ ] Error tracking (Sentry) configured
- [ ] Monitoring/alerting configured
- [ ] Database connection pooling tested
- [ ] Rate limiting tested
- [ ] CORS origins verified
- [ ] All API endpoints tested
- [ ] Frontend served correctly
- [ ] Backup and recovery procedure tested
- [ ] Load testing completed
- [ ] Security audit passed (npm audit)
- [ ] Documentation updated
- [ ] Deployment runbook created

---

## Troubleshooting

### Server won't start

```bash
# Check if port 3000 is in use
lsof -i :3000

# Check environment variables
echo $DATABASE_URL
echo $JWT_SECRET

# Check logs
pm2 logs paycontrol-backend
# or
tail -f /var/log/syslog | grep paycontrol
```

### Database connection errors

```bash
# Test connection string
psql "postgresql://user:password@host:5432/dbname?sslmode=require"

# Check if database exists
psql -c "\l"

# Check user permissions
psql -c "\du"
```

### Nginx 502 Bad Gateway

```bash
# Check backend is running
ps aux | grep node

# Check backend logs
pm2 logs

# Verify upstream address in nginx config
curl http://127.0.0.1:3000/api/health
```

### SSL Certificate Issues

```bash
# Check certificate validity
openssl s_client -connect paycontrol.swiftwaveholding.com:443

# View certificate details
sudo openssl x509 -in /etc/letsencrypt/live/paycontrol.swiftwaveholding.com/fullchain.pem -text -noout
```
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
