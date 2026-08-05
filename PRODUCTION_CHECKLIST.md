# PayControl Production Deployment Checklist

## Pre-Deployment (1-2 weeks before)

### Infrastructure Setup
- [ ] Cloud provider account set up (AWS, DigitalOcean, Render, Heroku, etc.)
- [ ] Domain registered and DNS configured
- [ ] SSL certificate planned (Let's Encrypt recommended)
- [ ] Database hosting selected (PostgreSQL: Neon, AWS RDS, DigitalOcean)
- [ ] Backup strategy designed and documented
- [ ] Monitoring service selected (Datadog, New Relic, Grafana)
- [ ] Error tracking set up (Sentry)
- [ ] Log aggregation service configured (LogRocket, Loggly, DataDog)

### Security Preparation
- [ ] Security audit completed (see SECURITY.md)
- [ ] All API keys generated fresh (not reused from .env.example)
- [ ] Secrets manager selected (AWS Secrets Manager, Vault)
- [ ] SSL certificates ready
- [ ] Security headers documented
- [ ] CORS origins finalized
- [ ] Rate limiting thresholds determined
- [ ] Authentication flow tested

### Code Preparation
- [ ] All critical errors fixed (see review output)
- [ ] Dependencies updated (`npm update`)
- [ ] Security audit passed (`npm audit`)
- [ ] Code reviewed and tested locally
- [ ] Linting passed (`npm run lint` if configured)
- [ ] Environment variable validation added
- [ ] Graceful shutdown handler added to server.js
- [ ] Health check endpoint working
- [ ] All routes tested
- [ ] Error handling complete on all endpoints

### Testing
- [ ] Unit tests passing (if available)
- [ ] Integration tests passing
- [ ] Load testing completed (simulate production traffic)
- [ ] Database migration tested on staging
- [ ] Rollback procedure tested
- [ ] API endpoints tested on staging
- [ ] Frontend and backend communication verified
- [ ] Third-party integrations tested (Stripe, Plaid, Alchemy)

---

## 48 Hours Before Deployment

### Database Preparation
- [ ] Database created with production name
- [ ] PostgreSQL version verified (12+)
- [ ] Connection pooling configured
- [ ] Backup script created and tested
- [ ] Regular backup schedule configured (daily recommended)
- [ ] Database encryption enabled (if cloud provider supports)
- [ ] Restricted access (firewall rules, network policies)

### Server Preparation
- [ ] Server provisioned and security hardened
- [ ] Node.js v18+ installed and verified
- [ ] PM2 or systemd installed and configured
- [ ] Nginx installed and configuration ready
- [ ] Firewall rules configured (allow 80, 443; restrict other ports)
- [ ] Logs directory created with proper permissions
- [ ] Process monitoring tool installed (PM2 or equivalent)

### Secrets Management
- [ ] All secrets generated (JWT, API keys, etc.)
- [ ] Secrets stored in environment variable manager
- [ ] `.env` file created locally (NOT in git)
- [ ] Secrets rotated (not using development keys)
- [ ] Backup of secrets stored securely
- [ ] Access control for secrets configured

### Monitoring & Alerts
- [ ] Error tracking (Sentry) configured
- [ ] Uptime monitoring configured
- [ ] CPU/Memory/Disk alerts set
- [ ] Database connection alerts set
- [ ] API error rate alerts configured
- [ ] Slack/PagerDuty integration ready
- [ ] On-call schedule established

---

## Day of Deployment

### Pre-Flight Checks (4 hours before)
- [ ] Final security audit run (`npm audit`)
- [ ] All team members notified
- [ ] Rollback plan reviewed and documented
- [ ] Maintenance window scheduled (if needed)
- [ ] Backups verified
- [ ] Monitoring dashboards opened

### Database Migration
- [ ] Database backed up before schema changes
- [ ] Schema migration script reviewed
- [ ] Migration tested on staging
- [ ] Migration executed: `bash scripts/setup-database.sh`
- [ ] Schema verification: Query all tables exist
- [ ] Sample data seeded (if needed)

### Application Deployment
- [ ] Pull latest code from git
- [ ] Install dependencies: `cd backend && npm ci` (not npm install)
- [ ] Environment variables verified
- [ ] Build artifacts generated (if applicable)
- [ ] Application started via PM2: `pm2 start ecosystem.config.js`
- [ ] Health check passes: `curl http://localhost:3000/api/health`
- [ ] Application logs monitored for errors

### Nginx Configuration
- [ ] Nginx config tested: `sudo nginx -t`
- [ ] Configuration deployed
- [ ] Nginx restarted: `sudo systemctl restart nginx`
- [ ] HTTPS certificate verified
- [ ] Redirect from HTTP to HTTPS tested

### Frontend Deployment
- [ ] Frontend assets deployed to `frontend/` directory
- [ ] Static assets verify (JS, CSS, images load)
- [ ] Cache headers configured correctly
- [ ] Service worker updated (if applicable)

### Integration Testing
- [ ] Health check endpoint responds: `/api/health`
- [ ] Login works with test account
- [ ] JWT token generation working
- [ ] API endpoints responding correctly
- [ ] Database queries working
- [ ] Third-party API integrations functioning
- [ ] Error handling produces proper responses
- [ ] CORS allows frontend domain
- [ ] SSL certificate valid and not expired

### Smoke Tests (Run from production URL)
```bash
# Test health check
curl -k https://paycontrol.swiftwaveholding.com/api/health

# Test login
curl -X POST https://paycontrol.swiftwaveholding.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"testpass"}'

# Test authenticated endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://paycontrol.swiftwaveholding.com/api/crypto/prices
```

### Performance Baseline
- [ ] Response time < 200ms for API endpoints
- [ ] Page load time < 3s for frontend
- [ ] Database query performance acceptable
- [ ] Rate limiting not triggered by normal usage

### Monitoring Verification
- [ ] Logs appearing in log aggregation service
- [ ] Errors appearing in error tracking (Sentry)
- [ ] Metrics visible in monitoring dashboard
- [ ] Alerts configured and working

---

## Post-Deployment (Day 1)

### Immediate Verification (First Hour)
- [ ] Monitor error rates (should be near zero)
- [ ] Check database performance
- [ ] Verify no spike in server load
- [ ] Review application logs for warnings
- [ ] Confirm all endpoints accessible
- [ ] Verify HTTPS working and certificate valid
- [ ] Spot check user registration and login flows
- [ ] Check mobile responsiveness

### Extended Monitoring (First 24 Hours)
- [ ] Monitor uptime and latency
- [ ] Track error rates and types
- [ ] Verify backup jobs execute
- [ ] Check database connection health
- [ ] Monitor server resource usage
- [ ] Review user feedback/bug reports

### Documentation Updates
- [ ] Deployment date recorded
- [ ] Version numbers documented
- [ ] Any manual steps documented
- [ ] Issues encountered documented
- [ ] Lessons learned recorded

---

## First Week Post-Deployment

- [ ] Performance metrics analyzed
- [ ] Security logs reviewed
- [ ] Database size monitored
- [ ] User feedback incorporated
- [ ] Any critical issues patched
- [ ] Backup restoration tested (verify recovery works)
- [ ] SSL certificate auto-renewal verified
- [ ] Monitoring and alerting functioning correctly

---

## Ongoing Maintenance (Monthly)

- [ ] Dependencies updated (`npm update`)
- [ ] Security audit run (`npm audit`)
- [ ] Database maintenance (VACUUM, ANALYZE)
- [ ] Backup restoration test performed
- [ ] SSL certificates verified (30 days before expiry)
- [ ] Performance review (metrics, queries, load)
- [ ] Security review (logs, access patterns)
- [ ] Documentation updated as needed

---

## Rollback Procedure (If Needed)

### Immediate Rollback (First Few Hours)
1. [ ] Revert to previous application version
2. [ ] Revert database schema (if changed)
3. [ ] Restart application
4. [ ] Verify health check
5. [ ] Monitor for errors
6. [ ] Notify team and stakeholders

### Database Rollback
```bash
# If database schema changed, restore from backup
psql $DATABASE_URL < backup_$(date -d yesterday +%Y%m%d).sql

# Verify data integrity
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM transactions;
```

### Notify Stakeholders
- [ ] Notify users of rollback
- [ ] Post status update
- [ ] Estimated time to resolve communicated
- [ ] Root cause analysis initiated

---

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Deployment Lead | | | |
| Database Admin | | | |
| Incident Commander | | | |
| Stakeholder Notification | | | |

---

## Deployment Timeline Template

```
T-48h: Infrastructure check
T-24h: Final testing
T-4h: Pre-flight checks
T-0h: Database migration begins
T+0h: Application deployment
T+30m: Health check & smoke tests
T+1h: Extended monitoring begins
T+24h: First review
T+7d: Week 1 retrospective
```

---

## Quick Reference: Essential Commands

```bash
# SSH into server
ssh user@paycontrol.swiftwaveholding.com

# Check application status
pm2 status
pm2 logs paycontrol-backend

# Restart application
pm2 restart paycontrol-backend

# Check database connection
psql $DATABASE_URL -c "SELECT NOW();"

# View nginx logs
tail -f /var/log/nginx/paycontrol_error.log

# Test health endpoint
curl https://paycontrol.swiftwaveholding.com/api/health

# View SSL certificate
openssl s_client -connect paycontrol.swiftwaveholding.com:443

# Database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Database restore
psql $DATABASE_URL < backup_20260101_120000.sql
```

---

## Sign-Off

- [ ] Deployment Lead: __________________ Date: __________
- [ ] DevOps Lead: __________________ Date: __________
- [ ] Project Manager: __________________ Date: __________
- [ ] Security Lead: __________________ Date: __________

---

**Last Updated:** 2026-01-15  
**Next Review:** 2026-02-15
