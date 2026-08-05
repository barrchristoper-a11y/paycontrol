# PayControl Security Recommendations

## 🔴 CRITICAL ISSUES (Fix Immediately)

### 1. Rotate Exposed API Keys
**Status:** URGENT - Keys in `.env.example` have been exposed publicly

**Affected Keys:**
- Plaid Client ID: `6a7130849fbc5b000d42e4be`
- Plaid Secret: `e6ad723905d218819f43b28a8646e2`
- ALCHEMY_API_KEY: Visible in code
- SENTRY_DSN_BACKEND: `4511850153246720`

**Actions Required:**
1. ✅ Update `.env.example` with placeholder values (COMPLETED)
2. **Immediately rotate these keys in your provider dashboards:**
   - Plaid: https://dashboard.plaid.com → Settings → Security
   - Alchemy: https://www.alchemy.com/ → API Keys → Delete compromised keys
   - Sentry: https://sentry.io/ → Settings → Auth Tokens
   - Stripe: https://dashboard.stripe.com/ → Developers → API Keys
3. Generate new keys
4. Update `.env` file with new values
5. Verify no secrets are in git history:
   ```bash
   git log --all -p -S "6a7130849fbc5b000d42e4be"
   ```
6. If found in history, use `git-filter-branch` or `BFG Repo Cleaner` to remove

---

## 🟠 HIGH PRIORITY SECURITY FIXES

### 1. Secure Token Storage (Frontend)

**Current Issue:** Tokens stored in `localStorage` (XSS vulnerable)
```javascript
// VULNERABLE - DO NOT USE
localStorage.setItem('token', token);
localStorage.setItem('refreshToken', refreshToken);
```

**Recommended Solution:** Use httpOnly, Secure cookies
```javascript
// Server-side: Set cookie after login
res.cookie('accessToken', token, {
    httpOnly: true,
    secure: true,  // HTTPS only
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
});

res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
});
```

```javascript
// Frontend: Send cookies automatically (no localStorage)
// Fetch API sends cookies by default with credentials: 'include'
fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',  // Send cookies
    body: JSON.stringify({ email, password })
});
```

**Benefits:**
- Protection against XSS attacks
- Automatic browser security (httpOnly blocks JS access)
- CSRF tokens can be added for extra protection

---

### 2. Add Environment Variable Validation

**Current Issue:** Server silently fails if env vars missing

**Fix:** Add startup validation in `backend/server.js`:
```javascript
// At top of server.js, after require('dotenv').config()
const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'NODE_ENV',
    'PORT',
    'FRONTEND_URL'
];

requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
        console.error(`❌ FATAL: Missing environment variable: ${envVar}`);
        process.exit(1);
    }
});

console.log('✅ All required environment variables present');
```

---

### 3. Add HTTPS Enforcement

**Current Issue:** No redirect from HTTP to HTTPS in Node app

**Fix:** Add middleware in `backend/server.js`:
```javascript
// After CORS setup, before routes
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
        return res.redirect(301, `https://${req.header('host')}${req.originalUrl}`);
    }
    next();
});
```

---

### 4. Fix SQL Injection Risk

**Current Issue:** String interpolation in SQL (auth.js, line 31)
```javascript
// VULNERABLE
INSERT INTO refresh_tokens (...) 
VALUES (..., NOW() + INTERVAL '${process.env.JWT_REFRESH_EXPIRES_IN}')`
```

**Fix:** Use parameters or cast explicitly
```javascript
// SAFER: Use parameter
await db.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) 
     VALUES ($1, $2, NOW() + INTERVAL '1 week')
     ON CONFLICT (user_id) DO UPDATE SET ...`,
    [user.id, refreshToken]
);

// OR store interval in database
await db.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) 
     VALUES ($1, $2, NOW() + ($3 || ' days')::interval)
     ON CONFLICT (user_id) DO UPDATE SET ...`,
    [user.id, refreshToken, 7]
);
```

---

### 5. Add CSRF Protection

**Current Implementation:** None detected

**Fix:** Add CSRF token middleware
```javascript
// Install: npm install csurf cookie-parser

const csrf = require('csurf');
const cookieParser = require('cookie-parser');

// In server.js
app.use(cookieParser());
app.use(csrf({ cookie: false }));  // Use session-based tokens

// In routes
router.get('/login-page', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

router.post('/login', (req, res) => {
    // CSRF token validated automatically
    // Continue login logic
});
```

---

## 🟡 MEDIUM PRIORITY IMPROVEMENTS

### 1. Implement Rate Limiting Per User

**Current:** Global rate limit only
**Recommended:** Add per-user rate limiting

```javascript
// npm install redis express-rate-limit redis3
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

const redisClient = redis.createClient({ host: 'localhost', port: 6379 });

const loginLimiter = rateLimit({
    store: new RedisStore({
        client: redisClient,
        prefix: 'rate-limit:login:'
    }),
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,  // 5 attempts per IP
    keyGenerator: (req) => req.body.email  // Rate limit by email
});

router.post('/login', loginLimiter, validateLogin, async (req, res) => {
    // Login logic
});
```

---

### 2. Add Request Logging & Auditing

**Current:** Logs are written but not structured for security audit

**Recommended Improvement:**
```javascript
// Add to every API route
const auditLog = async (userId, action, resource, details, ipAddress) => {
    try {
        await db.query(
            `INSERT INTO audit_logs (user_id, action, resource, details, ip_address) 
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, action, resource, JSON.stringify(details), ipAddress]
        );
    } catch (error) {
        logger.error('Audit log failed:', error);
    }
};

// Use consistently across routes
await auditLog(req.user.id, 'login', 'auth', { email }, req.ip);
await auditLog(req.user.id, 'add_wallet', 'crypto', { address }, req.ip);
await auditLog(req.user.id, 'modify_gateway', 'gateway', { gatewayId }, req.ip);
```

---

### 3. Add Content Security Policy (CSP) Headers

**Current:** Basic CSP, but can be stricter

**Recommendation:**
```javascript
// In security.js middleware
app.use(helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "cdn.jsdelivr.net"],  // Remove 'unsafe-inline'
        styleSrc: ["'self'", "fonts.googleapis.com"],  // Remove 'unsafe-inline'
        fontSrc: ["'self'", "fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", process.env.FRONTEND_URL],
        frameSrc: ["'none'"],  // Prevent clickjacking
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
    }
}));
```

---

### 4. Add API Key Authentication (for integrations)

**Current:** Only JWT token auth

**Recommendation for service-to-service communication:**
```javascript
// Generate API keys for webhooks, integrations
// In middleware:
function validateApiKey(req, res, next) {
    const apiKey = req.header('X-API-Key');
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }
    
    // Validate against database (hashed)
    const apiKeyRecord = await db.query(
        'SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = true',
        [hashApiKey(apiKey)]
    );
    
    if (!apiKeyRecord) {
        return res.status(401).json({ error: 'Invalid API key' });
    }
    
    req.apiKeyUser = apiKeyRecord;
    next();
}

// Use on specific routes
router.post('/webhooks/stripe', validateApiKey, stripeWebhookHandler);
```

---

### 5. Database Connection Pool Configuration

**Current:** Basic pool (20 connections)

**Recommendation for production:**
```javascript
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
    max: 30,  // Increase for high traffic
    min: 5,   // Keep minimum connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    statement_timeout: 5000,  // Query timeout
    query_timeout: 5000
});

// Connection error handling
pool.on('error', (err) => {
    logger.error('Unexpected error on idle client:', err);
    // Alert ops team
});

pool.on('connect', (client) => {
    // Set session parameters
    client.query('SET SESSION timezone = "UTC"');
});
```

---

### 6. Add API Versioning

**Current:** Routes use `/api/auth`, `/api/crypto` but no version

**Recommendation:**
```javascript
// Use semantic versioning for APIs
app.use('/api/v1/auth', authRoutesV1);
app.use('/api/v1/crypto', cryptoRoutesV1);

// Can support multiple versions simultaneously
app.use('/api/v2/auth', authRoutesV2);  // New version with breaking changes
```

---

## 🟢 NICE-TO-HAVE SECURITY ENHANCEMENTS

### 1. Two-Factor Authentication (2FA)

```bash
npm install speakeasy qrcode
```

Implement TOTP or SMS-based 2FA for admin accounts and sensitive operations

### 2. Incident Response Plan

- Document security incident procedures
- Set up alerts for suspicious activity
- Create rollback procedures
- Define communication plan

### 3. Regular Security Audits

- Run `npm audit` regularly
- Conduct code reviews with security focus
- Use tools like:
  - `npm audit` (check dependencies)
  - `snyk` (vulnerability scanning)
  - `sonarqube` (static analysis)

### 4. Secrets Management

- Use AWS Secrets Manager or HashiCorp Vault for production
- Rotate secrets regularly (monthly for API keys, weekly for certificates)
- Never store secrets in code or config files

### 5. Monitoring & Alerting

Set up monitoring for:
- Failed login attempts
- Rate limit triggers
- Database connection errors
- API endpoint latency
- Disk space and memory usage
- SSL certificate expiration

Tools: Datadog, New Relic, Sentry, Grafana + Prometheus

---

## ✅ SECURITY CHECKLIST

- [ ] All API keys rotated (see critical issues)
- [ ] `.env` file NOT in git (verify `.gitignore`)
- [ ] Token storage changed to httpOnly cookies
- [ ] Environment variable validation added
- [ ] HTTPS enforcement implemented
- [ ] SQL injection risks fixed
- [ ] CSRF protection added
- [ ] Rate limiting per-user implemented
- [ ] Audit logging standardized
- [ ] CSP headers strengthened
- [ ] Database connection pool optimized
- [ ] API versioning implemented
- [ ] Security headers verified (X-Content-Type-Options, etc.)
- [ ] Dependencies audited (`npm audit`)
- [ ] Secrets rotation procedure created
- [ ] Incident response plan documented
- [ ] Monitoring and alerting configured

---

## 📚 USEFUL SECURITY RESOURCES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-syntax.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Last Updated:** 2026-01-15  
**Status:** Review findings from main project audit
