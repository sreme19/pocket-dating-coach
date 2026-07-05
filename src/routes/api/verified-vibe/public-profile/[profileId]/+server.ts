import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { ARCHETYPES } from '$lib/verified-vibe/constants';
import { sanitizeAboutForDetail, isAbusiveName, isAbusiveCity, cleanChipList } from '$lib/server/profile-moderation';
import { buildPublicPhotos, pickHeroUrl } from '$lib/server/profile-photos';

function snakeToTitle(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function deriveTraitScores(personality: Record<string, unknown> | null, archetype: string) {
  const allText = [
    personality?.communicationStyle ?? '',
    personality?.personalityVibe ?? '',
    personality?.mattersMost ?? '',
    ...(Array.isArray(personality?.values) ? (personality.values as string[]) : []),
    ...(Array.isArray(personality?.datingPatterns) ? (personality.datingPatterns as string[]) : []),
  ].join(' ').toLowerCase();

  function score(keywords: string[], antiKeywords: string[] = []): number {
    const pos = keywords.filter((k) => allText.includes(k)).length;
    const neg = antiKeywords.filter((k) => allText.includes(k)).length;
    return Math.min(100, Math.max(0, 50 + pos * 15 - neg * 15));
  }

  const base: Record<string, { dec: number; warm: number; open: number; pace: number }> = {
    // Male archetypes
    casual_generous_man:      { dec: 80, warm: 65, open: 70, pace: 75 },
    hopeless_romantic_man:    { dec: 62, warm: 90, open: 75, pace: 55 },
    rebound_healing_man:      { dec: 55, warm: 70, open: 65, pace: 50 },
    untouched_heart_man:      { dec: 60, warm: 75, open: 80, pace: 60 },
    forever_focused_man:      { dec: 75, warm: 80, open: 60, pace: 55 },
    traditional_matrimony_man:{ dec: 80, warm: 75, open: 50, pace: 50 },
    second_chapter_man:       { dec: 78, warm: 75, open: 65, pace: 50 },
    just_friends_man:         { dec: 55, warm: 70, open: 80, pace: 65 },
    // Female archetypes
    spoiled_casual_woman:         { dec: 70, warm: 60, open: 70, pace: 65 },
    hopeless_romantic_woman:      { dec: 60, warm: 90, open: 70, pace: 55 },
    rebound_healing_woman:        { dec: 55, warm: 70, open: 65, pace: 50 },
    untouched_heart_woman:        { dec: 60, warm: 75, open: 82, pace: 60 },
    forever_focused_woman:        { dec: 75, warm: 82, open: 58, pace: 52 },
    traditional_matrimony_woman:  { dec: 78, warm: 78, open: 48, pace: 48 },
    second_chapter_woman:         { dec: 78, warm: 75, open: 65, pace: 50 },
    just_friends_woman:           { dec: 55, warm: 72, open: 80, pace: 65 },
  };
  const b = base[archetype] ?? { dec: 65, warm: 70, open: 65, pace: 60 };

  const dec  = Math.min(100, Math.max(10, b.dec  + score(['direct','decisive','clear','assertive','confident','takes charge','straightforward']) - 50));
  const warm = Math.min(100, Math.max(10, b.warm + score(['warm','caring','generous','emotional','empathetic','loving','affectionate']) - 50));
  const open = Math.min(100, Math.max(10, b.open + score(['open','curious','adventurous','flexible','creative','spontaneous'], ['rigid','traditional only']) - 50));
  const pace = Math.min(100, Math.max(10, b.pace + score(['busy','driven','ambitious','hustle','goal-oriented','fast-paced'], ['patient','relaxed','slow']) - 50));

  return { decisiveness: dec, warmth: warm, openness: open, pace };
}

// Mirror of ARCHETYPE_BRINGS from the owner profile page (emoji + text)
const ARCHETYPE_BRINGS: Record<string, Array<{ emoji: string; text: string }>> = {
  casual_man: [
    { emoji: '✌️', text: 'Easy energy' }, { emoji: '🤝', text: 'Honest intentions' },
    { emoji: '💬', text: 'Good conversation' }, { emoji: '🌱', text: 'Low pressure' }, { emoji: '⏱️', text: 'Quality time' },
  ],
  casual_generous_man: [
    { emoji: '💰', text: 'Financial stability' }, { emoji: '🍾', text: 'Generosity on dates' },
    { emoji: '🗓️', text: 'Time he actually gives you' }, { emoji: '🔒', text: 'Privacy & discretion' }, { emoji: '💭', text: 'Real opinions, gently held' },
  ],
  forever_focused_man: [
    { emoji: '💙', text: 'Emotional depth' }, { emoji: '🎯', text: 'Long-term clarity' },
    { emoji: '🌿', text: 'Shared values' }, { emoji: '🏠', text: 'Consistent presence' }, { emoji: '💍', text: 'Real commitment' },
  ],
  hopeless_romantic_man: [
    { emoji: '🌹', text: 'Romantic thoughtfulness' }, { emoji: '💕', text: 'Emotional availability' },
    { emoji: '🌊', text: 'Deep connection' }, { emoji: '⚡', text: 'All-in energy' }, { emoji: '🎁', text: 'Genuine gestures' },
  ],
  traditional_matrimony_man: [
    { emoji: '👨‍👩‍👧', text: 'Family values' }, { emoji: '🏡', text: 'Stability' },
    { emoji: '🌺', text: 'Cultural alignment' }, { emoji: '🗺️', text: 'Clear life plan' }, { emoji: '🤲', text: 'Lifelong respect' },
  ],
  second_chapter_man: [
    { emoji: '🧠', text: 'Hard-earned wisdom' }, { emoji: '🌿', text: 'Emotional maturity' },
    { emoji: '🎯', text: 'Clarity on what he wants' }, { emoji: '⚓', text: 'Grounded presence' }, { emoji: '🤝', text: 'Real partnership' },
  ],
  untouched_heart_man: [
    { emoji: '✨', text: 'Authenticity' }, { emoji: '👁️', text: 'Fresh perspective' },
    { emoji: '💚', text: 'Open heart' }, { emoji: '🔍', text: 'Curiosity' }, { emoji: '🕊️', text: 'No baggage' },
  ],
  just_friends_man: [
    { emoji: '😊', text: 'Good company' }, { emoji: '🌬️', text: 'Zero pressure' },
    { emoji: '💬', text: 'Easy conversation' }, { emoji: '🤗', text: 'Genuine connection' }, { emoji: '⚡', text: 'Consistent energy' },
  ],
  rebound_healing_man: [
    { emoji: '🤝', text: 'Honest intentions' }, { emoji: '🌸', text: 'Light touch' },
    { emoji: '✨', text: 'Fun energy' }, { emoji: '🧘', text: 'Present focus' }, { emoji: '📸', text: 'Real moments' },
  ],
  // ── Female archetypes ──────────────────────────────────────────────────────
  spoiled_casual_woman: [
    { emoji: '✨', text: 'High standards' }, { emoji: '💅', text: 'Effortless charm' },
    { emoji: '😄', text: 'Fun energy' }, { emoji: '🎯', text: 'Knows what she wants' }, { emoji: '💬', text: 'Honest vibes' },
  ],
  hopeless_romantic_woman: [
    { emoji: '🌹', text: 'Deep affection' }, { emoji: '💕', text: 'Emotional warmth' },
    { emoji: '🎁', text: 'Thoughtful gestures' }, { emoji: '🌊', text: 'All-in energy' }, { emoji: '✨', text: 'Magic in small moments' },
  ],
  rebound_healing_woman: [
    { emoji: '🌿', text: 'Growth mindset' }, { emoji: '🧘', text: 'Emotional awareness' },
    { emoji: '💬', text: 'Honest communication' }, { emoji: '🌸', text: 'Gentle energy' }, { emoji: '🤝', text: 'Real intentions' },
  ],
  untouched_heart_woman: [
    { emoji: '🌸', text: 'Pure heart' }, { emoji: '👁️', text: 'Fresh perspective' },
    { emoji: '💚', text: 'Openness' }, { emoji: '🕊️', text: 'No baggage' }, { emoji: '✨', text: 'Genuine curiosity' },
  ],
  forever_focused_woman: [
    { emoji: '💍', text: 'Clarity on commitment' }, { emoji: '🏡', text: 'Family vision' },
    { emoji: '💙', text: 'Emotional depth' }, { emoji: '🌿', text: 'Shared values' }, { emoji: '🎯', text: 'Long-term focus' },
  ],
  traditional_matrimony_woman: [
    { emoji: '🏛️', text: 'Family-first values' }, { emoji: '🤝', text: 'Cultural alignment' },
    { emoji: '💍', text: 'Commitment with zero ambiguity' }, { emoji: '📋', text: 'Clear expectations upfront' }, { emoji: '🏠', text: 'Stability & long-term partnership' },
  ],
  second_chapter_woman: [
    { emoji: '🌺', text: 'Emotional maturity' }, { emoji: '🎯', text: 'Clarity on what she needs' },
    { emoji: '💬', text: 'No games — only real' }, { emoji: '💚', text: 'Appreciation without desperation' }, { emoji: '💪', text: 'Strength that comes from having survived' },
  ],
  just_friends_woman: [
    { emoji: '🫂', text: 'Zero pressure or hidden agenda' }, { emoji: '☀️', text: 'Warm, genuine company' },
    { emoji: '🛡️', text: 'Emotional safety' }, { emoji: '💬', text: 'Real conversation' }, { emoji: '🌱', text: 'Friendship that actually sticks' },
  ],
};
const DEFAULT_BRINGS = [
  { emoji: '⚡', text: 'Good energy' }, { emoji: '🤝', text: 'Honest intentions' },
  { emoji: '💬', text: 'Genuine connection' }, { emoji: '🌿', text: 'Respect' }, { emoji: '🕰️', text: 'Presence' },
];

const INCOME_MAP: Record<string, string> = {
  under_25l: 'Under ₹25L', '25l_50l': '₹25L – ₹50L', '50l_1cr': '₹50L – ₹1Cr',
  '1cr_3cr': '₹1Cr – ₹3Cr', '3cr_10cr': '₹3Cr – ₹10Cr', '10cr_plus': '₹10Cr+',
};

export const GET: RequestHandler = async ({ params }) => {
  try {
    const profileId = params.profileId;
    if (!profileId) return json({ error: 'Profile ID required' }, { status: 400 });

    const supabase = getSupabase();
    const db = supabase as any;

    const [profileRes, masterRes, verificationRes, personalityRes] = await Promise.all([
      db.from('verified_vibe_users')
        .select('id, first_name, age, city, avatar_url, about, looking, trust_score, archetype, gender')
        .eq('id', profileId).single(),
      db.from('user_master_profile').select('data').eq('user_id', profileId).maybeSingle(),
      db.from('verified_vibe_verification').select('step, status').eq('user_id', profileId),
      db.from('verified_vibe_ai_profiles').select('data').eq('user_id', profileId).eq('profile_type', 'personality').maybeSingle(),
    ]);

    if (profileRes.error || !profileRes.data) return json({ error: 'Profile not found' }, { status: 404 });
    const profile = profileRes.data;

    const archetype: string = profile.archetype ?? 'casual_man';
    const archetypeDef = ARCHETYPES[archetype];

    // Live trust score
    const completedSteps = (verificationRes.data ?? []).filter((s: any) => s.status === 'completed');
    const coreSteps = ['id', 'liveness', 'photos', 'spending_or_qa'];
    const proofCount = completedSteps.filter((s: any) => s.step.startsWith('proof_')).length;
    const coreCount = completedSteps.filter((s: any) => coreSteps.includes(s.step)).length;
    const trustScore = Math.min(100, coreCount * 20 + proofCount * 4) || (profile.trust_score ?? 0);

    // Title-case name (fall back when the stored name is symbol/digit garbage)
    const rawName: string = isAbusiveName(profile.first_name) ? 'Member' : (profile.first_name ?? 'User');
    const firstName = rawName === rawName.toUpperCase()
      ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase()
      : rawName;

    const masterData = (masterRes?.data?.data as Record<string, unknown>) ?? {};
    const generatedProfile = (masterData.generatedProfile as Record<string, unknown>) ?? {};
    const onboarding = (masterData.onboarding as Record<string, unknown>) ?? {};
    const verifiedProofs: Array<Record<string, unknown>> = Array.isArray(masterData.verifiedProofs)
      ? masterData.verifiedProofs as Array<Record<string, unknown>> : [];
    // Cross-section signals: insights inferred from a DIFFERENT upload than the
    // section they enrich (e.g. a passport stamp seen in a Lifestyle photo →
    // Travel). Keyed by target section; each carries `from` (source category) so
    // we can render it as inferred rather than directly verified.
    const crossSignals: Record<string, Array<Record<string, unknown>>> =
      (typeof masterData.crossSignals === 'object' && masterData.crossSignals)
        ? masterData.crossSignals as Record<string, Array<Record<string, unknown>>> : {};
    const crossFor = (section: string): Array<Record<string, unknown>> =>
      Array.isArray(crossSignals[section]) ? crossSignals[section] : [];

    const about: string | null = sanitizeAboutForDetail(
      (typeof generatedProfile.about === 'string' ? generatedProfile.about : null) ?? profile.about ?? null
    );
    const hereFor: string = (typeof generatedProfile.intentStatement === 'string' ? generatedProfile.intentStatement : null)
      ?? profile.looking ?? archetypeDef?.tag ?? 'A real connection';
    const vibeWords: string[] = cleanChipList(generatedProfile.personalityDescriptors)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1));

    const whatBrings = ARCHETYPE_BRINGS[archetype] ?? DEFAULT_BRINGS;

    // Archetype chip groups
    const archetypeKey = `vv_${archetype.replace(/_man$|_woman$/, '')}_profile`;
    const archetypeProfile = (onboarding[archetypeKey] as Record<string, unknown>) ?? {};
    const archetypePrefs = (onboarding[archetypeKey.replace('_profile', '_preferences')] as Record<string, unknown>) ?? {};
    const archetypeChips: Array<{ label: string; chips: string[] }> = [];
    const energyRaw = archetypeProfile.relationship_energy ?? archetypeProfile.energy;
    if (Array.isArray(energyRaw) && energyRaw.length) archetypeChips.push({ label: 'Energy in a relationship', chips: cleanChipList(energyRaw.map(snakeToTitle)) });
    const expRaw = archetypeProfile.shared_experiences ?? archetypeProfile.experiences;
    if (Array.isArray(expRaw) && expRaw.length) archetypeChips.push({ label: 'Experiences to share', chips: cleanChipList(expRaw.map(snakeToTitle)) });
    const chemRaw = archetypeProfile.chemistry_preferences ?? archetypeProfile.chemistry;
    if (Array.isArray(chemRaw) && chemRaw.length) archetypeChips.push({ label: 'Chemistry', chips: cleanChipList(chemRaw.map(snakeToTitle)) });
    const lifestyleRaw = archetypePrefs.lifestyle_profile;
    if (lifestyleRaw) archetypeChips.push({ label: 'My lifestyle', chips: [snakeToTitle(String(lifestyleRaw))] });

    // Verified signals grouped: career / lifestyle / health / social
    const proofByCategory = (cat: string) => verifiedProofs.find(p => p.category === cat) ?? null;
    function signalGroup(cat: string, key: string, label: string, icon: string) {
      const p = proofByCategory(cat);
      const direct = (p && Array.isArray(p.insights))
        ? (p.insights as Array<{ emoji: string; label: string }>).map(i => ({ ...i, inferred: false }))
        : [];
      // Append cross-signals targeting this section, deduped against direct insights by label.
      const directLabels = new Set(direct.map(i => i.label));
      const inferred = crossFor(key)
        .filter(s => typeof s.label === 'string' && !directLabels.has(s.label as string))
        .map(s => ({ emoji: s.emoji as string, label: s.label as string, inferred: true, from: s.from as string }));
      const insights = [...direct, ...inferred];
      if (!insights.length) return null;
      return { key, label, icon, insights, aggregated: (p && typeof p.aggregated === 'string') ? p.aggregated : '' };
    }
    const verifiedSignals = [
      signalGroup('linkedin', 'career', 'Career', '💼'),
      signalGroup('lifestyle', 'lifestyle', 'Lifestyle', '🌍'),
      signalGroup('discipline', 'health', 'Health', '💪'),
      signalGroup('social_proof', 'social', 'Social', '🤝'),
    ].filter(Boolean);

    // Travel — union of every proof's locations PLUS any travel cross-signals.
    const crossTravelLocations = crossFor('travel')
      .flatMap(s => Array.isArray(s.locations) ? s.locations as string[] : []);
    const travelLocations = Array.from(new Set([
      ...verifiedProofs.flatMap(p => Array.isArray(p.locations) ? p.locations as string[] : []),
      ...crossTravelLocations,
    ])).filter(Boolean);

    // Garage — only surface owned cars whose ownership was verified (any tier
    // except 'unrelated', which never earns trust and shouldn't be shown).
    const assetsProof = (proofByCategory('assets') as any)?.ownershipTier === 'unrelated'
      ? null
      : proofByCategory('assets');
    const garageCars: Array<{ make: string; model: string; year?: string; color?: string; vehicleType?: string; inferred?: boolean; from?: string }> =
      Array.isArray(assetsProof?.assets)
        ? (assetsProof!.assets as Array<Record<string, string>>)
            .filter(a => a.type === 'car' && a.make)
            .map(a => ({ make: a.make, model: a.model ?? '', year: a.year, color: a.color, vehicleType: a.vehicleType }))
        : [];
    // Fallback: derive a single car from an assets insight label like "MG Comet EV Owner"
    if (garageCars.length === 0 && assetsProof) {
      const carInsight = (assetsProof.insights as Array<{ label: string }> ?? []).find(i => /owner|drives|car|ev\b/i.test(i.label));
      if (carInsight) {
        const label = carInsight.label.replace(/\s*owner$/i, '').trim();
        const parts = label.split(' ');
        garageCars.push({ make: parts[0] ?? label, model: parts.slice(1).join(' ') });
      }
    }
    // Cross-signal garage cars (a vehicle seen in a non-assets upload), marked inferred.
    const garageMakes = new Set(garageCars.map(c => `${c.make} ${c.model}`.trim().toLowerCase()));
    for (const sig of crossFor('garage')) {
      const cars = Array.isArray(sig.assets) ? sig.assets as Array<Record<string, string>> : [];
      for (const a of cars) {
        if (a.type !== 'car' || !a.make) continue;
        const key = `${a.make} ${a.model ?? ''}`.trim().toLowerCase();
        if (garageMakes.has(key)) continue;
        garageMakes.add(key);
        garageCars.push({ make: a.make, model: a.model ?? '', year: a.year, color: a.color, vehicleType: a.vehicleType, inferred: true, from: sig.from as string });
      }
    }

    // Money Matters
    const wealthProof = proofByCategory('wealth');
    const careerProof = proofByCategory('linkedin');
    // Primary: self-reported income saved in master profile
    const savedMoneyMatters = (masterData.moneyMatters as Record<string, unknown>) ?? {};
    const savedIncome = typeof savedMoneyMatters.annualIncome === 'string' && savedMoneyMatters.annualIncome.trim()
      ? savedMoneyMatters.annualIncome.trim() : null;
    const savedNetWorth = typeof savedMoneyMatters.netWorth === 'string' && savedMoneyMatters.netWorth.trim()
      ? savedMoneyMatters.netWorth.trim() : null;
    // Fallback: income_range from casual generous onboarding QA
    const casualPrefs = (onboarding['vv_casual_generous_preferences'] as Record<string, unknown>) ?? {};
    const incomeCode = typeof casualPrefs.income_range === 'string' ? casualPrefs.income_range : null;
    const incomeFromQa = incomeCode ? (INCOME_MAP[incomeCode] ?? incomeCode) : null;
    const annualIncome = savedIncome ?? incomeFromQa;
    const netWorth = savedNetWorth ?? null;
    // Cross-signal money insights (luxury spend seen in a non-wealth upload), marked inferred.
    const crossMoney = crossFor('money');
    const crossWealthInsights = crossMoney.map(s => ({ emoji: s.emoji as string, label: s.label as string, inferred: true, from: s.from as string }));
    const crossSpending = crossMoney.flatMap(s => Array.isArray(s.spendingBreakdown) ? s.spendingBreakdown as unknown[] : []);
    const moneyMatters = (wealthProof || annualIncome || netWorth || careerProof || crossMoney.length) ? {
      annualIncome,
      netWorth,
      careerLines: careerProof ? (careerProof.insights as Array<{ emoji: string; label: string }> ?? []).slice(0, 2) : [],
      wealthInsights: [
        ...(wealthProof ? (wealthProof.insights as Array<{ emoji: string; label: string }> ?? []).map(i => ({ ...i, inferred: false })) : []),
        ...crossWealthInsights,
      ],
      spendingBreakdown: [
        ...(wealthProof && Array.isArray(wealthProof.spendingBreakdown) ? wealthProof.spendingBreakdown as unknown[] : []),
        ...crossSpending,
      ],
    } : null;

    // AI portraits
    const personalityPortraitUrl = typeof masterData.personalityPortraitUrl === 'string' ? masterData.personalityPortraitUrl : null;
    const garagePortraitUrl = typeof masterData.garagePortraitUrl === 'string' ? masterData.garagePortraitUrl : null;

    // Profile photo set — gender-aware (men: AI-only; women: real), hero-first,
    // capped, AI-flagged. Hero never falls back to a man's raw avatar_url.
    const photos = buildPublicPhotos(masterData, profile.gender);
    const heroUrl = pickHeroUrl(photos, profile.gender, profile.avatar_url);
    const heroIsAi = photos[0]?.ai ?? false;

    // Personality trait scores
    const personalityData = (personalityRes?.data?.data as Record<string, unknown>) ?? null;
    const traitScores = deriveTraitScores(personalityData, archetype);

    return json({
      data: {
        id: profile.id, firstName, age: profile.age, city: isAbusiveCity(profile.city) ? null : profile.city,
        avatar: heroUrl, photos, heroIsAi, gender: profile.gender, trustScore,
        archetype, archetypeName: archetypeDef?.name ?? archetype, archetypeEmoji: archetypeDef?.emoji ?? '✨',
        hereFor, about, vibeWords, whatBrings, archetypeChips,
        verifiedSignals, travelLocations, garageCars, moneyMatters,
        personalityPortraitUrl, garagePortraitUrl, traitScores,
      },
    });
  } catch (err) {
    console.error('public-profile error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
