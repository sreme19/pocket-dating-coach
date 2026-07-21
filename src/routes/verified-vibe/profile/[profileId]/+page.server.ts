import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { ARCHETYPES } from '$lib/verified-vibe/constants';
import { isAbusiveName, isAbusiveCity } from '$lib/server/profile-moderation';
import { buildPublicPhotos, pickHeroUrl } from '$lib/server/profile-photos';

/**
 * Server load exists ONLY to render Open Graph / link-preview metadata into the
 * initial SSR HTML. Link-preview crawlers (WhatsApp, iMessage, Slack, Twitter)
 * do not execute JS, so the client-side `onMount` fetch that powers the
 * interactive page never runs for them — without this they see the generic
 * app.html defaults and no hero image. We fetch just enough (name, age, city,
 * hero photo) here so a share of a profile link shows the person's photo.
 *
 * The interactive page still loads its full payload client-side in onMount;
 * this load intentionally stays lightweight and never throws.
 */
export const load: PageServerLoad = async ({ params, url }) => {
  const empty = { og: null };
  const profileId = params.profileId;
  if (!profileId) return empty;

  try {
    const supabase = getSupabase();
    const db = supabase as any;

    const [profileRes, masterRes] = await Promise.all([
      db.from('verified_vibe_users')
        .select('first_name, age, city, avatar_url, archetype, gender')
        .eq('id', profileId).single(),
      db.from('user_master_profile').select('data').eq('user_id', profileId).maybeSingle(),
    ]);

    if (profileRes.error || !profileRes.data) return empty;
    const profile = profileRes.data;

    // Title-case name, guarding against symbol/digit garbage (mirrors public-profile API).
    const rawName: string = isAbusiveName(profile.first_name) ? 'Member' : (profile.first_name ?? 'User');
    const firstName = rawName === rawName.toUpperCase()
      ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase()
      : rawName;

    const city = isAbusiveCity(profile.city) ? null : profile.city;

    // Gender-aware hero: men show AI portraits only (never a raw upload), women
    // may fall back to avatar. Same rules as the public-profile endpoint.
    const masterData = (masterRes?.data?.data as Record<string, unknown>) ?? {};
    const photos = buildPublicPhotos(masterData, profile.gender);
    const heroUrl = pickHeroUrl(photos, profile.gender, profile.avatar_url);

    const archetypeDef = ARCHETYPES[profile.archetype ?? ''];

    const title = `${firstName}${profile.age ? `, ${profile.age}` : ''} · riteangle`;
    const descParts = [
      city,
      archetypeDef?.tag,
    ].filter(Boolean);
    const description = descParts.length
      ? descParts.join(' · ')
      : `${firstName}'s verified profile on riteangle`;

    return {
      og: {
        title,
        description,
        image: heroUrl,
        url: `${url.origin}${url.pathname}`,
      },
    };
  } catch (err) {
    console.error('profile OG load error:', err);
    return empty;
  }
};
