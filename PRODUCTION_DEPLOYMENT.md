# Production Deployment Checklist

This checklist outlines the steps and verification points to move the Fleet Management System to production.

## Pre-Deployment Verification

### Backend Hardening
- [x] FastAPI auth enforcement wired in (ENFORCE_AUTH toggle)
- [x] Route-level RBAC applied to all endpoints
- [x] Rate limiting middleware integrated (memory and Redis backends)
- [x] Startup schema migrations gated (AUTO_RUN_SCHEMA_MIGRATIONS flag)
- [x] Loan list endpoint paginated with lightweight serializer
- [x] Gunicorn worker/concurrency settings configured in render.yaml
- [x] FastAPI auth smoke tests added
- [x] CI pipeline for backend tests and syntax validation

### Frontend Hardening
- [x] Route-level code splitting with React.lazy()
- [x] API logging disabled in production builds
- [x] Production build pipeline validated and optimized

### Database
- [x] Connection pooling configured with sensible defaults
- [x] SSL mode enforced for remote connections
- [x] Schema migration scripts tested and ready

## Pre-Production Environment Setup

### Secrets & Credentials
1. Generate strong SECRET_KEY (32+ chars) for JWT signing
2. Obtain or provision PostgreSQL database URL with credentials
3. Generate strong API keys for external services (OpenAI, email, etc.)
4. Store all secrets in secure vault (do not commit to code)

### Environment Configuration

#### Backend (set before startup)
```bash
# Authentication & Security
export ENFORCE_AUTH="true"
export SECRET_KEY="<your-strong-32-char-key>"
export JWT_TOKEN_EXPIRY_HOURS="24"

# Database
export DATABASE_URL="postgresql://user:password@host:5432/database"
export AUTO_RUN_SCHEMA_MIGRATIONS="false"

# Rate Limiting
export ENABLE_RATE_LIMIT="true"
export RATE_LIMIT_BACKEND="redis"      # or "memory" for single-instance
export REDIS_URL="redis://host:6379"   # if using Redis backend
export RATE_LIMIT_REQUESTS="100"
export RATE_LIMIT_WINDOW="60"

# CORS & Origins
export FRONTEND_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"

# AI Services (if enabled)
export OPENAI_API_KEY="<your-openai-api-key>"

# Email Services (if enabled)
export SMTP_SERVER="smtp.provider.com"
export SMTP_PORT="587"
export SMTP_USERNAME="your-email@domain.com"
export SMTP_PASSWORD="<your-app-password>"
```

#### Frontend (.env.production)
```
VITE_API_URL=https://api.yourdomain.com
```

### Infrastructure

1. **Database**: PostgreSQL 13+ with connection pooling
2. **Redis** (optional): For distributed rate limiting across instances
3. **Load Balancer**: If running multiple backend instances
4. **CDN**: For serving frontend static assets
5. **Monitoring**: Sentry + Prometheus + Grafana

## Deployment Steps

### 1. Database Preparation
```bash
# Run as privileged user, once only
python backend/setup_db.py

# Verify tables created
psql $DATABASE_URL -c "\dt"
```

### 2. Backend Deployment
```bash
# Install in production venv
cd backend
python3.11 -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt

# Start with gunicorn (use systemd/supervisord/container orchestration in production)
gunicorn main:app \
  -k uvicorn.workers.UvicornWorker \
  --workers 3 \
  --threads 2 \
  --timeout 120 \
  --graceful-timeout 30 \
  --keep-alive 5 \
  --max-requests 1000 \
  --max-requests-jitter 100 \
  --bind 0.0.0.0:5000
```

### 3. Frontend Deployment
```bash
# Build production bundle
cd frontend
npm ci
npm run build

# Serve via CDN or static host (e.g., AWS S3 + CloudFront, Vercel, Netlify)
# Output is in dist/
```

## Post-Deployment Verification

### Health Checks
1. Backend `/health` endpoint responds with 200
2. Prometheus `/metrics` endpoint responds with 200
2. Frontend loads and renders without console errors
3. API auth enforcement is active: unauthenticated requests return 401
4. Rate limiting is blocking excessive requests and returning 429

### Functional Testing
1. Login flow completes and returns valid JWT token
2. Token-bearing requests to protected endpoints succeed
3. Role-based access control blocks unauthorized operations:
   - Viewer cannot create records
   - Manager cannot perform admin operations
4. Loan repository list pagination works with `limit` and `offset` parameters
5. All critical workflows execute without errors

### Performance Baseline
- Record p50, p95, p99 latencies for key endpoints
- Monitor error rates and worker utilization
- Verify rate limit headers are present on responses

## Monitoring & Alerting

### Key Metrics to Track
1. **Request latency**: p50 < 100ms, p95 < 300ms, p99 < 1s
2. **Error rate**: < 1% for 5xx errors
3. **Rate limit hits**: Should be minimal unless under attack
4. **Database connection pool**: Monitor for exhaustion
5. **Worker memory**: Monitor for leaks, rotate at max-requests threshold

### Observability Stack Endpoints
1. **Prometheus**: `http://localhost:9090`
2. **Grafana**: `http://localhost:3001`
3. **Sentry**: configured via `SENTRY_DSN`

### Alerts to Set Up
- 5xx error rate > 5% (15 min window)
- p95 latency > 500ms (5 min window)
- Database connection pool > 80% utilization
- Redis connection failures (if using distributed rate limit)

## Rollback Plan

If critical issues occur in production:

1. Revert frontend CDN/static to previous known-good version
2. Scale backend to previous working version
3. Reset rate limit counters if middleware misconfigured (flush Redis cache)
4. Restore database from automated backups if data corruption occurs

## Security Checklist

- [ ] ENFORCE_AUTH=true confirmed in production
- [ ] SECRET_KEY is 32+ random characters and not committed to code
- [ ] CORS origins restricted to your frontend domain(s)
- [ ] Database password is strong and not in logs
- [ ] API keys (OpenAI, SMTP) are not exposed in error messages
- [ ] HTTPS enforced on all endpoints
- [ ] Security headers set (HSTS, CSP, X-Frame-Options)
- [ ] Sensitive logs redacted (no token or password content)

## Post-Go-Live

1. Monitor error rates, latency, and resource utilization for first 24 hours
2. Review audit logs for any unexpected access patterns
3. Confirm automated backups are running successfully
4. Schedule regular security updates and dependency patches
5. Document any production-specific configurations for runbook

## Support & Troubleshooting

### Backend Issues
- Check logs for startup errors: `ENFORCE_AUTH`, `SECRET_KEY`, `DATABASE_URL` must be set
- Verify database connection: `psql $DATABASE_URL -c "SELECT 1"`
- Test auth: `curl -H "Authorization: Bearer invalid" http://localhost:5000/database/status` should return 401

### Frontend Issues
- Check browser console for API connectivity errors
- Verify VITE_API_URL matches backend endpoint
- Clear browser cache and local storage if state seems stale

### Rate Limiting Issues
- If using Redis backend, verify Redis is reachable: `redis-cli -u $REDIS_URL ping`
- If using memory backend, rate limits are per-process (use Redis for multi-instance setups)

---

**Last Updated**: 2026-06-22
