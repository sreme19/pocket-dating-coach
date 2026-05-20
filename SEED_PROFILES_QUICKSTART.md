# Seed Profiles Onboarding — Quick Start

## What We Built

A production-ready seeding script that populates your Verified Vibe platform with 43 realistic dating profiles (20 male, 23 female archetypes) from `/static/{male,female}_profiles/`.

**Everything works in both dev and production** (after you deploy the tables).

---

## 3-Step Onboarding

### Step 1: Deploy Tables to Supabase (One-time)

**Location**: `supabase/migrations/20260520_create_verified_vibe_tables.sql`

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Click **SQL Editor** → **New Query**
3. Copy the entire SQL from `supabase/migrations/20260520_create_verified_vibe_tables.sql`
4. Paste and run

Tables created:
- `verified_vibe_users` (core profiles)
- `verified_vibe_verification` (4-step tracking)
- `verified_vibe_matches`, `verified_vibe_messages`, `verified_vibe_typing_indicators` (chat)
- `verified_vibe_likes`, `verified_vibe_passes` (swipe actions)

**Time**: ~30 seconds

---

### Step 2: Run Seeding Script

```bash
npm run seed:profiles
```

This:
- Creates 43 Supabase auth users (email: `{profile_name}@seed.vv`)
- Populates profiles with parsed archetype, age, city, trust score
- Uploads all photos (~50 total) to Supabase Storage
- Marks all 4 verification steps as complete (skips the real verification flow)
- Creates 10 seed matches between male/female pairs

**Time**: ~2–5 minutes depending on photo upload speed

**Output**:
```
✓ Seeded 43 profiles
✓ Uploaded 50 photos
✓ Marked 172 verification steps complete
✓ Created ~10 seed matches

🔐 Test login credentials:
   Email: {folder_name}@seed.vv
   Password: SeedPass123!
```

---

### Step 3: Log In & Test

**Dev**: 
```
App: http://localhost:5174
Email: alex_monogamish_t9n2cw@seed.vv
Password: SeedPass123!
```

**Production**: Same email/password (works because `SEED_ACCOUNT_PASSWORD` is set in Vercel env vars)

---

## What You Can Now Do

### Profile Development
- View all 43 profiles in the discover feed
- Edit profiles, add tags, update "about" section
- Test the profile completeness UI (already 100% for all seed users)

### Messaging Development
- Click any profile → match with them
- Open existing matches → test chat interface
- Test realtime typing indicators, message reactions, read receipts
- Implement AI reply suggestions (already has API, UI needs building)

### Design Polish
- Test multi-photo gallery (all photos uploaded)
- Verify trust score badges (75–95 range)
- Check avatar uploads and storage URLs

---

## Configuration

**In `.env.local`**:
```env
SEED_ACCOUNT_PASSWORD=SeedPass123!
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

**In `.env` (production/Vercel)**:
```
SEED_ACCOUNT_PASSWORD=SeedPass123!  # Add this
```

---

## Data Shape

### Profile Fields

From each `/static/{gender}_profiles/{folder}/` we extract:

| Field | Source | Example |
|---|---|---|
| `email` | folder name | `alex_monogamish_t9n2cw@seed.vv` |
| `gender` | parent dir | `man` or `woman` |
| `first_name` | profile.json | "Alex" |
| `age` | profile.json | 33 |
| `archetype` | profile.json | "The Monogamish Man" |
| `city` | personality.md (parsed) | "San Francisco" (or "Bengaluru" default) |
| `about` | personality.md (first paragraph) | 500-char narrative |
| `avatar_url` | first photo in `/photos` | Supabase Storage URL |
| `trust_score` | photo count-based | 75–95 range |

### Trust Score Algorithm

```
trust_score = MIN(75 + (photoCount * 3), 95) + random(-2 to +2)
```

Examples:
- 1 photo → ~76–80
- 2 photos → ~79–83
- 3+ photos → ~82–95

---

## Idempotency

Re-running `npm run seed:profiles` is **100% safe**:
- Existing users are skipped (checked by email)
- Existing profiles are upserted (not duplicated)
- Photos re-upload with `upsert: true` (overwrite)
- Verification steps are upserted by (user_id, step)
- Matches only create if they don't exist

---

## Next Steps

### Build on This Foundation

1. **Next: Create seed-login endpoint** (Phase 2)
   - POST `/api/seed-login` 
   - Accept email + password for `@seed.vv` accounts
   - Works in dev + production (no OTP email)

2. **Then: Profile & Messaging UI**
   - Multi-photo gallery (photos already uploaded)
   - AI reply suggestions UI (API exists)
   - Message reactions UI (API exists)
   - Archetype deep-dive panel

---

## Troubleshooting

### "Could not find the table 'verified_vibe_users'"

→ You haven't run the migration SQL yet. Go to Supabase Dashboard → SQL Editor → paste and run `20260520_create_verified_vibe_tables.sql`

### "Failed to upload photo"

→ Check your `SUPABASE_SERVICE_KEY` has write access to the `profiles` storage bucket. Or bucket doesn't exist. Create it via Supabase Dashboard → Storage → New bucket → name: `profiles`, public: true.

### "SEED_ACCOUNT_PASSWORD not found"

→ Add to `.env.local`:
```
SEED_ACCOUNT_PASSWORD=SeedPass123!
```

### Photos not showing

→ Photos are uploaded to `seed/{user_id}/avatar.jpg` in the `profiles` bucket. Check:
- Storage bucket is public (or use signed URLs)
- `avatar_url` column is populated in `verified_vibe_users`
- Browser network tab shows 200 status for image URLs

---

## Files Modified/Created

```
scripts/
  seed-profiles.ts            [NEW] Seeding script (340 lines)

supabase/migrations/
  20260520_create_verified_vibe_tables.sql  [NEW] Schema migration
  README.md                                 [NEW] Migration guide

.env.local
  + SEED_ACCOUNT_PASSWORD=SeedPass123!

package.json
  + "seed:profiles": "tsx --env-file=.env.local scripts/seed-profiles.ts"
```

---

## Support

For questions on:
- **Schema**: See `supabase/migrations/README.md`
- **Script logic**: See comments in `scripts/seed-profiles.ts`
- **Data shapes**: See this quickstart "Data Shape" section
- **Next phases**: See `SEED_PROFILES_QUICKSTART.md` "Next Steps"
