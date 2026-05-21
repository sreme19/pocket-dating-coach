# Production Deployment Guide

This guide covers setting up environment variables and deploying the Pocket Dating Coach application to production.

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Local Development Setup](#local-development-setup)
3. [Production Setup](#production-setup)
4. [Verification](#verification)
5. [Deployment](#deployment)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)

---

## Environment Variables

### Required Variables

The application requires the following environment variables to function:

#### 1. **ANTHROPIC_API_KEY** (Required)
- **Description**: API key for Claude AI integration
- **Get from**: https://console.anthropic.com/account/keys
- **Used for**: AI Bestie and AI Wingman response generation
- **Format**: `sk-ant-api03-...`
- **Scope**: Both development and production

#### 2. **SUPABASE_URL** (Required)
- **Description**: Server-side Supabase project URL
- **Get from**: https://app.supabase.com/project/[project-id]/settings/api
- **Used for**: Backend database operations
- **Format**: `https://your-project.supabase.co`
- **Scope**: Server-side only (backend)

#### 3. **SUPABASE_SERVICE_KEY** (Required)
- **Description**: Service role key for server-side Supabase operations
- **Get from**: https://app.supabase.com/project/[project-id]/settings/api
- **Used for**: AI assistant conversations, profile management, RLS-protected operations
- **Format**: JWT token starting with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Scope**: Server-side only (backend) - **KEEP SECRET**
- **Security**: Never expose in client-side code or version control

#### 4. **PUBLIC_SUPABASE_URL** (Required)
- **Description**: Public Supabase project URL for client-side initialization
- **Get from**: https://app.supabase.com/project/[project-id]/settings/api
- **Used for**: Client-side Supabase operations
- **Format**: `https://your-project.supabase.co`
- **Scope**: Client-side (can be public)

#### 5. **PUBLIC_SUPABASE_ANON_KEY** (Required)
- **Description**: Public anonymous key for client-side Supabase operations
- **Get from**: https://app.supabase.com/project/[project-id]/settings/api
- **Used for**: Client-side authentication and data access
- **Format**: JWT token
- **Scope**: Client-side (can be public)

### Optional Variables

#### 6. **VOYAGE_API_KEY** (Optional)
- **Description**: API key for Voyage AI embeddings
- **Get from**: https://dash.voyageai.com/api-keys
- **Used for**: Semantic search and embeddings for match context
- **Format**: `pa-...`
- **Scope**: Both development and production
- **Note**: Recommended for better search functionality

---

## Local Development Setup

### Step 1: Create `.env.local`

```bash
cp .env.example .env.local
```

### Step 2: Fill in Development Values

Edit `.env.local` and add your development credentials:

```dotenv
# Development Supabase Project
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_SERVICE_KEY=your-dev-service-key
PUBLIC_SUPABASE_URL=https://dev-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key

# Development Claude API Key
ANTHROPIC_API_KEY=sk-ant-api03-your-dev-key

# Optional: Development Voyage API Key
VOYAGE_API_KEY=pa-your-dev-key
```

### Step 3: Verify Local Setup

```bash
npm run verify:local-env
```

This will:
- ✅ Check all required variables are set
- ✅ Verify Supabase connectivity
- ✅ Verify Claude API connectivity
- ✅ Check database tables exist
- ✅ Generate a verification report

### Step 4: Start Development Server

```bash
npm run dev
```

---

## Production Setup

### Step 1: Create Production Credentials

Before deploying, ensure you have production credentials for:

1. **Supabase Production Project**
   - Create a new Supabase project for production
   - Get the project URL and service key from settings
   - Create a new anonymous key for client-side access

2. **Claude API Key**
   - Use a dedicated API key for production
   - Monitor usage at https://console.anthropic.com/account/usage

3. **Voyage API Key** (optional)
   - Create a production API key if using embeddings

### Step 2: Create `.env.production`

```bash
cp .env.example .env.production
```

### Step 3: Fill in Production Values

Edit `.env.production` with your production credentials:

```dotenv
# Production Supabase Project
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_SERVICE_KEY=your-prod-service-key
PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key

# Production Claude API Key
ANTHROPIC_API_KEY=sk-ant-api03-your-prod-key

# Optional: Production Voyage API Key
VOYAGE_API_KEY=pa-your-prod-key
```

### Step 4: Set Up Vercel Secrets (for Vercel Deployment)

If deploying to Vercel:

1. Go to: https://vercel.com/dashboard/[project]/settings/environment-variables
2. Add each variable as a new environment variable:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `ANTHROPIC_API_KEY`
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `VOYAGE_API_KEY` (optional)

3. Set scope to **"Production"** for each variable
4. Click "Save"

### Step 5: Verify Production Setup

```bash
npm run verify:prod-env
```

This will:
- ✅ Check all required variables are set
- ✅ Verify Supabase production connectivity
- ✅ Verify Claude API connectivity
- ✅ Check production database tables exist
- ✅ Generate a verification report

---

## Verification

### Automated Verification

Run the verification script to check all environment variables and connectivity:

```bash
# Verify production environment
npm run verify:prod-env

# Verify local environment
npm run verify:local-env
```

### Manual Verification

#### 1. Check Environment Variables

```bash
# List all set environment variables (masked for security)
env | grep -E "SUPABASE|ANTHROPIC|VOYAGE"
```

#### 2. Test Supabase Connectivity

```bash
# Test Supabase connection
curl -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  https://your-project.supabase.co/rest/v1/auth.users
```

#### 3. Test Claude API Connectivity

```bash
# Test Claude API
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Say hello"}]
  }'
```

### Verification Report

After running verification, check the generated report:

```bash
cat production-env-verification-report.json
```

The report includes:
- Timestamp of verification
- Summary of checks (passed, warnings, failed)
- Detailed results for each check
- Error messages if any checks failed

---

## Deployment

### Prerequisites

- ✅ All environment variables verified
- ✅ Database migrations applied
- ✅ All tests passing
- ✅ Code reviewed and merged to main branch

### Deployment Steps

#### 1. Run Tests

```bash
npm test
```

#### 2. Build Project

```bash
npm run build
```

#### 3. Deploy to Vercel

```bash
# Automatic deployment on push to main
git push origin main

# Or manual deployment
vercel --prod
```

#### 4. Verify Deployment

```bash
# Check deployment status
vercel status

# Run smoke tests
npm test -- --grep "smoke"
```

### Rollback

If deployment fails:

```bash
# Rollback to previous deployment
vercel rollback

# Or redeploy previous version
vercel --prod --target production
```

---

## Monitoring

### API Usage Monitoring

#### Claude API Usage
- Monitor at: https://console.anthropic.com/account/usage
- Set up alerts for high usage
- Track costs and optimize prompts

#### Supabase Usage
- Monitor at: https://app.supabase.com/project/[project-id]/usage
- Check database connections
- Monitor storage usage
- Track API requests

### Error Monitoring

#### Application Logs
- Vercel: https://vercel.com/dashboard/[project]/deployments
- Check deployment logs for errors
- Monitor real-time logs

#### Database Logs
- Supabase: https://app.supabase.com/project/[project-id]/logs
- Check for connection errors
- Monitor query performance

### Performance Monitoring

#### Response Times
- Monitor API response times
- Track database query performance
- Optimize slow queries

#### Error Rates
- Monitor error rates
- Set up alerts for high error rates
- Track error types and patterns

---

## Troubleshooting

### Common Issues

#### 1. "Missing Environment Variable" Error

**Problem**: Application fails with "Missing environment variable: SUPABASE_URL"

**Solution**:
1. Verify variable is set: `echo $SUPABASE_URL`
2. Check `.env.production` file exists
3. Verify variable name is correct (case-sensitive)
4. For Vercel: Redeploy after adding variable

#### 2. "Supabase Connection Failed" Error

**Problem**: Cannot connect to Supabase database

**Solution**:
1. Verify `SUPABASE_URL` is correct
2. Verify `SUPABASE_SERVICE_KEY` is valid
3. Check Supabase project is running
4. Check network connectivity
5. Verify RLS policies are configured

#### 3. "Claude API Error" Error

**Problem**: Claude API calls fail

**Solution**:
1. Verify `ANTHROPIC_API_KEY` is correct
2. Check API key has not expired
3. Verify API key has sufficient quota
4. Check rate limiting
5. Monitor API usage at https://console.anthropic.com/account/usage

#### 4. "Database Table Not Found" Error

**Problem**: Application fails because required tables don't exist

**Solution**:
1. Run database migrations:
   ```bash
   tsx --env-file=.env.production scripts/create-ai-assistant-schema.sql
   ```
2. Verify tables were created:
   ```bash
   npm run verify:prod-env
   ```
3. Check Supabase database for tables

#### 5. "RLS Policy Error" Error

**Problem**: Cannot access database due to RLS policy restrictions

**Solution**:
1. Verify RLS policies are configured:
   ```bash
   npm run apply:rls
   ```
2. Check user authentication
3. Verify user has correct role
4. Check RLS policy rules

### Debug Mode

Enable debug logging:

```bash
# Set debug environment variable
export DEBUG=pocket-dating-coach:*

# Run application
npm run dev
```

### Getting Help

If you encounter issues:

1. Check the verification report: `cat production-env-verification-report.json`
2. Check application logs: Vercel dashboard or local console
3. Check database logs: Supabase dashboard
4. Check API usage: Anthropic console
5. Review error messages carefully
6. Check this guide for similar issues

---

## Security Best Practices

### Environment Variables

- ✅ Never commit `.env.local` or `.env.production` to git
- ✅ Use `.gitignore` to exclude environment files
- ✅ Rotate API keys regularly
- ✅ Use different keys for development and production
- ✅ Store secrets in secure vaults (Vercel Secrets, GitHub Secrets)
- ✅ Audit access to secrets regularly

### API Keys

- ✅ Use service role key only on server-side
- ✅ Use anonymous key for client-side operations
- ✅ Rotate keys if compromised
- ✅ Monitor API usage for suspicious activity
- ✅ Set up rate limiting and quotas

### Database

- ✅ Enable Row-Level Security (RLS) on all tables
- ✅ Use service role key for admin operations
- ✅ Restrict user access with RLS policies
- ✅ Audit database access logs
- ✅ Use strong passwords for database users

### Deployment

- ✅ Use HTTPS for all connections
- ✅ Enable CORS restrictions
- ✅ Set up firewall rules
- ✅ Monitor deployment logs
- ✅ Use code review before deployment

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Anthropic Claude API Documentation](https://docs.anthropic.com)
- [Vercel Deployment Documentation](https://vercel.com/docs)
- [Environment Variables Best Practices](https://12factor.net/config)
- [Security Best Practices](https://owasp.org/www-project-top-ten/)

---

## Support

For issues or questions:

1. Check this guide first
2. Review the verification report
3. Check application and database logs
4. Contact the development team
5. Open an issue on GitHub

---

**Last Updated**: 2024
**Version**: 1.0
