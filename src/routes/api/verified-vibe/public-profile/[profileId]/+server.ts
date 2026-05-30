import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { ARCHETYPES } from '$lib/verified-vibe/constants';

function snakeToTitle(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

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

    // Live trust score from verification steps
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

    // Master profile blob
    const masterData = (masterRes?.data?.data as Record<string, unknown>) ?? {};
    const generatedProfile = (masterData.generatedProfile as Record<string, unknown>) ?? {};
    const onboarding = (masterData.onboarding as Record<string, unknown>) ?? {};
    const verifiedProofs: Array<Record<string, unknown>> = Array.isArray(masterData.verifiedProofs)
      ? masterData.verifiedProofs as Array<Record<string, unknown>>
      : [];

    // About + intent
    const about: string | null = (typeof generatedProfile.about === 'string' ? generatedProfile.about : null) ?? profile.about ?? null;
    const hereFor: string = (typeof generatedProfile.intentStatement === 'string' ? generatedProfile.intentStatement : null)
      ?? profile.looking ?? archetypeDef?.tag ?? 'A real connection';

    // Vibe words
    const vibeWords: string[] = Array.isArray(generatedProfile.personalityDescriptors)
      ? (generatedProfile.personalityDescriptors as string[]).map(w => w.charAt(0).toUpperCase() + w.slice(1))
      : [];

    // What He/She Brings
    const brings: string[] = archetypeDef?.brings ?? [];

    // Archetype chip groups
    const archetypeKey = `vv_${archetype.replace(/_man$|_woman$/, '')}_profile`;
    const archetypeProfile = (onboarding[archetypeKey] as Record<string, unknown>) ?? {};
    const archetypePrefsKey = archetypeKey.replace('_profile', '_preferences');
    const archetypePrefs = (onboarding[archetypePrefsKey] as Record<string, unknown>) ?? {};
    const archetypeChips: Array<{ label: string; chips: string[] }> = [];
    const energyRaw = archetypeProfile.relationship_energy ?? archetypeProfile.energy;
    if (Array.isArray(energyRaw) && energyRaw.length) archetypeChips.push({ label: 'Energy in a relationship', chips: energyRaw.map(snakeToTitle) });
    const expRaw = archetypeProfile.shared_experiences ?? archetypeProfile.experiences;
    if (Array.isArray(expRaw) && expRaw.length) archetypeChips.push({ label: 'Experiences to share', chips: expRaw.map(snakeToTitle) });
    const chemRaw = archetypeProfile.chemistry_preferences ?? archetypeProfile.chemistry;
    if (Array.isArray(chemRaw) && chemRaw.length) archetypeChips.push({ label: 'Chemistry', chips: chemRaw.map(snakeToTitle) });
    const lifestyleRaw = archetypePrefs.lifestyle_profile;
    if (lifestyleRaw) archetypeChips.push({ label: 'My lifestyle', chips: [snakeToTitle(String(lifestyleRaw))] });

    // Verified signals grouped by category
    const signalGroups: Record<string, Array<{ emoji: string; label: string }>> = {};
    const categoryMap: Record<string, string> = {
      linkedin: 'Career', discipline: 'Health', lifestyle: 'Lifestyle',
      social_proof: 'Social', assets: 'Assets', wealth: 'Wealth',
    };
    for (const proof of verifiedProofs) {
      const cat = categoryMap[String(proof.category)] ?? String(proof.category);
      if (!signalGroups[cat]) signalGroups[cat] = [];
      for (const ins of (Array.isArray(proof.insights) ? proof.insights as Array<{emoji:string;label:string}> : [])) {
        signalGroups[cat].push({ emoji: ins.emoji, label: ins.label });
      }
    }
    const verifiedSignals = Object.entries(signalGroups).map(([label, items]) => ({ label, items }));

    // Travel magnets (locations from all proofs)
    const travelLocations = Array.from(new Set(
      verifiedProofs.flatMap(p => Array.isArray(p.locations) ? p.locations as string[] : [])
    )).filter(Boolean);

    // Garage cars
    const assetsProof = verifiedProofs.find(p => p.category === 'assets');
    const garageCars = Array.isArray(assetsProof?.assets)
      ? (assetsProof!.assets as Array<Record<string, string>>)
          .filter(a => a.type === 'car' && a.make)
          .map(a => ({ make: a.make, model: a.model ?? '', year: a.year, color: a.color, vehicleType: a.vehicleType }))
      : [];

    // Money matters (wealth proof)
    const wealthProof = verifiedProofs.find(p => p.category === 'wealth') ?? null;
    const linkedinProof = verifiedProofs.find(p => p.category === 'linkedin') ?? null;

    // AI portraits
    const personalityPortraitUrl = typeof masterData.personalityPortraitUrl === 'string' ? masterData.personalityPortraitUrl : null;
    const garagePortraitUrl = typeof masterData.garagePortraitUrl === 'string' ? masterData.garagePortraitUrl : null;

    return json({
      data: {
        id: profile.id,
        firstName,
        age: profile.age,
        city: profile.city,
        avatar: profile.avatar_url,
        about,
        looking: profile.looking,
        trustScore,
        archetype,
        archetypeName: archetypeDef?.name ?? archetype,
        archetypeEmoji: archetypeDef?.emoji ?? '✨',
        gender: profile.gender,
        // Rich sections
        hereFor,
        vibeWords,
        brings,
        archetypeChips,
        verifiedSignals,
        travelLocations,
        garageCars,
        wealthProof,
        linkedinProof,
        personalityPortraitUrl,
        garagePortraitUrl,
      },
    });
  } catch (err) {
    console.error('public-profile error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
