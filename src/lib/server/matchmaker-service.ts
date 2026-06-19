/**
 * Matchmaker Service
 *
 * Hybrid intelligence model:
 *   - Algorithm layer: hard filters (dealbreakers, availability, city Phase 2)
 *   - Claude layer:    soft scoring (emotional alignment, lifestyle fit,
 *                      archetype compatibility, goal alignment)
 *
 * Two operating modes:
 *   1. runNightlyBatch()     — called by the Supabase Edge Function cron (nightly)
 *   2. generateIntelligenceReport() — called on-demand by Wingman/Bestie
 *
 * Privacy contract: this service NEVER reads individual users' raw master
 * profiles or sensitive translations. It works exclusively from the distilled
 * match_profile and preference_model columns in vv_pool_wingmen/vv_pool_besties.
 */

import { getSupabase } from './supabase';
import { getClaudeClient, CLAUDE_MODEL } from '../claude';
import { sendPushNotification } from '../verified-vibe/server/notifications';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WingmanPoolRow {
  user_id:             string;
  archetype:           string;
  trust_score_band:    string;
  city:                string | null;
  match_profile:       Record<string, unknown>;
  preference_signals:  Record<string, unknown>;
  availability_status: string;
  last_updated:        string;
}

export interface BestiePoolRow {
  user_id:             string;
  archetype:           string;
  trust_score_band:    string;
  city:                string | null;
  match_profile:       Record<string, unknown>;
  preference_model:    Record<string, unknown>;
  availability_status: string;
  last_updated:        string;
}

export interface ScoredPair {
  maleUserId:   string;
  femaleUserId: string;
  score:        number;       // 0–100
  rationale:    string;       // Claude's explanation (not shown to users directly)
  flags:        string[];     // key compatibility signals identified
}

// ── Hard filter ───────────────────────────────────────────────────────────────
// Returns true if the pair is ELIMINATED (should NOT be matched).
// Exported so the admin Test Suite can score a single pair through the EXACT
// production filter without re-running the nightly batch (AI_TEST_SUITE_DESIGN.md §4).

export function hardFilter(
  male:   WingmanPoolRow,
  female: BestiePoolRow,
  cityScoped: boolean
): boolean {
  // Availability check
  if (male.availability_status !== 'active') return true;
  if (female.availability_status !== 'active') return true;

  // City scope (Phase 2 — only active when cityScoped=true)
  if (cityScoped) {
    if (!male.city || !female.city) return false; // no city = don't exclude
    if (male.city.toLowerCase().trim() !== female.city.toLowerCase().trim()) return true;
  }

  // Dealbreaker check — male dealbreakers vs female profile signals
  const maleDealbreakers = (male.preference_signals.dealbreakers ?? []) as string[];
  const femaleSignals = [
    ...((female.match_profile.compatibilitySignals ?? []) as string[]),
    ...((female.match_profile.whatSheValues ?? []) as string[]),
    female.preference_model.relationshipIntent as string ?? '',
  ].join(' ').toLowerCase();

  for (const db of maleDealbreakers) {
    if (db && femaleSignals.includes(db.toLowerCase())) return true;
  }

  // Dealbreaker check — female dealbreakers vs male profile signals
  const femaleDealbreakers = (female.preference_model.dealbreakers ?? []) as string[];
  const maleSignals = [
    ...((male.match_profile.topProofSignals ?? []) as string[]),
    ...((male.match_profile.personalityDescriptors ?? []) as string[]),
    male.match_profile.intentStatement as string ?? '',
    male.preference_signals.lookingFor as string ?? '',
  ].join(' ').toLowerCase();

  for (const db of femaleDealbreakers) {
    if (db && maleSignals.includes(db.toLowerCase())) return true;
  }

  return false; // pair passes hard filters
}

// ── Claude soft scoring ────────────────────────────────────────────────────────

// Exported so the admin Test Suite can display the EXACT prompt the soft-scorer
// sends to Claude in its observability trace, with zero risk of drift.
export function buildSoftScorePrompt(male: WingmanPoolRow, female: BestiePoolRow): string {
  return `You are evaluating compatibility between a male and female user on a verified dating platform.

MALE PROFILE:
Archetype: ${male.archetype}
Trust band: ${male.trust_score_band}
Intent: ${male.match_profile.intentStatement ?? 'not specified'}
Personality: ${(male.match_profile.personalityDescriptors as string[] ?? []).join(', ')}
Lifestyle tags: ${(male.match_profile.lifestyleTags as string[] ?? []).join(', ')}
Proof signals: ${(male.match_profile.topProofSignals as string[] ?? []).join(', ')}
Looking for: ${male.preference_signals.lookingFor ?? 'not specified'}
Emotional signals he values: ${(male.preference_signals.emotionalSignals as string[] ?? []).join(', ')}

FEMALE PROFILE:
Archetype: ${female.archetype}
What she values: ${(female.match_profile.whatSheValues as string[] ?? []).join(', ')}
Compatibility signals: ${(female.match_profile.compatibilitySignals as string[] ?? []).join(', ')}
Relationship intent: ${female.preference_model.relationshipIntent ?? 'not specified'}
Emotional signals she looks for: ${(female.preference_model.emotionalSignals as string[] ?? []).join(', ')}
Lifestyle signals she values: ${(female.preference_model.lifestyleSignals as string[] ?? []).join(', ')}
Maturity signals she values: ${(female.preference_model.maturitySignals as string[] ?? []).join(', ')}

Score this pair 0–100 on overall compatibility. Consider:
1. Emotional alignment (her emotional signals vs his personality/communication)
2. Lifestyle fit (her lifestyle signals vs his verified proof signals)
3. Relationship goal alignment (both sides' stated intent)
4. Archetype compatibility (does his archetype naturally complement hers?)
5. Maturity signal match (her maturity signals vs his archetype/trust band)

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "score": <integer 0-100>,
  "rationale": "<2 sentences explaining the key compatibility or mismatch>",
  "flags": ["<signal 1>", "<signal 2>", "<signal 3>"]
}`;
}

export async function softScore(male: WingmanPoolRow, female: BestiePoolRow): Promise<ScoredPair> {
  const client = getClaudeClient();
  const prompt = buildSoftScorePrompt(male, female);

  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = response.content[0];
    const raw = block.type === 'text' ? block.text.trim() : '{}';
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      maleUserId:   male.user_id,
      femaleUserId: female.user_id,
      score:        Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      rationale:    String(parsed.rationale ?? ''),
      flags:        Array.isArray(parsed.flags) ? parsed.flags : [],
    };
  } catch {
    return {
      maleUserId:   male.user_id,
      femaleUserId: female.user_id,
      score:        50,
      rationale:    'Scoring unavailable — default applied.',
      flags:        [],
    };
  }
}

// ── Dealbreaker soft override ─────────────────────────────────────────────────
// When a user has zero candidates after hard filtering, surface closest-fitting
// profiles ranked by score. Returns best alternatives for that user.

async function softOverrideCandidates(
  userId: string,
  gender: 'man' | 'woman',
  limit = 5
): Promise<Array<{ userId: string; score: number; note: string }>> {
  const db = getSupabase() as any;

  if (gender === 'man') {
    const { data: male } = await db
      .from('vv_pool_wingmen')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!male) return [];

    const { data: females } = await db
      .from('vv_pool_besties')
      .select('*')
      .eq('availability_status', 'active')
      .limit(50);

    if (!females?.length) return [];

    const scored = await Promise.all(
      (females as BestiePoolRow[]).map((f) => softScore(male as WingmanPoolRow, f))
    );

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => ({
        userId: s.femaleUserId,
        score:  s.score,
        note:   'Best available outside your stated preferences — some dealbreakers may apply.',
      }));
  } else {
    const { data: female } = await db
      .from('vv_pool_besties')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!female) return [];

    const { data: males } = await db
      .from('vv_pool_wingmen')
      .select('*')
      .eq('availability_status', 'active')
      .limit(50);

    if (!males?.length) return [];

    const scored = await Promise.all(
      (males as WingmanPoolRow[]).map((m) => softScore(m, female as BestiePoolRow))
    );

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => ({
        userId: s.maleUserId,
        score:  s.score,
        note:   'Best available outside your stated preferences — some dealbreakers may apply.',
      }));
  }
}

// ── Nightly batch ─────────────────────────────────────────────────────────────

export async function runNightlyBatch(cityScoped = false): Promise<void> {
  const db     = getSupabase() as any;
  const runLog = { pairs_evaluated: 0, hard_filtered: 0, soft_scored: 0, matches_fired: 0, soft_overrides: 0 };

  // Log start
  const { data: runRow } = await db
    .from('vv_matchmaker_runs')
    .insert({ run_type: 'nightly', city: cityScoped ? 'scoped' : null, ...runLog })
    .select('id')
    .single();

  const runId = runRow?.id;

  try {
    // Load active pools
    const { data: males }   = await db.from('vv_pool_wingmen').select('*').eq('availability_status', 'active');
    const { data: females } = await db.from('vv_pool_besties').select('*').eq('availability_status', 'active');

    if (!males?.length || !females?.length) {
      await db.from('vv_matchmaker_runs').update({ completed_at: new Date().toISOString(), ...runLog }).eq('id', runId);
      return;
    }

    // Load existing match pairs so we don't re-fire
    const { data: existingMatches } = await db
      .from('verified_vibe_matches')
      .select('user1_id, user2_id');

    const existingSet = new Set<string>(
      (existingMatches ?? []).map((m: any) =>
        [m.user1_id, m.user2_id].sort().join(':')
      )
    );

    const pairs: ScoredPair[] = [];

    for (const male of males as WingmanPoolRow[]) {
      for (const female of females as BestiePoolRow[]) {
        const pairKey = [male.user_id, female.user_id].sort().join(':');
        if (existingSet.has(pairKey)) continue; // already matched

        runLog.pairs_evaluated++;

        if (hardFilter(male, female, cityScoped)) {
          runLog.hard_filtered++;
          continue;
        }

        const scored = await softScore(male, female);
        runLog.soft_scored++;
        pairs.push(scored);
      }
    }

    // Fire matches for pairs scoring >= 70
    const highScoring = pairs.filter((p) => p.score >= 70);
    for (const pair of highScoring) {
      // Insert match
      const { error: matchErr } = await db
        .from('verified_vibe_matches')
        .insert({
          user1_id: pair.maleUserId,
          user2_id: pair.femaleUserId,
          status:   'mutual',
        });

      if (!matchErr) {
        runLog.matches_fired++;
        // Push notifications via existing notification infrastructure
        await Promise.allSettled([
          sendMatchNotification(pair.maleUserId, pair.femaleUserId),
          sendMatchNotification(pair.femaleUserId, pair.maleUserId),
        ]);
      }
    }

    // Soft override: find users who had ZERO non-filtered candidates
    const menWithMatches  = new Set(pairs.map((p) => p.maleUserId));
    const womenWithMatches = new Set(pairs.map((p) => p.femaleUserId));

    for (const male of males as WingmanPoolRow[]) {
      if (!menWithMatches.has(male.user_id)) {
        const overrides = await softOverrideCandidates(male.user_id, 'man');
        if (overrides.length) {
          runLog.soft_overrides++;
          await queueIntelligenceReport(male.user_id, 'pool_competitive', 'cold_push', { softOverride: overrides });
        }
      }
    }

    for (const female of females as BestiePoolRow[]) {
      if (!womenWithMatches.has(female.user_id)) {
        const overrides = await softOverrideCandidates(female.user_id, 'woman');
        if (overrides.length) {
          runLog.soft_overrides++;
          await queueIntelligenceReport(female.user_id, 'female_competitive', 'cold_push', { softOverride: overrides });
        }
      }
    }

    // Check for cold users (last_active_at > 7 days) and queue cold push reports
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: coldUsers } = await db
      .from('verified_vibe_users')
      .select('id, gender')
      .lt('last_active_at', sevenDaysAgo)
      .in('id', [...(males as WingmanPoolRow[]).map((m) => m.user_id), ...(females as BestiePoolRow[]).map((f) => f.user_id)]);

    for (const cu of (coldUsers ?? []) as Array<{ id: string; gender: string }>) {
      const type = cu.gender === 'man' ? 'pool_competitive' : 'female_competitive';
      await queueIntelligenceReport(cu.id, type, 'cold_push');
    }

    // Queue weekly reports for users who haven't had one in 7+ days
    const allPoolUserIds = [
      ...(males as WingmanPoolRow[]).map((m) => m.user_id),
      ...(females as BestiePoolRow[]).map((f) => f.user_id),
    ];
    const { data: recentReports } = await db
      .from('vv_intelligence_reports')
      .select('user_id')
      .gte('requested_at', sevenDaysAgo)
      .in('user_id', allPoolUserIds);

    const recentSet = new Set((recentReports ?? []).map((r: any) => r.user_id));

    for (const uid of allPoolUserIds) {
      if (!recentSet.has(uid)) {
        const user = [...(males as WingmanPoolRow[]), ...(females as BestiePoolRow[])].find((u) => u.user_id === uid);
        if (!user) continue;
        const gender = (males as WingmanPoolRow[]).some((m) => m.user_id === uid) ? 'man' : 'woman';
        const type   = gender === 'man' ? 'pool_competitive' : 'female_competitive';
        await queueIntelligenceReport(uid, type, 'weekly');
      }
    }

    // Mark run complete
    await db
      .from('vv_matchmaker_runs')
      .update({ ...runLog, completed_at: new Date().toISOString() })
      .eq('id', runId);

  } catch (err) {
    await db
      .from('vv_matchmaker_runs')
      .update({ error: String(err), completed_at: new Date().toISOString() })
      .eq('id', runId);
    throw err;
  }
}

// ── On-demand single-user matchmaking (chat "Find Matches" button) ────────────
// Scores ONE user against the opposite-gender active pool and creates a match
// with the single highest-compatibility candidate (>= threshold). AI usage is
// bounded: the free hard filter runs first, survivors are capped, then exactly
// one Claude call per surviving candidate — no loops. Each press consumes one
// lifetime run (charged up-front, regardless of whether a match is found).

const ON_DEMAND_THRESHOLD     = 50; // minimum soft score to create a match
const ON_DEMAND_CANDIDATE_CAP = 50; // max candidates scored per press (bounds Claude calls)

export type FindMatchResult =
  | { status: 'needs_verification' }
  | { status: 'limit_reached'; runsUsed: number; runsLimit: number }
  | { status: 'no_match'; runsUsed: number; runsLimit: number; candidatesEvaluated: number; bestScore: number | null }
  | {
      status: 'matched';
      runsUsed: number;
      runsLimit: number;
      candidatesEvaluated: number;
      match: {
        matchId:   string;
        userId:    string;
        firstName: string;
        age:       number | null;
        avatarUrl: string | null;
        score:     number;
      };
    };

async function logOnDemandRun(db: any, evaluated: number, fired: number): Promise<void> {
  try {
    await db.from('vv_matchmaker_runs').insert({
      run_type:        'on_demand',
      pairs_evaluated: evaluated,
      soft_scored:     evaluated,
      matches_fired:   fired,
      completed_at:    new Date().toISOString(),
    });
  } catch { /* observability only — non-fatal */ }
}

export async function runMatchmakerForUser(userId: string): Promise<FindMatchResult> {
  const db = getSupabase() as any;

  // Load the requesting user + quota.
  const { data: me } = await db
    .from('verified_vibe_users')
    .select('id, gender, matchmaker_runs_used, matchmaker_runs_limit')
    .eq('id', userId)
    .maybeSingle();
  if (!me) return { status: 'needs_verification' };

  const isMan   = me.gender === 'man';
  const isWoman = me.gender === 'woman';
  if (!isMan && !isWoman) return { status: 'needs_verification' }; // no hetero pool side

  const myPoolTable    = isMan ? 'vv_pool_wingmen' : 'vv_pool_besties';
  const otherPoolTable = isMan ? 'vv_pool_besties' : 'vv_pool_wingmen';

  // Eligibility: the user must have an ACTIVE pool entry (fully verified).
  const { data: myPool } = await db
    .from(myPoolTable)
    .select('*')
    .eq('user_id', userId)
    .eq('availability_status', 'active')
    .maybeSingle();
  if (!myPool) return { status: 'needs_verification' };

  // Quota check.
  const runsUsed  = me.matchmaker_runs_used  ?? 0;
  const runsLimit = me.matchmaker_runs_limit ?? 0;
  if (runsUsed >= runsLimit) {
    return { status: 'limit_reached', runsUsed, runsLimit };
  }

  // Charge one run up-front (per-press billing; bounds AI usage even on no-match).
  const newRunsUsed = runsUsed + 1;
  await db.from('verified_vibe_users').update({ matchmaker_runs_used: newRunsUsed }).eq('id', userId);

  // Load opposite-gender active candidates + this user's existing matches.
  const [{ data: candidates }, { data: myMatches }] = await Promise.all([
    db.from(otherPoolTable).select('*').eq('availability_status', 'active'),
    db.from('verified_vibe_matches').select('user1_id, user2_id').or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
  ]);

  const matchedPartnerIds = new Set<string>(
    (myMatches ?? []).map((m: any) => (m.user1_id === userId ? m.user2_id : m.user1_id))
  );

  // Orient each pair correctly for the shared hard filter / soft scorer.
  const asPair = (candidate: any) => ({
    male:   (isMan ? myPool : candidate) as WingmanPoolRow,
    female: (isMan ? candidate : myPool) as BestiePoolRow,
  });

  // Hard filter (free, no AI), then cap to bound Claude calls.
  const survivors = (candidates ?? [])
    .filter((c: any) => c.user_id !== userId && !matchedPartnerIds.has(c.user_id))
    .filter((c: any) => { const { male, female } = asPair(c); return !hardFilter(male, female, false); })
    .slice(0, ON_DEMAND_CANDIDATE_CAP);

  if (!survivors.length) {
    await logOnDemandRun(db, 0, 0);
    return { status: 'no_match', runsUsed: newRunsUsed, runsLimit, candidatesEvaluated: 0, bestScore: null };
  }

  // Soft score each survivor (one Claude call each) and keep the highest.
  const scored = await Promise.all(
    survivors.map(async (c: any) => {
      const { male, female } = asPair(c);
      const s = await softScore(male, female);
      return { candidateId: c.user_id as string, score: s.score };
    })
  );
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  await logOnDemandRun(db, scored.length, best && best.score >= ON_DEMAND_THRESHOLD ? 1 : 0);

  if (!best || best.score < ON_DEMAND_THRESHOLD) {
    return {
      status: 'no_match', runsUsed: newRunsUsed, runsLimit,
      candidatesEvaluated: scored.length, bestScore: best?.score ?? null,
    };
  }

  // Create the match (men stored as user1 to mirror the nightly batch).
  const maleId   = isMan ? userId : best.candidateId;
  const femaleId = isMan ? best.candidateId : userId;

  // Guard against a pre-existing row in either orientation.
  const { data: existing } = await db
    .from('verified_vibe_matches')
    .select('id')
    .or(`and(user1_id.eq.${maleId},user2_id.eq.${femaleId}),and(user1_id.eq.${femaleId},user2_id.eq.${maleId})`)
    .maybeSingle();

  let matchId = existing?.id as string | undefined;
  if (!matchId) {
    const { data: created, error: createErr } = await db
      .from('verified_vibe_matches')
      .insert({ user1_id: maleId, user2_id: femaleId, status: 'mutual' })
      .select('id')
      .single();
    if (createErr || !created) {
      // Couldn't persist the match — surface as no_match (run already charged).
      return {
        status: 'no_match', runsUsed: newRunsUsed, runsLimit,
        candidatesEvaluated: scored.length, bestScore: best.score,
      };
    }
    matchId = created.id;
    await Promise.allSettled([
      sendMatchNotification(maleId, femaleId),
      sendMatchNotification(femaleId, maleId),
    ]);
  }

  // Fetch the matched person's display info for the success popup.
  const { data: partner } = await db
    .from('verified_vibe_users')
    .select('first_name, age, avatar_url')
    .eq('id', best.candidateId)
    .maybeSingle();

  return {
    status: 'matched',
    runsUsed: newRunsUsed,
    runsLimit,
    candidatesEvaluated: scored.length,
    match: {
      matchId:   matchId!,
      userId:    best.candidateId,
      firstName: partner?.first_name ?? 'Your match',
      age:       partner?.age ?? null,
      avatarUrl: partner?.avatar_url ?? null,
      score:     best.score,
    },
  };
}

// ── On-demand: read a user's eligibility + remaining quota (no AI, no charge) ──

export async function getMatchmakerStatus(userId: string): Promise<{
  eligible: boolean;
  runsUsed: number;
  runsLimit: number;
}> {
  const db = getSupabase() as any;

  const { data: me } = await db
    .from('verified_vibe_users')
    .select('gender, matchmaker_runs_used, matchmaker_runs_limit')
    .eq('id', userId)
    .maybeSingle();
  if (!me) return { eligible: false, runsUsed: 0, runsLimit: 0 };

  const poolTable = me.gender === 'man' ? 'vv_pool_wingmen'
                  : me.gender === 'woman' ? 'vv_pool_besties' : null;

  let eligible = false;
  if (poolTable) {
    const { data: poolRow } = await db
      .from(poolTable)
      .select('user_id')
      .eq('user_id', userId)
      .eq('availability_status', 'active')
      .maybeSingle();
    eligible = !!poolRow;
  }

  return {
    eligible,
    runsUsed:  me.matchmaker_runs_used  ?? 0,
    runsLimit: me.matchmaker_runs_limit ?? 0,
  };
}

// ── Queue an intelligence report for async processing ─────────────────────────

export async function queueIntelligenceReport(
  userId:      string,
  reportType:  'pool_competitive' | 'per_match_ranking' | 'female_competitive',
  triggerType: 'user_driven' | 'cold_push' | 'weekly',
  seedData?:   Record<string, unknown>
): Promise<string> {
  const db = getSupabase() as any;

  const { data: row } = await db
    .from('vv_intelligence_reports')
    .insert({
      user_id:      userId,
      report_type:  reportType,
      trigger_type: triggerType,
      status:       'pending',
      payload:      seedData ?? null,
    })
    .select('id')
    .single();

  return row?.id ?? '';
}

// ── Send match push notification (fire-and-forget) ────────────────────────────

async function sendMatchNotification(recipientId: string, matchedUserId: string): Promise<void> {
  try {
    const db = getSupabase() as any;
    const { data: matchedUser } = await db
      .from('verified_vibe_users')
      .select('first_name')
      .eq('id', matchedUserId)
      .single();

    const name = matchedUser?.first_name ?? 'Someone';
    await sendPushNotification(recipientId, {
      title: '✨ New Match on Verified Vibe',
      body:  `${name} and you have been matched. Open Wingman / Bestie for a full brief.`,
      data:  { type: 'new_match', matchedUserId },
    });
  } catch {
    // Non-critical — match is already created even if push fails
  }
}

// ── On-demand: generate per-match fit ranking for male user ───────────────────

export async function generatePerMatchRanking(userId: string): Promise<{
  summary: string;
  matches: Array<{
    matchId:    string;
    firstName:  string;
    rank:       string;   // e.g. "3rd out of 7" or "top 28%"
    gapActions: string[];
  }>;
  actionList: Array<{ priority: number; action: string; impact: string }>;
}> {
  const db = getSupabase() as any;

  // Get the male user's pool entry
  const { data: malePool } = await db
    .from('vv_pool_wingmen')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!malePool) return { summary: 'No pool entry found.', matches: [], actionList: [] };

  // Get his current matches
  const { data: matches } = await db
    .from('verified_vibe_matches')
    .select('id, user1_id, user2_id, status')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq('status', 'mutual');

  if (!matches?.length) return { summary: 'No current matches to rank.', matches: [], actionList: [] };

  const matchResults = [];

  for (const match of matches as Array<{ id: string; user1_id: string; user2_id: string }>) {
    const femaleId = match.user1_id === userId ? match.user2_id : match.user1_id;

    // Get female's pool entry and basic info
    const [{ data: femalePool }, { data: femaleUser }] = await Promise.all([
      db.from('vv_pool_besties').select('*').eq('user_id', femaleId).single(),
      db.from('verified_vibe_users').select('first_name').eq('id', femaleId).single(),
    ]);

    if (!femalePool) continue;

    // Score the pair
    const pairScore = await softScore(malePool as WingmanPoolRow, femalePool as BestiePoolRow);

    // Find all competing males who pass this female's hard filters
    const { data: allMales } = await db
      .from('vv_pool_wingmen')
      .select('*')
      .eq('availability_status', 'active')
      .neq('user_id', userId);

    const competitors = (allMales ?? []).filter(
      (m: WingmanPoolRow) => !hardFilter(m, femalePool as BestiePoolRow, false)
    );

    // Score top 20 competitors (limit for cost)
    const sampleCompetitors = competitors.slice(0, 20);
    const competitorScores = await Promise.all(
      sampleCompetitors.map((m: WingmanPoolRow) => softScore(m, femalePool as BestiePoolRow))
    );

    const allScores = [...competitorScores.map((c) => c.score), pairScore.score].sort((a, b) => b - a);
    const poolSize  = allScores.length;
    const rank      = allScores.indexOf(pairScore.score) + 1;

    // Format rank based on pool size threshold
    const rankStr = poolSize < 500
      ? `${rank}${ordinalSuffix(rank)} out of ${poolSize} men`
      : `top ${Math.ceil((rank / poolSize) * 100)}%`;

    // Generate gap actions via Claude
    const gapActions = await generateGapActions(malePool as WingmanPoolRow, femalePool as BestiePoolRow, rank, poolSize);

    matchResults.push({
      matchId:    match.id,
      firstName:  femaleUser?.first_name ?? 'Your match',
      rank:       rankStr,
      gapActions,
    });
  }

  // Generate overall action list
  const actionList = await generateOverallActionList(malePool as WingmanPoolRow, matchResults);

  const summary = matchResults.length > 0
    ? `You have ${matchResults.length} active match${matchResults.length > 1 ? 'es' : ''}. Here's where you stand and how to move up.`
    : 'Ranking complete.';

  return { summary, matches: matchResults, actionList };
}

// ── On-demand: generate female competitive report ─────────────────────────────

export async function generateFemaleCompetitiveReport(userId: string): Promise<{
  summary: string;
  positioning: string;
  topMenInPool: Array<{ archetype: string; trustBand: string; compatibilityScore: number }>;
  actionList: Array<{ priority: number; action: string; impact: string }>;
}> {
  const db = getSupabase() as any;

  const { data: femalePool } = await db
    .from('vv_pool_besties')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!femalePool) return { summary: 'No pool entry found.', positioning: '', topMenInPool: [], actionList: [] };

  // Get high-value men (trust_score_band 70-84, 85-94, 95+ combined with target archetypes)
  const highValueBands = ['70-84', '85-94', '95+'];
  const { data: highValueMen } = await db
    .from('vv_pool_wingmen')
    .select('*')
    .in('trust_score_band', highValueBands)
    .eq('availability_status', 'active')
    .limit(30);

  if (!highValueMen?.length) return {
    summary: 'No high-value men in the pool yet. The pool is growing — check back soon.',
    positioning: '',
    topMenInPool: [],
    actionList: [],
  };

  // Score against top men
  const scored = await Promise.all(
    (highValueMen as WingmanPoolRow[]).map(async (m) => {
      const eliminated = hardFilter(m, femalePool as BestiePoolRow, false);
      if (eliminated) return null;
      const s = await softScore(m, femalePool as BestiePoolRow);
      return { male: m, score: s };
    })
  );

  const validScores = scored.filter(Boolean) as Array<{ male: WingmanPoolRow; score: ScoredPair }>;
  validScores.sort((a, b) => b.score.score - a.score.score);

  const topMenInPool = validScores.slice(0, 5).map((v) => ({
    archetype:          v.male.archetype,
    trustBand:          v.male.trust_score_band,
    compatibilityScore: v.score.score,
  }));

  // Generate competitive positioning via Claude
  const positioning = await generateFemalePositioning(femalePool as BestiePoolRow, validScores.length, topMenInPool);
  const actionList  = await generateFemaleActionList(femalePool as BestiePoolRow, topMenInPool);

  const avgScore = validScores.length
    ? Math.round(validScores.slice(0, 10).reduce((sum, v) => sum + v.score.score, 0) / Math.min(10, validScores.length))
    : 0;

  return {
    summary: `Your compatibility score against high-value men in the pool averages ${avgScore}/100. Here's how to improve.`,
    positioning,
    topMenInPool,
    actionList,
  };
}

// ── Claude helpers ────────────────────────────────────────────────────────────

async function generateGapActions(
  male: WingmanPoolRow,
  female: BestiePoolRow,
  rank: number,
  total: number
): Promise<string[]> {
  const client = getClaudeClient();
  const prompt = `A man ranked ${rank} out of ${total} men for a specific female match on a verified dating platform.

His current signals:
- Archetype: ${male.archetype}
- Trust band: ${male.trust_score_band}
- Proof categories uploaded: ${(male.match_profile.proofCategories as string[] ?? []).join(', ') || 'none'}
- Personality: ${(male.match_profile.personalityDescriptors as string[] ?? []).join(', ')}

What she values:
- Emotional signals: ${(female.preference_model.emotionalSignals as string[] ?? []).join(', ')}
- Lifestyle signals: ${(female.preference_model.lifestyleSignals as string[] ?? []).join(', ')}
- Maturity signals: ${(female.preference_model.maturitySignals as string[] ?? []).join(', ')}

List exactly 3 specific actions he can take RIGHT NOW to improve his ranking for this match.
Respond ONLY with a JSON array of 3 strings (no markdown, no code fences):
["action 1", "action 2", "action 3"]`;

  try {
    const res = await client.messages.create({ model: CLAUDE_MODEL, max_tokens: 200, messages: [{ role: 'user', content: prompt }] });
    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '[]';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    return [];
  }
}

async function generateOverallActionList(
  male: WingmanPoolRow,
  matchResults: Array<{ firstName: string; rank: string }>
): Promise<Array<{ priority: number; action: string; impact: string }>> {
  const client = getClaudeClient();
  const matchSummary = matchResults.map((m) => `${m.firstName}: ${m.rank}`).join('; ');

  const prompt = `A man on a verified dating platform has these current rankings across his matches: ${matchSummary}.

His profile:
- Archetype: ${male.archetype}
- Trust band: ${male.trust_score_band}
- Proof categories: ${(male.match_profile.proofCategories as string[] ?? []).join(', ') || 'none'}

Generate a prioritised action list (top 3) to improve his overall position across all matches.
Respond ONLY with valid JSON (no markdown, no code fences):
[{"priority":1,"action":"...","impact":"..."},{"priority":2,"action":"...","impact":"..."},{"priority":3,"action":"...","impact":"..."}]`;

  try {
    const res = await client.messages.create({ model: CLAUDE_MODEL, max_tokens: 300, messages: [{ role: 'user', content: prompt }] });
    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '[]';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

async function generateFemalePositioning(
  female: BestiePoolRow,
  compatibleMenCount: number,
  topMen: Array<{ archetype: string; trustBand: string; compatibilityScore: number }>
): Promise<string> {
  const client = getClaudeClient();
  const topArchetypes = topMen.map((m) => m.archetype).join(', ');

  const prompt = `A woman on a verified dating platform is compatible with ${compatibleMenCount} high-value men.
Her archetype: ${female.archetype}
Her compatibility signals: ${(female.match_profile.compatibilitySignals as string[] ?? []).join(', ')}
Top matching male archetypes: ${topArchetypes}

Write a 2-sentence positioning statement for her — where she stands in the market and her strongest competitive advantage.
Plain text only, no formatting.`;

  try {
    const res = await client.messages.create({ model: CLAUDE_MODEL, max_tokens: 150, messages: [{ role: 'user', content: prompt }] });
    return res.content[0].type === 'text' ? res.content[0].text.trim() : '';
  } catch {
    return '';
  }
}

async function generateFemaleActionList(
  female: BestiePoolRow,
  topMen: Array<{ archetype: string; trustBand: string; compatibilityScore: number }>
): Promise<Array<{ priority: number; action: string; impact: string }>> {
  const client = getClaudeClient();
  const avgScore = topMen.length
    ? Math.round(topMen.reduce((s, m) => s + m.compatibilityScore, 0) / topMen.length)
    : 0;

  const prompt = `A woman on a verified dating platform. Average compatibility score with high-value men: ${avgScore}/100.

Her profile:
- Archetype: ${female.archetype}
- What she values: ${(female.match_profile.whatSheValues as string[] ?? []).join(', ')}
- Proof categories uploaded: ${(female.match_profile.proofCategories as string[] ?? []).join(', ') || 'none'}

Emotional signals she communicates: ${(female.preference_model.emotionalSignals as string[] ?? []).join(', ')}

Generate top 3 actions she can take to improve her compatibility score and attract higher-value matches.
Respond ONLY with valid JSON (no markdown, no code fences):
[{"priority":1,"action":"...","impact":"..."},{"priority":2,"action":"...","impact":"..."},{"priority":3,"action":"...","impact":"..."}]`;

  try {
    const res = await client.messages.create({ model: CLAUDE_MODEL, max_tokens: 300, messages: [{ role: 'user', content: prompt }] });
    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '[]';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
