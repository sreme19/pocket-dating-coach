POCKET DATING COACH — MULTI-AGENT SYSTEM HANDOFF
Date: 2026-05-27


WHAT THIS IS

This handoff covers the complete multi-agent matchmaking system that was scoped and implemented in this session. The system introduces three collaborating AI agents — AI Wingman (per male user), AI Bestie (per female user), and AI Matchmaker (central orchestrator) — plus two pool registries and an event-driven intelligence delivery layer.

The scope of this ticket is exclusively agent-to-agent communication. How AI Wingman and AI Bestie behave with their individual profile owners does not change beyond what is documented here. All existing chat behaviour is preserved exactly.


SYSTEM ARCHITECTURE

Six logical components:

AI Wingman (per male user)
  Reads the male profile owner's full user_master_profile. Also reads each female match's
  user_master_profile to ground coaching in verified facts not self-declared claims.
  Writes a distilled match profile to the vv_pool_wingmen registry when the user verifies
  or updates their profile. Detects improvement-intent messages and requests intelligence
  reports from AI Matchmaker. Delivers Matchmaker reports back to the male user via
  push notification and in-chat message.

AI Bestie (per female user)
  Same pattern as AI Wingman but for women. Also speaks to male matches on behalf of
  the female profile owner — transparently identified as AI Bestie, never impersonating.
  Requests competitive intelligence from Matchmaker to help the female user attract
  high-value men (defined as trust score + archetype combination).

AI Matchmaker (central orchestrator)
  The only agent that sees both sides. Reads vv_pool_wingmen and vv_pool_besties.
  Runs a nightly batch (Supabase Edge Function cron, 2 AM daily). Uses a hybrid model:
  algorithm for hard filters (dealbreakers, availability, city scope in Phase 2),
  Claude for soft scoring (emotional alignment, lifestyle fit, archetype compatibility,
  goal alignment). On-demand mode: responds to intelligence requests from individual
  Wingmen and Besties asynchronously.

All AI Wingmen pool registry (vv_pool_wingmen)
  Supabase table. One row per verified male user. Contains a distilled match_profile
  JSONB and a preference_signals JSONB. Written by AI Wingman service, read by Matchmaker.

All AI Besties pool registry (vv_pool_besties)
  Same structure for female users. preference_model JSONB contains normalized dealbreakers
  and signals — raw sensitiveTranslations are never written here.

When Matched (already implemented)
  The diamond event node on the architecture diagram. Matchmaker fires a verified_vibe_matches
  insert + push notifications when a pair scores >= 70. No changes to this flow.


NEW FILES CREATED

supabase/migrations/20260527_multi_agent_system.sql
  Run this in Supabase SQL Editor before anything else. Creates six tables:
  vv_pool_wingmen, vv_pool_besties, vv_intelligence_reports,
  vv_match_outcome_signals, vv_matchmaker_runs, vv_proactive_chat_messages.
  Also adds last_active_at TIMESTAMPTZ column to verified_vibe_users.
  All tables have RLS enabled with self-access policies for users and unrestricted
  service_role access for backend operations.

src/lib/server/pool-registry.ts
  Core pool management service. Exports:
    refreshWingmanPoolEntry(userId)   — distills male user_master_profile into pool row
    refreshBestiePoolEntry(userId)    — distills female user_master_profile into pool row
    enrollInPoolIfVerified(userId)    — called after verification; checks all 4 steps are
                                        complete before enrolling
    touchLastActive(userId)           — updates last_active_at; called on every chat request
    getTrustScoreBand(score)          — converts trust score to band string (e.g. '70-84')

  Distillation is privacy-safe by design. match_profile contains public signals only
  (bio, lifestyle tags, intent, proof signal labels — no raw financial data).
  preference_model strips raw sensitiveTranslations before writing.

src/lib/server/matchmaker-service.ts
  The matchmaker brain. Exports:
    runNightlyBatch(cityScoped?)         — full nightly batch; called by Edge Function
    queueIntelligenceReport(...)         — creates a pending vv_intelligence_reports row
    generatePerMatchRanking(userId)      — scores male user against competitors per match
    generateFemaleCompetitiveReport(userId) — positions female user vs competing women
                                              for high-value men in the pool

  Hard filter logic is algorithmic (dealbreakers, availability, city when Phase 2 is active).
  Soft scoring calls Claude with a structured prompt returning JSON: score, rationale, flags.
  JSON parsing strips markdown code fences before parsing (Claude 4.x wraps JSON in fences).

  Dealbreaker soft override: when a user has zero passing candidates, Matchmaker surfaces
  the top 5 closest-fitting profiles anyway, clearly flagged as outside stated preferences.

  Feedback loop: vv_match_outcome_signals rows are created by the unmatch endpoint.
  The nightly batch reads these to inform future scoring.

src/lib/server/intelligence-report-processor.ts
  Async report delivery layer. Exports:
    processIntelligenceReport(reportId)  — runs generation, writes result, sends push,
                                           stores proactive in-chat message
    popPendingChatMessage(userId)        — retrieves and clears the pending message for
                                           a user; called at the start of every chat request

  Delivery is dual: push notification (via sendPushNotification from
  src/lib/verified-vibe/server/notifications.ts) AND a proactive in-chat message
  stored in vv_proactive_chat_messages. The in-chat message is injected into the Claude
  system prompt context the next time the user opens Wingman or Bestie chat.

src/routes/api/verified-vibe/matchmaker/intelligence/+server.ts
  POST endpoint. Called by Wingman/Bestie when intelligence intent is detected or on
  cold/weekly triggers. Creates a vv_intelligence_reports row and fires async processing.
  Returns immediately with { reportId, message } — does not block on Claude.
  Guards against duplicate pending reports of the same type per user.

src/routes/api/verified-vibe/matchmaker/run/+server.ts
  POST endpoint. Secret-protected (MATCHMAKER_RUN_SECRET env var). Called exclusively
  by the Supabase Edge Function cron. Fires runNightlyBatch() asynchronously and returns
  { started: true } immediately.

src/routes/api/verified-vibe/matchmaker/unmatch/+server.ts
  POST endpoint. Records unmatch/block/no_messages outcome signals. Resolves which user
  is male and female, looks up archetype and trust band, writes to vv_match_outcome_signals.
  Hook this up wherever the existing unmatch/block UI action fires — the endpoint is ready,
  it just needs to be called from the client when a user unmatches.

supabase/functions/matchmaker-nightly/index.ts
  Deno Edge Function. POSTs to APP_URL/api/verified-vibe/matchmaker/run with the shared
  secret. Stateless — all logic lives in the SvelteKit app server where ANTHROPIC_API_KEY
  is available.


EXISTING FILES MODIFIED (minimal surgical changes only)

src/routes/api/verified-vibe/verify-step/+server.ts
  Added: import { enrollInPoolIfVerified } from '$lib/server/pool-registry'
  Added after persistVerificationStep(): enrollInPoolIfVerified(userId).catch(() => {})
  This is fire-and-forget. If pool enrollment fails, verification still succeeds.

src/routes/api/verified-vibe/master-profile/+server.ts
  Added: import { refreshWingmanPoolEntry, refreshBestiePoolEntry } from '$lib/server/pool-registry'
  Added at end of POST handler (before return json):
    refreshWingmanPoolEntry(userId).catch(() => {})
    refreshBestiePoolEntry(userId).catch(() => {})
  Both are fire-and-forget. The correct one will no-op based on the user's gender.

src/routes/api/verified-vibe/ai-wingman/chat/+server.ts
  Added imports for pool-registry, intelligence-report-processor, matchmaker-service.
  Added INTELLIGENCE_INTENTS array and detectsIntelligenceIntent() function at top of file.
  In handler body (after userId validation):
    touchLastActive(userId) — fire-and-forget
    detectsIntelligenceIntent check — if true, queues per_match_ranking report
    popPendingChatMessage call — retrieves any ready report
  pendingReportContext variable injected at end of systemPrompt template string.
  No other changes. All existing chat logic, system prompt, match loading, artifact
  loading, admirer logic — all untouched.

src/routes/api/verified-vibe/ai-bestie/chat/+server.ts
  Same pattern as Wingman. INTELLIGENCE_INTENTS_FEMALE array added.
  detectsFemaleIntelligenceIntent() function added.
  touchLastActive, queueIntelligenceReport (female_competitive), popPendingChatMessage
  all added in handler body. pendingReportContext injected into systemPrompt.
  No other changes to Bestie logic.


DATABASE TABLES (new)

vv_pool_wingmen
  user_id (PK, FK verified_vibe_users), archetype, trust_score_band, city,
  match_profile JSONB, preference_signals JSONB, availability_status, last_updated
  Indexed on city, archetype, trust_score_band, availability_status.

vv_pool_besties
  Same structure. preference_model JSONB replaces preference_signals.
  preference_model never contains raw sensitiveTranslations.

vv_intelligence_reports
  id, user_id, report_type ('pool_competitive'|'per_match_ranking'|'female_competitive'),
  trigger_type ('user_driven'|'cold_push'|'weekly'), status ('pending'|'processing'|'ready'|'delivered'),
  payload JSONB, summary TEXT, action_list JSONB, requested_at, completed_at, delivered_at.
  Indexed on (user_id, status) and requested_at.

vv_proactive_chat_messages
  user_id (PK — one row per user, upserted), report_id, report_type, message TEXT,
  delivered BOOLEAN, created_at. Cleared when the user next opens Wingman/Bestie chat.

vv_match_outcome_signals
  id, match_id, male_user_id, female_user_id, outcome ('unmatched'|'blocked'|'no_messages'|'converted'),
  initiated_by_gender, compatibility_score FLOAT, male_archetype, female_archetype,
  male_trust_band, outcome_at. Indexed on male_user_id, female_user_id, outcome.

vv_matchmaker_runs
  id, run_type, city, pairs_evaluated, hard_filtered, soft_scored, matches_fired,
  soft_overrides, started_at, completed_at, error. One row per nightly batch run.

verified_vibe_users (modified)
  Added: last_active_at TIMESTAMPTZ DEFAULT NOW()
  Updated by touchLastActive() on every Wingman/Bestie chat request.
  Cold user threshold: 7 days. Nightly batch checks this to queue cold_push reports.


ENVIRONMENT VARIABLES

.env.local (and production env) needs:

  MATCHMAKER_RUN_SECRET=<generate with: openssl rand -hex 32>

This secret is checked by the /api/verified-vibe/matchmaker/run endpoint to authenticate
calls from the Supabase Edge Function. Without it the endpoint returns 401.

Supabase Edge Function environment (Dashboard > Edge Functions > matchmaker-nightly):
  APP_URL=https://your-production-url.vercel.app
  MATCHMAKER_RUN_SECRET=<same value as above>
  CITY_SCOPED=false   (Phase 1 — global pool, no city restriction)


DEPLOYMENT STEPS

Step 1 — [DONE] Migration already applied live to Supabase project stikoktiaxqtcsohcxzp.
  All 6 tables (vv_pool_wingmen, vv_pool_besties, vv_intelligence_reports,
  vv_proactive_chat_messages, vv_match_outcome_signals, vv_matchmaker_runs)
  and the last_active_at column on verified_vibe_users are live with RLS enabled.
  Supabase advisors check confirmed no new security issues.

Step 2 — Generate and set the shared secret:
  openssl rand -hex 32
  Copy the output. Set it as MATCHMAKER_RUN_SECRET in your production environment
  (Vercel env vars, or wherever you manage secrets). Also paste it into
  supabase/functions/matchmaker-nightly env in the Supabase Dashboard.

Step 3 — [DONE] Edge Function deployed.
  supabase functions deploy matchmaker-nightly completed successfully.
  Still need to set env vars in Supabase Dashboard > Edge Functions > matchmaker-nightly:
    APP_URL=https://your-production-url.vercel.app
    MATCHMAKER_RUN_SECRET=<same value as Vercel>
    CITY_SCOPED=false

Step 4 — Create the cron job:
  In Supabase Dashboard > Database > Cron Jobs, create a new job:
    Schedule:  0 2 * * *
    Command:   SELECT net.http_post(
                 'https://[your-project].supabase.co/functions/v1/matchmaker-nightly',
                 '{}',
                 'application/json'
               );
  The pg_net extension must be enabled (Dashboard > Database > Extensions > pg_net).

Step 5 — Redeploy the SvelteKit app to Vercel so the new endpoints go live.


PENDING WORK NOT YET BUILT

Unmatch/block UI hookup
  src/routes/api/verified-vibe/matchmaker/unmatch/+server.ts is ready and tested.
  It needs to be called from the client wherever an unmatch or block action fires.
  Find the existing unmatch/block buttons in the verified-vibe UI (likely in
  UserProfileCard.svelte, MatchOverlay.svelte, or the conversation settings menu),
  and POST to /api/verified-vibe/matchmaker/unmatch with userId, matchedUserId,
  matchId, and outcome ('unmatched' or 'blocked'). The 'converted' outcome (user
  exchanged 5+ messages) is not yet wired — implement as a message count trigger
  in the conversation message send endpoint.

Phase 2: City-scoped matching
  Currently CITY_SCOPED=false in the Edge Function. When you are ready to scope
  matching to the same city, set CITY_SCOPED=true. The hard filter in matchmaker-service.ts
  already handles this: it compares city strings case-insensitively and skips pairs
  in different cities. However city is currently a free-text field from the profile.
  For Phase 2 to work accurately, you need in-app GPS location sharing that resolves
  to a canonical city name. That is a separate ticket.

Trust score floor
  getTrustScoreBand() in pool-registry.ts maps scores to bands. The Matchmaker currently
  has no minimum trust band filter in the hard filter function. When you decide the floor
  (options were 60, 70, 85, 95), add a check in hardFilter() in matchmaker-service.ts:
    if (male.trust_score_band === '0-39' || male.trust_score_band === '40-59') return true;
  Adjust the band strings to match whatever threshold you choose.

AI Wingman speaking to female matches on behalf of male user
  Scoped for a future ticket. AI Bestie's equivalent (speaking to male matches on behalf
  of the female user) is already in scope but not yet built. The Bestie system prompt
  references this behaviour conceptually but the actual message-sending mechanism
  (detecting [DRAFT:MatchName] tags and routing them to the conversation) is separate
  from the multi-agent scope and belongs in the Bestie chat ticket.

Pool size threshold for rank format switching
  generatePerMatchRanking() in matchmaker-service.ts always uses the rank-number format
  ("3rd out of 7 men"). The percentile format ("top 28%") for large pools is not yet
  conditional. Add a PER_CITY_POOL_SIZE check: if total eligible competitors per city
  exceeds 500, switch to percentile. Currently the pool is small enough that rank-number
  is always appropriate.


INTELLIGENCE REPORT TRIGGER PHRASES

These phrases in a user message trigger an intelligence report request. They are defined
as arrays at the top of the modified chat server files.

AI Wingman triggers (in ai-wingman/chat/+server.ts → INTELLIGENCE_INTENTS):
  'how can i improve', 'how do i improve', 'how to improve',
  'better matches', 'get better matches', 'more matches',
  'improve my ranking', 'my ranking', 'how do i rank',
  'beat the competition', 'compete', 'how am i doing',
  'improve my fit', 'better fit', 'fit with her',
  'what should i work on', 'what can i do better',
  'how can i win', 'how do i win'

AI Bestie triggers (in ai-bestie/chat/+server.ts → INTELLIGENCE_INTENTS_FEMALE):
  'how can i improve', 'how do i improve', 'how to improve',
  'better matches', 'get better matches', 'attract better',
  'high value men', 'high-value men', 'quality men',
  'improve my profile', 'stand out', 'compete',
  'how am i doing', 'my ranking', 'how do i rank',
  'what should i work on', 'what can i do better',
  'beat other women', 'get his attention', 'get noticed'

Add or remove phrases as you observe real user language in production.


HOW INTELLIGENCE REPORT DELIVERY WORKS (end to end)

1. User sends a message matching an intelligence trigger phrase.
2. Chat server calls queueIntelligenceReport() → creates vv_intelligence_reports row (status: pending).
3. processIntelligenceReport() is fired asynchronously (does not block chat response).
4. Claude is still called for the immediate chat response — user gets a normal reply right away.
5. processIntelligenceReport() runs generatePerMatchRanking() or generateFemaleCompetitiveReport().
   This involves several Claude calls (soft scoring, gap actions, action list).
6. Report is written back to vv_intelligence_reports (status: ready, payload filled).
7. Push notification sent: "💡 Your Competitive Intelligence Report is Ready".
8. vv_proactive_chat_messages upserted with the formatted message (one pending row per user).
9. Next time the user sends any message to Wingman/Bestie chat:
   - popPendingChatMessage() retrieves and clears the pending row
   - The formatted report is injected into Claude's system prompt as INTELLIGENCE REPORT READY context
   - Claude acknowledges the report and summarises action points naturally in its response
   - Report is marked as delivered in vv_intelligence_reports


PRIVACY GUARANTEES (do not break these)

Matchmaker reads ONLY from vv_pool_wingmen and vv_pool_besties — the distilled registries.
It never reads user_master_profile or FemalePreferenceModel directly.

The pool registry distillation in pool-registry.ts deliberately strips:
  - Raw financial document data (amounts, account numbers)
  - Raw sensitiveTranslations from FemalePreferenceModel
  - Private compatibility notes

Intelligence reports returned to a Wingman contain only that male user's competitive
position and aggregated signals from the pool. They never contain another individual
user's identity or private data.

Intelligence reports returned to a Bestie follow the same rule. The report mentions
"high-value men in the pool" with archetype/trust band aggregates, never names or IDs.


KNOWN LIMITATIONS IN V1

The nightly batch scores every male against every female in the pool. For small pools
(under 100 users) this is fine. At 1000 users it becomes 1,000,000 potential pairs,
which is expensive in Claude API calls. Mitigation: the hard filter eliminates most pairs
before Claude is called. Long-term, add a first-pass geographic filter (Phase 2) and a
pre-filter on archetype bands to reduce Claude calls. The vv_matchmaker_runs table logs
pairs_evaluated, hard_filtered, and soft_scored for each run — monitor these to
understand when a batching or sampling strategy is needed.

The feedback loop writes unmatch signals to vv_match_outcome_signals but the nightly
batch does not yet read them to adjust scoring weights. The data is being collected
now so it is there when you are ready to use it. The simplest v2 implementation:
after the batch completes, query outcome signals grouped by archetype pair and trust band,
compare unmatch rate vs convert rate, and add a penalty multiplier to pairs with high
unmatch rates in future soft scoring prompts.


SUPABASE DB POOLER URL (for Kiro MCP)
postgresql://postgres.stikoktiaxqtcsohcxzp:t9a6reBFWlWEzKMJ@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require


QUICK REFERENCE: NEW API ENDPOINTS

POST /api/verified-vibe/matchmaker/intelligence
  Body: { userId, reportType, triggerType }
  reportType: 'pool_competitive' | 'per_match_ranking' | 'female_competitive'
  triggerType: 'user_driven' | 'cold_push' | 'weekly'
  Returns: { reportId, message }

POST /api/verified-vibe/matchmaker/run
  Body: { secret, cityScoped? }
  Auth: secret must match MATCHMAKER_RUN_SECRET env var
  Returns: { started, cityScoped }

POST /api/verified-vibe/matchmaker/unmatch
  Body: { userId, matchedUserId, matchId, outcome }
  outcome: 'unmatched' | 'blocked' | 'no_messages'
  Returns: { recorded }


CHECKLIST BEFORE GOING LIVE

[x] Run supabase/migrations/20260527_multi_agent_system.sql in Supabase SQL Editor
    (Applied live to project stikoktiaxqtcsohcxzp on 2026-05-27)
[x] Deploy Edge Function: supabase functions deploy matchmaker-nightly (deployed 2026-05-27)
[x] Wire up unmatch/block UI to POST /api/verified-vibe/matchmaker/unmatch
    (Three-dot menu in chat header → Unmatch/Block modals, wired to /api/verified-vibe/unmatch
     and /api/verified-vibe/block-user which both fire matchmaker outcome signals)
[x] Make /api/verified-vibe/block-user real (was a stub — now writes to DB and signals Matchmaker)
[x] Generate MATCHMAKER_RUN_SECRET — value: c4f69dae7948c4fb3d70a4e62153e0b15c464e2055c5dd37ab1f699cd3dccc99
    Set in .env.local. STILL NEEDED: set in Vercel Dashboard > Project > Settings > Environment Variables
[x] Set MATCHMAKER_RUN_SECRET, APP_URL, CITY_SCOPED=false in Supabase Edge Function env
    (Set via CLI: supabase secrets set, project stikoktiaxqtcsohcxzp, 2026-05-27)
[x] Enable pg_net extension (enabled 2026-05-27, v0.20.0)
[x] Enable pg_cron extension (enabled 2026-05-27, v1.6.4)
[x] Create cron job (jobid=1, schedule "0 2 * * *", live in cron.job table)
[x] Push to GitHub — commit 4f18597, Vercel auto-deploy triggered
[ ] Set MATCHMAKER_RUN_SECRET in Vercel Dashboard (last manual step)
    Go to vercel.com > pocket-dating-coach > Settings > Environment Variables
    Add: MATCHMAKER_RUN_SECRET = c4f69dae7948c4fb3d70a4e62153e0b15c464e2055c5dd37ab1f699cd3dccc99
    Redeploy after adding it (or it takes effect on next auto-deploy)
[ ] Smoke test: POST to /api/verified-vibe/matchmaker/intelligence with a valid userId
    and verify a vv_intelligence_reports row is created and processed
