import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { ARCHETYPES } from '$lib/verified-vibe/constants';

function snakeToTitle(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

    const [profileRes, masterRes, verificationRes] = await Promise.all([
      db.from('verified_vibe_users')
        .select('id, first_name, age, city, avatar_url, about, looking, trust_score, archetype, gender')
        .eq('id', profileId).single(),
      db.from('user_master_profile').select('data').eq('user_id', profileId).maybeSingle(),
      db.from('verified_vibe_verification').select('step, status').eq('user_id', profileId),
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

    // Title-case name
    const rawName: string = profile.first_name ?? 'User';
    const firstName = rawName === rawName.toUpperCase()
      ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase()
      : rawName;

    const masterData = (masterRes?.data?.data as Record<string, unknown>) ?? {};
    const generatedProfile = (masterData.generatedProfile as Record<string, unknown>) ?? {};
    const onboarding = (masterData.onboarding as Record<string, unknown>) ?? {};
    const verifiedProofs: Array<Record<string, unknown>> = Array.isArray(masterData.verifiedProofs)
      ? masterData.verifiedProofs as Array<Record<string, unknown>> : [];

    const about: string | null = (typeof generatedProfile.about === 'string' ? generatedProfile.about : null) ?? profile.about ?? null;
    const hereFor: string = (typeof generatedProfile.intentStatement === 'string' ? generatedProfile.intentStatement : null)
      ?? profile.looking ?? archetypeDef?.tag ?? 'A real connection';
    const vibeWords: string[] = Array.isArray(generatedProfile.personalityDescriptors)
      ? (generatedProfile.personalityDescriptors as string[]).map(w => w.charAt(0).toUpperCase() + w.slice(1)) : [];

    const whatBrings = ARCHETYPE_BRINGS[archetype] ?? DEFAULT_BRINGS;

    // Archetype chip groups
    const archetypeKey = `vv_${archetype.replace(/_man$|_woman$/, '')}_profile`;
    const archetypeProfile = (onboarding[archetypeKey] as Record<string, unknown>) ?? {};
    const archetypePrefs = (onboarding[archetypeKey.replace('_profile', '_preferences')] as Record<string, unknown>) ?? {};
    const archetypeChips: Array<{ label: string; chips: string[] }> = [];
    const energyRaw = archetypeProfile.relationship_energy ?? archetypeProfile.energy;
    if (Array.isArray(energyRaw) && energyRaw.length) archetypeChips.push({ label: 'Energy in a relationship', chips: energyRaw.map(snakeToTitle) });
    const expRaw = archetypeProfile.shared_experiences ?? archetypeProfile.experiences;
    if (Array.isArray(expRaw) && expRaw.length) archetypeChips.push({ label: 'Experiences to share', chips: expRaw.map(snakeToTitle) });
    const chemRaw = archetypeProfile.chemistry_preferences ?? archetypeProfile.chemistry;
    if (Array.isArray(chemRaw) && chemRaw.length) archetypeChips.push({ label: 'Chemistry', chips: chemRaw.map(snakeToTitle) });
    const lifestyleRaw = archetypePrefs.lifestyle_profile;
    if (lifestyleRaw) archetypeChips.push({ label: 'My lifestyle', chips: [snakeToTitle(String(lifestyleRaw))] });

    // Verified signals grouped: career / lifestyle / health / social
    const proofByCategory = (cat: string) => verifiedProofs.find(p => p.category === cat) ?? null;
    function signalGroup(cat: string, key: string, label: string, icon: string) {
      const p = proofByCategory(cat);
      if (!p || !Array.isArray(p.insights) || !p.insights.length) return null;
      return { key, label, icon, insights: p.insights as Array<{ emoji: string; label: string }>, aggregated: typeof p.aggregated === 'string' ? p.aggregated : '' };
    }
    const verifiedSignals = [
      signalGroup('linkedin', 'career', 'Career', '💼'),
      signalGroup('lifestyle', 'lifestyle', 'Lifestyle', '🌍'),
      signalGroup('discipline', 'health', 'Health', '💪'),
      signalGroup('social_proof', 'social', 'Social', '🤝'),
    ].filter(Boolean);

    // Travel
    const travelLocations = Array.from(new Set(
      verifiedProofs.flatMap(p => Array.isArray(p.locations) ? p.locations as string[] : [])
    )).filter(Boolean);

    // Garage
    const assetsProof = proofByCategory('assets');
    const garageCars: Array<{ make: string; model: string; year?: string; color?: string; vehicleType?: string }> =
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

    // Money Matters
    const wealthProof = proofByCategory('wealth');
    const careerProof = proofByCategory('linkedin');
    const casualPrefs = (onboarding['vv_casual_generous_preferences'] as Record<string, unknown>) ?? {};
    const incomeCode = typeof casualPrefs.income_range === 'string' ? casualPrefs.income_range : null;
    const annualIncome = incomeCode ? (INCOME_MAP[incomeCode] ?? incomeCode) : null;
    const moneyMatters = (wealthProof || annualIncome) ? {
      annualIncome,
      careerLines: careerProof ? (careerProof.insights as Array<{ emoji: string; label: string }> ?? []).slice(0, 2) : [],
      wealthInsights: wealthProof ? (wealthProof.insights as Array<{ emoji: string; label: string }> ?? []) : [],
    } : null;

    // AI portraits
    const personalityPortraitUrl = typeof masterData.personalityPortraitUrl === 'string' ? masterData.personalityPortraitUrl : null;
    const garagePortraitUrl = typeof masterData.garagePortraitUrl === 'string' ? masterData.garagePortraitUrl : null;

    return json({
      data: {
        id: profile.id, firstName, age: profile.age, city: profile.city,
        avatar: profile.avatar_url, gender: profile.gender, trustScore,
        archetype, archetypeName: archetypeDef?.name ?? archetype, archetypeEmoji: archetypeDef?.emoji ?? '✨',
        hereFor, about, vibeWords, whatBrings, archetypeChips,
        verifiedSignals, travelLocations, garageCars, moneyMatters,
        personalityPortraitUrl, garagePortraitUrl,
      },
    });
  } catch (err) {
    console.error('public-profile error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
