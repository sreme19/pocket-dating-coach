# Setup Scripts

## Environment Configuration

### Quick Setup (Recommended)

Use the interactive setup script to configure environment variables:

```bash
# Set up local development environment
./scripts/setup-env.sh local

# Set up production environment
./scripts/setup-env.sh production
```

This will:
1. Prompt you for required credentials
2. Create `.env.local` or `.env.production`
3. Optionally verify the setup

### Manual Setup

1. Copy the template: `cp .env.example .env.local`
2. Edit `.env.local` and fill in your credentials
3. Verify setup: `npm run verify:local-env`

## Environment Verification

Verify that all environment variables are set and services are accessible:

```bash
# Verify local environment
npm run verify:local-env

# Verify production environment
npm run verify:prod-env
```

This will check:
- ✅ All required environment variables are set
- ✅ Supabase connectivity
- ✅ Claude API connectivity
- ✅ Database tables exist
- ✅ Generate a verification report

## Required Environment Variables

### For Development (.env.local)

```dotenv
ANTHROPIC_API_KEY=sk-ant-api03-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### For Production (.env.production)

Same as development, but with production credentials.

See [DEPLOYMENT.md](../DEPLOYMENT.md) for detailed setup instructions.

---

## FAL_KEY Configuration

The FAL_KEY is required to enable AI photo generation with fal.ai. Use one of these methods to configure it:

### Method 1: npm script (recommended)

```bash
npm run setup:fal
```

This will prompt you interactively for your FAL_KEY and add it to `.env.local`.

### Method 2: npm script with key as argument

```bash
npm run setup:fal -- your_fal_key_here
```

### Method 3: Direct bash script

```bash
./scripts/setup-fal-key.sh
```

Or with key as argument:

```bash
./scripts/setup-fal-key.sh your_fal_key_here
```

### Method 4: Direct Node.js script

```bash
node scripts/setup-fal-key.js
```

Or with key as argument:

```bash
node scripts/setup-fal-key.js your_fal_key_here
```

### Method 5: Manual setup

1. Get your FAL_KEY from [fal.ai](https://fal.ai)
2. Open `.env.local` in your editor
3. Add or update the line: `FAL_KEY=your_key_here`
4. Save and restart your dev server

## After Setup

1. Restart your dev server: `npm run dev`
2. Go through the verification flow and upload a photo in Step 3
3. Navigate to your profile page
4. Click "Enhance with AI" to generate AI-enhanced photos

## Troubleshooting

- **"FAL_KEY is not configured"**: Make sure you ran the setup script and restarted the dev server
- **Generation fails**: Check that your FAL_KEY is valid at [fal.ai](https://fal.ai)
- **Slow generation**: First generation takes ~30 seconds. Subsequent generations are cached.

---

## Database Setup

### Create AI Assistant Schema

```bash
tsx --env-file=.env.local scripts/create-ai-assistant-schema.sql
```

This creates the required tables:
- `ai_assistant_profiles` - Stores preferences.md and personality.md
- `ai_assistant_conversations` - Stores conversation history
- `ai_assistant_summaries` - Stores hourly summaries
- `ai_assistant_configs` - Stores assistant settings

### Configure Row-Level Security (RLS)

```bash
npm run configure:rls
npm run apply:rls
```

This sets up RLS policies to ensure users can only access their own data.

---

## Available Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| Setup Environment | `./scripts/setup-env.sh [local\|production]` | Interactive environment setup |
| Verify Environment | `npm run verify:local-env` | Verify local environment |
| Verify Production | `npm run verify:prod-env` | Verify production environment |
| Setup FAL Key | `npm run setup:fal` | Configure FAL_KEY for AI photos |
| Ingest Documents | `npm run ingest` | Ingest PDF documents into vector store |
| Seed Profiles | `npm run seed:profiles` | Create sample user profiles |
| Configure RLS | `npm run configure:rls` | Set up RLS policies |
| Apply RLS | `npm run apply:rls` | Apply RLS policies to database |

---

## For More Information

- See [DEPLOYMENT.md](../DEPLOYMENT.md) for production deployment guide
- See [.env.example](../.env.example) for environment variable template
- See [.env.production](../.env.production) for production template

