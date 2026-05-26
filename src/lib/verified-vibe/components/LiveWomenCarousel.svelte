<script lang="ts" module>
  export interface SeedCarouselProfile {
    id: string;
    name: string;
    age: number;
    gender: 'man' | 'woman';
    archetypeId: string;
    photoUrl: string;
    bio: string;
    isOnline: boolean;
    lastActive: string;
  }
</script>

<script lang="ts">
  import ProfilePreviewSheet from './ProfilePreviewSheet.svelte';

  interface Props {
    viewerGender?: 'man' | 'woman' | 'prefer_not_to_say' | null;
    showMixed?: boolean;
    redirectTo?: string;
    title?: string;
    subtitle?: string;
  }

  let { viewerGender = null, showMixed = false, redirectTo, title, subtitle }: Props = $props();

  let openedProfile = $state<SeedCarouselProfile | null>(null);

  const resolvedGender = $derived.by(() => {
    if (viewerGender) return viewerGender;
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('verified_vibe_gender') as Props['viewerGender']) ?? 'man';
    }
    return 'man';
  });

  // ── Seed profile data ────────────────────────────────────────────────────

  const womenProfiles: SeedCarouselProfile[] = [
    {
      id: 'anjali',
      name: 'Anjali', age: 25, gender: 'woman',
      archetypeId: 'traditional_matrimony_woman',
      photoUrl: '/female_profiles/anjali_Traditional_Family_First_g3s7mn/photos/Anjali_1.jpg',
      bio: 'Pharmacist. Family-first, not by default — by choice. Looking for the real thing.',
      isOnline: true, lastActive: 'online',
    },
    {
      id: 'sarah',
      name: 'Sarah', age: 24, gender: 'woman',
      archetypeId: 'forever_focused_woman',
      photoUrl: '/female_profiles/sarah_Tech_Founder_045db3/photos/Sarah_1.jpg',
      bio: 'Tech founder. Knows what she\'s building and who belongs in it.',
      isOnline: true, lastActive: 'online',
    },
    {
      id: 'emma',
      name: 'Emma', age: 27, gender: 'woman',
      archetypeId: 'hopeless_romantic_woman',
      photoUrl: '/female_profiles/emma_Outdoorsy_Adventure_w9d4cs/photos/Emma_1.jpg',
      bio: 'Adventure first, love second — but she feels everything. Don\'t mistake softness for naivety.',
      isOnline: false, lastActive: '2h ago',
    },
    {
      id: 'jessica',
      name: 'Jessica', age: 28, gender: 'woman',
      archetypeId: 'forever_focused_woman',
      photoUrl: '/female_profiles/jessica_Ambitious_Professional_e89f0f/photos/Jessica_3.jpg',
      bio: 'Corporate lawyer. Sharp, intentional, done with maybes.',
      isOnline: true, lastActive: 'online',
    },
    {
      id: 'deepa',
      name: 'Deepa', age: 33, gender: 'woman',
      archetypeId: 'hopeless_romantic_woman',
      photoUrl: '/female_profiles/deepa_Older_Dater_o1m4ft/photos/Deepa_1.jpg',
      bio: 'Doctor. Older and wiser — still believes in the real thing.',
      isOnline: false, lastActive: '45m ago',
    },
    {
      id: 'lauren',
      name: 'Lauren', age: 29, gender: 'woman',
      archetypeId: 'forever_focused_woman',
      photoUrl: '/female_profiles/lauren_Ambitious_Corporate_c7f2nx/photos/Lauren_5.jpg',
      bio: 'Strategy consultant. Knows her worth and won\'t negotiate down.',
      isOnline: true, lastActive: 'online',
    },
    {
      id: 'neha',
      name: 'Neha', age: 29, gender: 'woman',
      archetypeId: 'traditional_matrimony_woman',
      photoUrl: '/female_profiles/neha_NRI_Diaspora_x5r2vd/photos/Neha_1.jpg',
      bio: 'London-based NRI. Navigating tradition and modernity on her own terms.',
      isOnline: false, lastActive: '3h ago',
    },
    {
      id: 'priya',
      name: 'Priya', age: 30, gender: 'woman',
      archetypeId: 'forever_focused_woman',
      photoUrl: '/female_profiles/priya_High_Value_Feminist_f2k7zt/photos/Priya_2.jpg',
      bio: 'UX researcher. Feminist who still wants the fairytale — without the compromise.',
      isOnline: true, lastActive: 'online',
    },
    {
      id: 'zara',
      name: 'Zara', age: 26, gender: 'woman',
      archetypeId: 'spoiled_casual_woman',
      photoUrl: '/female_profiles/zara_Soft_Life_Seeker_m4p9rx/photos/fenomen-zara-1.jpg',
      bio: 'Lifestyle curator. Good taste, no pressure, won\'t apologise for either.',
      isOnline: true, lastActive: 'online',
    },
    {
      id: 'diana',
      name: 'Diana', age: 35, gender: 'woman',
      archetypeId: 'forever_focused_woman',
      photoUrl: '/female_profiles/diana_Fiercely_Independent_c4h9pw/photos/Diana_1.jpg',
      bio: 'Creative director. Independent by design — but ready to let the right person in.',
      isOnline: false, lastActive: '1h ago',
    },
  ];

  const menProfiles: SeedCarouselProfile[] = [
    {
      id: 'daniel',
      name: 'Daniel', age: 35, gender: 'man',
      archetypeId: 'hopeless_romantic_man',
      photoUrl: '/male_profiles/daniel_Emotionally_Available_v2r6ys/photos/Daniel_5.jpg',
      bio: 'Marketing director. Emotionally available — genuinely, not just in theory.',
      isOnline: true, lastActive: 'online',
    },
    {
      id: 'ethan',
      name: 'Ethan', age: 29, gender: 'man',
      archetypeId: 'hopeless_romantic_man',
      photoUrl: '/male_profiles/ethan_Golden_Retriever_q7n5wc/photos/Ethan_1.jpg',
      bio: 'Startup co-founder. Thinks deeply, shows up fully, no games in him.',
      isOnline: true, lastActive: 'online',
    },
    {
      id: 'greg',
      name: 'Greg', age: 42, gender: 'man',
      archetypeId: 'casual_generous_man',
      photoUrl: '/male_profiles/greg_Casually_Ambitious_m6x2vt/photos/Greg_3.jpg',
      bio: 'Sales exec. Established, generous, still chasing experiences over labels.',
      isOnline: false, lastActive: '30m ago',
    },
    {
      id: 'karan',
      name: 'Karan', age: 34, gender: 'man',
      archetypeId: 'forever_focused_man',
      photoUrl: '/male_profiles/karan_Progressive_Traditional_u9j5ql/photos/Karan_5.jpg',
      bio: 'PM at a unicorn. Knows exactly what he\'s building — in work and in love.',
      isOnline: true, lastActive: 'online',
    },
    {
      id: 'ryan',
      name: 'Ryan', age: 31, gender: 'man',
      archetypeId: 'casual_generous_man',
      photoUrl: '/male_profiles/ryan_Serial_Dater_f4m2px/photos/Ryan_1.jpg',
      bio: 'Banker. Fun, present, honest about what this is and what it isn\'t.',
      isOnline: true, lastActive: 'online',
    },
    {
      id: 'michael',
      name: 'Michael', age: 44, gender: 'man',
      archetypeId: 'rebound_healing_man',
      photoUrl: '/male_profiles/michael_Perpetually_Busy_a4s9uf/photos/Michael_5.jpg',
      bio: 'Architect. Survived a marriage, learned from it, rebuilding intentionally.',
      isOnline: false, lastActive: '2h ago',
    },
    {
      id: 'john',
      name: 'John', age: 26, gender: 'man',
      archetypeId: 'untouched_heart_man',
      photoUrl: '/male_profiles/john_Young_Student_nsysor/photos/John_1.jpg',
      bio: 'Postgrad. Hasn\'t done this much — brings exactly that energy. Zero baggage.',
      isOnline: false, lastActive: '4h ago',
    },
  ];

  // Interleave women + men for the mixed view on the gate page
  const mixedProfiles: SeedCarouselProfile[] = (() => {
    const result: SeedCarouselProfile[] = [];
    const w = [...womenProfiles];
    const m = [...menProfiles];
    const len = Math.max(w.length, m.length);
    for (let i = 0; i < len; i++) {
      if (w[i]) result.push(w[i]);
      if (m[i]) result.push(m[i]);
    }
    return result;
  })();

  const profiles = $derived(
    showMixed
      ? mixedProfiles
      : resolvedGender === 'woman' ? menProfiles : womenProfiles
  );

  const displayTitle = $derived(
    title ?? (showMixed
      ? 'Verified Members Online Now'
      : resolvedGender === 'woman' ? 'Verified Men Online Now' : 'Verified Women Online Now')
  );
  const displaySubtitle = $derived(subtitle ?? (() => {
    const online = profiles.filter(p => p.isOnline).length;
    return `${online} live · ${profiles.length} today`;
  })());

  // Duplicate for seamless loop
  const loopProfiles = $derived([...profiles, ...profiles]);
</script>

<div class="carousel-container">
  <div class="carousel-header">
    <div class="header-left">
      <span class="live-dot"></span>
      <span class="header-title">{displayTitle}</span>
    </div>
    <span class="header-sub">{displaySubtitle}</span>
  </div>

  <div class="track-wrapper">
    <div class="track">
      {#each loopProfiles as profile, i (`${profile.id}-${i}`)}
        <button
          class="avatar-item"
          onclick={() => { openedProfile = profile; }}
          aria-label="View {profile.name}'s profile"
        >
          <div class="avatar-wrap">
            <img
              src={profile.photoUrl}
              alt={profile.name}
              class="avatar-img"
              loading="lazy"
            />
            <div class="status-dot" class:online={profile.isOnline}></div>
          </div>
          <span class="profile-name">{profile.name} {profile.age}</span>
          <span class="profile-time" class:online={profile.isOnline}>
            ● {profile.isOnline ? 'Online' : profile.lastActive}
          </span>
        </button>
      {/each}
    </div>
  </div>

</div>

<ProfilePreviewSheet
  profile={openedProfile}
  onClose={() => { openedProfile = null; }}
  {redirectTo}
/>

<style>
  .carousel-container {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 14px;
    overflow: hidden;
  }

  .carousel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px 10px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-bright);
    box-shadow: 0 0 0 3px var(--accent-tint);
    animation: pulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 3px var(--accent-tint); }
    50%       { box-shadow: 0 0 0 6px rgba(52, 211, 153, 0.08); }
  }

  .header-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  .header-sub {
    font-size: 11px;
    color: var(--text-3);
  }

  /* ── Infinite scroll track ─────────────────────────────────────────────── */

  .track-wrapper {
    overflow: hidden;
    padding: 12px 0;
  }

  .track {
    display: flex;
    gap: 16px;
    width: max-content;
    padding: 0 16px;
    animation: scroll 28s linear infinite;
  }

  .track:hover {
    animation-play-state: paused;
  }

  @keyframes scroll {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  @media (prefers-reduced-motion: reduce) {
    .track { animation: none; }
  }

  /* ── Avatar item ───────────────────────────────────────────────────────── */

  .avatar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    width: 72px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
  }

  .avatar-item:active .avatar-wrap {
    transform: scale(0.93);
  }

  .avatar-wrap {
    position: relative;
    width: 64px;
    height: 64px;
    transition: transform 160ms ease;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    object-position: top center;
    border: 2.5px solid var(--border-2);
    display: block;
  }

  .avatar-item:active .avatar-img,
  .avatar-item:focus-visible .avatar-img {
    border-color: var(--accent-bright);
  }

  .status-dot {
    position: absolute;
    bottom: 1px;
    right: 1px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--bg-2);
    background: var(--border-2);
  }

  .status-dot.online {
    background: var(--accent-bright);
    box-shadow: 0 0 6px rgba(52, 211, 153, 0.5);
  }

  .profile-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-1);
    white-space: nowrap;
    text-align: center;
  }

  .profile-time {
    font-size: 10px;
    color: var(--text-4);
    white-space: nowrap;
  }

  .profile-time.online {
    color: var(--accent-bright);
  }

  /* ── Footer ────────────────────────────────────────────────────────────── */

  .carousel-footer {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 16px 14px;
    background: var(--accent-tint);
    border-top: 1px solid rgba(52, 211, 153, 0.15);
  }

  .footer-icon {
    font-size: 14px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .footer-text {
    font-size: 12px;
    color: var(--text-2);
    margin: 0;
    line-height: 1.5;
  }

  .highlight {
    color: var(--accent-bright);
    font-weight: 600;
    font-style: italic;
  }
</style>
