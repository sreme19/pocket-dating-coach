# AI Bestie Preferences Feature — Complete Documentation

**Project:** pocket-dating-coach  
**Feature:** Personalized AI Bestie Coaching via User Preferences  
**Status:** ✅ Production Ready  
**Last Updated:** May 22, 2026

---

## 📚 Documentation Index

### Quick Start (5 minutes)
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** — TL;DR version with just the SQL and commands

### Deployment (30 minutes)
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** — Step-by-step deployment guide with verification
- **[MIGRATION_READY.md](./MIGRATION_READY.md)** — Detailed deployment guide with all context

### Understanding the Feature
- **[HANDOFF_SUMMARY.md](./HANDOFF_SUMMARY.md)** — Complete overview of what's implemented
- **[ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md)** — Visual diagrams and system architecture
- **[PREFERENCES_IMPLEMENTATION.md](./PREFERENCES_IMPLEMENTATION.md)** — Full technical documentation

### Migration Details
- **[supabase/migrations/KIRO_PREFERENCES_MIGRATION.md](./supabase/migrations/KIRO_PREFERENCES_MIGRATION.md)** — Original handoff document
- **[supabase/migrations/20260522_add_preferences_to_users.sql](./supabase/migrations/20260522_add_preferences_to_users.sql)** — The actual SQL migration

---

## 🚀 Quick Start

### 1. Apply Migration

```sql
ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_verified_vibe_users_preferences ON verified_vibe_users USING GIN (preferences);
```

### 2. Verify

```bash
npm run verify:preferences
```

### 3. Seed (Optional)

```bash
npm run seed:preferences
```

### 4. Test

- Female user activates AI Bestie
- Male user sends message
- Coaching card appears with personalized analysis ✅

---

## 📖 What This Feature Does

When a female user activates AI Bestie:

1. **Fetches her preferences** from the database (JSONB column)
2. **Combines with her profile** (about, looking for)
3. **Injects into Claude's prompt** for personalized analysis
4. **Claude analyzes** the male user's message through her lens
5. **Returns personalized coaching** (signal, read, suggested question)

**Result:** AI Bestie coaching is grounded in her actual dating criteria, values, and lifestyle.

---

## 🏗️ What's Implemented

### Database
- ✅ `preferences` JSONB column on `verified_vibe_users`
- ✅ GIN index for fast lookups
- ✅ Default empty object `{}`

### Backend
- ✅ API endpoint fetches preferences
- ✅ Builds context string
- ✅ Injects into Claude prompt
- ✅ Returns personalized analysis

### Frontend
- ✅ Sends `userId` to API
- ✅ Displays coaching card
- ✅ Auto-sends suggested question

### TypeScript
- ✅ Types updated for preferences column

### Scripts
- ✅ Seed script to populate preferences
- ✅ Verification script to check migration

---

## 📋 Files Overview

```
pocket-dating-coach/
├── supabase/migrations/
│   ├── 20260522_add_preferences_to_users.sql          ← The migration SQL
│   ├── KIRO_PREFERENCES_MIGRATION.md                  ← Original handoff
│   └── KIRO_HANDOFF.md                                ← Handoff doc
├── src/
│   ├── lib/server/supabase.ts                         ← Types (updated)
│   └── routes/api/verified-vibe/ai-bestie/
│       └── generate-response/+server.ts               ← API endpoint (updated)
│   └── routes/verified-vibe/chat/
│       └── [conversationId]/+page.svelte              ← Frontend (updated)
├── scripts/
│   ├── seed-preferences.ts                            ← Seed script
│   └── verify-preferences-migration.ts                ← Verification script
├── QUICK_REFERENCE.md                                 ← TL;DR
├── DEPLOYMENT_CHECKLIST.md                            ← Step-by-step
├── MIGRATION_READY.md                                 ← Deployment guide
├── HANDOFF_SUMMARY.md                                 ← Overview
├── ARCHITECTURE_DIAGRAM.md                            ← Diagrams
├── PREFERENCES_IMPLEMENTATION.md                      ← Full docs
└── README_PREFERENCES.md                              ← This file
```

---

## 🔄 How It Works

### User Flow

```
Female user activates AI Bestie
    ↓
Male user sends message
    ↓
Frontend detects message
    ↓
Calls: POST /api/verified-vibe/ai-bestie/generate-response
    Payload: { conversationId, adrianMessage, matchName, userId }
    ↓
Backend fetches: preferences, about, looking
    ↓
Builds context string with all three
    ↓
Injects into Claude prompt
    ↓
Claude returns: { signal, read, suggestedQuestion }
    ↓
Display coaching card to female user
Auto-send suggested question to male user
```

### Example Preferences

```json
{
  "lookingFor": ["serious relationship"],
  "nonNegotiables": ["understands NRI experience"],
  "strongPreferences": ["based in UK/Europe", "career-stable"],
  "openTo": ["Indian men if relocation negotiable"],
  "notLookingFor": ["ABCD types"],
  "communicationStyle": ["warm", "direct"],
  "greenFlags": ["navigated family expectations"],
  "yellowFlags": ["'I'm very open-minded'"],
  "redFlags": ["expects her to be traditional"],
  "interviewNotes": "Ask about 5-year plans"
}
```

---

## 🛠️ Deployment

### Step 1: Apply Migration (5 min)

Via Supabase Dashboard or Kiro:
```sql
ALTER TABLE verified_vibe_users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_verified_vibe_users_preferences ON verified_vibe_users USING GIN (preferences);
```

### Step 2: Verify (2 min)

```bash
npm run verify:preferences
```

### Step 3: Seed (5-10 min, optional)

```bash
npm run seed:preferences
```

### Step 4: Test (10 min)

- Female user activates AI Bestie
- Male user sends message
- Coaching card appears ✅

### Step 5: Deploy (automatic)

Push to main → Vercel deploys automatically

---

## ✅ Verification

After migration, run:

```bash
npm run verify:preferences
```

Expected output:
```
✅ Column exists
✅ Sample data accessible
✅ Index configured
✅ API endpoint ready

🚀 Ready to deploy!
```

Or manually verify:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'verified_vibe_users' AND column_name = 'preferences';

SELECT indexname FROM pg_indexes 
WHERE tablename = 'verified_vibe_users' AND indexname = 'idx_verified_vibe_users_preferences';
```

---

## 🔒 Security

- ✅ Preferences are private to the female user
- ✅ Male user never sees preferences
- ✅ Uses service role key (server-side only)
- ✅ No RLS changes needed
- ✅ Coaching card not sent to male user

---

## 🔄 Rollback

If needed:

```sql
DROP INDEX IF EXISTS idx_verified_vibe_users_preferences;
ALTER TABLE verified_vibe_users DROP COLUMN IF EXISTS preferences;
```

The endpoint gracefully handles missing preferences.

---

## 📊 Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| Seed preferences | `npm run seed:preferences` | Populate preferences from `.md` files |
| Verify migration | `npm run verify:preferences` | Check migration was applied |

---

## 🧪 Testing

### Manual Testing

1. Open two incognito windows
2. Tab 1: Log in as female user
3. Tab 2: Log in as male user
4. Tab 1: Open chat, activate AI Bestie
5. Tab 2: Send message
6. Tab 1: Coaching card appears within 5 seconds
7. Verify read text references her preferences

### Automated Testing

```bash
npm run verify:preferences
```

---

## 📚 Documentation Map

| Document | Best For |
|----------|----------|
| QUICK_REFERENCE.md | Quick answers, TL;DR |
| DEPLOYMENT_CHECKLIST.md | Step-by-step deployment |
| MIGRATION_READY.md | Detailed deployment guide |
| HANDOFF_SUMMARY.md | Understanding the feature |
| ARCHITECTURE_DIAGRAM.md | Visual understanding |
| PREFERENCES_IMPLEMENTATION.md | Full technical details |
| README_PREFERENCES.md | This index |

---

## ❓ FAQ

**Q: Will this break existing code?**  
A: No, it's non-breaking. Existing code works without preferences.

**Q: Do I need to change RLS?**  
A: No, existing policies cover this column.

**Q: Can I rollback?**  
A: Yes, simple SQL to drop column and index.

**Q: What if preferences are missing?**  
A: Endpoint gracefully handles it, just less personalized.

**Q: How long does deployment take?**  
A: ~30 minutes including testing.

**Q: Can I seed preferences later?**  
A: Yes, seed script can be run anytime.

**Q: What if seed script fails?**  
A: Check that female profile folders have `preferences.md` files.

**Q: How do I update preferences?**  
A: Currently manual via database. Future: API endpoint for user updates.

---

## 🚀 Next Steps

1. **Read** [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for overview
2. **Follow** [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for deployment
3. **Run** `npm run verify:preferences` to confirm
4. **Test** end-to-end flow
5. **Deploy** to production

---

## 📞 Support

- **Quick answers:** [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **Deployment help:** [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- **Technical details:** [PREFERENCES_IMPLEMENTATION.md](./PREFERENCES_IMPLEMENTATION.md)
- **Architecture:** [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md)

---

## ✨ Summary

This is a **complete, production-ready implementation** of personalized AI Bestie coaching. All components are in place:

- ✅ Database schema ready
- ✅ Backend API complete
- ✅ Frontend integration done
- ✅ TypeScript types updated
- ✅ Seed script ready
- ✅ Verification script ready
- ✅ Documentation complete

**Status:** Ready for deployment 🚀

---

**Prepared by:** Kiro  
**Date:** May 22, 2026  
**Version:** 1.0.0
