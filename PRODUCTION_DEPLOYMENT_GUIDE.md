# Production Deployment Guide - Verified Vibe Refactor

## Overview

This guide provides step-by-step instructions for deploying the Verified Vibe Refactor application to production.

**Status**: Ready for Production ✅
**Last Updated**: 2026-05-17

## Pre-Deployment Checklist

Before deploying to production, ensure all items are completed:

- [ ] All tests passing: `npm test`
- [ ] Build successful: `npm run build`
- [ ] No security vulnerabilities: `npm audit`
- [ ] Environment variables configured
- [ ] Database migrations completed
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Team notified

## Environment Setup

### 1. Vercel Configuration

#### Create Vercel Project
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link project
vercel link
```

#### Environment Variables
Set these in Vercel project settings:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=your-api-key
VITE_SENTRY_DSN=your-sentry-dsn (optional)
```

### 2. Supabase Configuration

#### Database Setup
```sql
-- Run migrations
psql -h db.supabase.co -U postgres -d postgres -f supabase-schema.sql
```

#### Row-Level Security (RLS)
Enable RLS on all tables:
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_scores ENABLE ROW LEVEL SECURITY;
```

#### Create Policies
```sql
-- Users can only see their own data
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can only update their own data
CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);
```

### 3. Storage Configuration

#### Create Storage Buckets
```bash
# Create buckets in Supabase Storage
- verified-vibe-photos (public)
- verified-vibe-id-photos (private)
- verified-vibe-chat-media (private)
```

#### Set CORS Policy
```json
{
  "allowedOrigins": ["https://verified-vibe.vercel.app"],
  "allowedMethods": ["GET", "POST", "PUT", "DELETE"],
  "allowedHeaders": ["*"],
  "maxAgeSeconds": 3600
}
```

## Deployment Process

### Step 1: Pre-Deployment Testing

```bash
# Run full test suite
npm test

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

### Step 2: Create Staging Deployment

```bash
# Create staging branch
git checkout -b staging

# Push to staging
git push origin staging

# Vercel automatically deploys to staging URL
# Check GitHub Actions for deployment status
```

### Step 3: Staging Validation

1. **Smoke Tests**
   - Visit staging URL
   - Test gate screen
   - Complete onboarding flow
   - Verify verification steps
   - Test discovery feed
   - Test chat functionality

2. **Performance Check**
   - Run Lighthouse audit
   - Check Core Web Vitals
   - Verify image optimization

3. **Security Check**
   - Verify HTTPS
   - Check API security headers
   - Test authentication flow

### Step 4: Production Deployment

```bash
# Create pull request to main
git checkout main
git pull origin main
git merge staging

# Push to main
git push origin main

# Vercel automatically deploys to production
# Monitor deployment in GitHub Actions
```

### Step 5: Post-Deployment Verification

1. **Health Checks**
   ```bash
   # Check application health
   curl https://verified-vibe.vercel.app/health
   
   # Check API endpoints
   curl https://verified-vibe.vercel.app/api/verified-vibe/health
   ```

2. **Monitor Errors**
   - Check Sentry dashboard
   - Review error logs
   - Monitor error rate

3. **Performance Monitoring**
   - Check Vercel Analytics
   - Monitor Core Web Vitals
   - Check database performance

4. **User Testing**
   - Test critical flows
   - Verify all features work
   - Check mobile responsiveness

## Rollback Procedure

If issues occur after deployment:

### Immediate Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Vercel automatically deploys previous version
```

### Manual Rollback

1. Go to Vercel Dashboard
2. Select project
3. Go to Deployments
4. Find previous successful deployment
5. Click "Promote to Production"

### Database Rollback

If database changes caused issues:

```bash
# Restore from backup
psql -h db.supabase.co -U postgres -d postgres < backup.sql
```

## Monitoring & Maintenance

### Daily Monitoring

- [ ] Check error rate (target: <0.1%)
- [ ] Monitor API response times (target: <200ms)
- [ ] Check database performance
- [ ] Review user feedback

### Weekly Maintenance

- [ ] Review error logs
- [ ] Check performance metrics
- [ ] Update dependencies
- [ ] Run security audit

### Monthly Tasks

- [ ] Full accessibility audit
- [ ] Performance optimization review
- [ ] Security audit
- [ ] Backup verification

## Scaling Considerations

### Database Scaling

As user base grows:

1. **Connection Pooling**
   - Use PgBouncer for connection pooling
   - Configure in Supabase settings

2. **Query Optimization**
   - Add database indexes
   - Optimize slow queries
   - Use materialized views

3. **Replication**
   - Set up read replicas
   - Distribute read traffic

### Application Scaling

1. **Edge Functions**
   - Move API logic to edge functions
   - Reduce latency for global users

2. **Caching**
   - Implement Redis caching
   - Cache frequently accessed data

3. **CDN**
   - Use Vercel's CDN
   - Cache static assets

## Disaster Recovery

### Backup Strategy

**Daily Backups**
- Automated Supabase backups
- Stored in multiple regions
- 30-day retention

**Weekly Full Backups**
- Export database
- Export storage files
- Store in S3

### Recovery Procedures

1. **Database Recovery**
   ```bash
   # Restore from backup
   psql -h db.supabase.co -U postgres -d postgres < backup.sql
   ```

2. **Storage Recovery**
   ```bash
   # Restore from S3
   aws s3 sync s3://backup-bucket/storage ./storage
   ```

3. **Application Recovery**
   ```bash
   # Redeploy from Git
   git push origin main
   ```

## Performance Optimization

### Image Optimization

- Use WebP format
- Implement lazy loading
- Compress images
- Use responsive images

### Code Optimization

- Enable code splitting
- Minify CSS/JS
- Remove unused dependencies
- Optimize bundle size

### Database Optimization

- Add indexes on frequently queried columns
- Optimize queries
- Use connection pooling
- Archive old data

## Security Hardening

### API Security

- [ ] Enable rate limiting
- [ ] Implement CORS properly
- [ ] Validate all inputs
- [ ] Use HTTPS only
- [ ] Implement CSRF protection

### Data Security

- [ ] Enable encryption at rest
- [ ] Enable encryption in transit
- [ ] Implement RLS policies
- [ ] Regular security audits
- [ ] Penetration testing

### Access Control

- [ ] Implement 2FA
- [ ] Use strong passwords
- [ ] Rotate API keys regularly
- [ ] Audit access logs
- [ ] Implement least privilege

## Troubleshooting

### Common Issues

#### Deployment Fails
1. Check GitHub Actions logs
2. Verify environment variables
3. Check build output
4. Review error messages

#### Application Crashes
1. Check error logs in Sentry
2. Review recent changes
3. Check database connectivity
4. Verify API keys

#### Performance Issues
1. Check database performance
2. Review slow queries
3. Check API response times
4. Monitor memory usage

#### Authentication Issues
1. Verify Supabase configuration
2. Check JWT tokens
3. Review RLS policies
4. Check CORS settings

## Support & Escalation

### Support Channels
- GitHub Issues: Bug reports
- Email: support@example.com
- Slack: #verified-vibe-support

### Escalation Path
1. Level 1: Support team
2. Level 2: Engineering team
3. Level 3: DevOps team
4. Level 4: CTO

## Documentation

- [Architecture Overview](./VERIFIED_VIBE_IMPLEMENTATION_GUIDE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Component Documentation](./COMPONENT_DOCUMENTATION.md)
- [Testing Guide](./TESTING_GUIDE.md)

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Build successful
- [ ] No security vulnerabilities
- [ ] Environment variables set
- [ ] Database ready
- [ ] Monitoring configured
- [ ] Team notified

### During Deployment
- [ ] Monitor deployment progress
- [ ] Check error logs
- [ ] Verify health checks
- [ ] Monitor performance

### Post-Deployment
- [ ] Verify all features work
- [ ] Check error rate
- [ ] Monitor performance
- [ ] Gather user feedback
- [ ] Document any issues

## Success Criteria

✅ Application deployed successfully
✅ All critical flows working
✅ Error rate < 0.1%
✅ Response time < 200ms
✅ No security vulnerabilities
✅ Accessibility compliance maintained
✅ Performance metrics met

---

**Deployment Date**: Ready for immediate deployment
**Last Updated**: 2026-05-17
**Status**: READY FOR PRODUCTION ✅
