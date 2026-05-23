<script lang="ts">
  interface Profile {
    id: string;
    name: string;
    age: number;
    avatar: string;
    title: string;
    isOnline: boolean;
    lastActiveTime?: string;
  }

  interface Props {
    viewerGender?: 'man' | 'woman' | 'prefer_not_to_say' | null;
    title?: string;
    subtitle?: string;
  }

  let { viewerGender = null, title, subtitle }: Props = $props();

  // Read gender from localStorage if not passed as prop
  const resolvedGender = $derived.by(() => {
    if (viewerGender) return viewerGender;
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('verified_vibe_gender') as Props['viewerGender']) ?? 'man';
    }
    return 'man';
  });

  const womenProfiles: Profile[] = [
    { id: 'w1', name: 'Iris',   age: 24, avatar: '👩‍⚕️', title: 'Med student',       isOnline: true,  lastActiveTime: '1h ago'   },
    { id: 'w2', name: 'Camille',age: 29, avatar: '👩‍⚖️', title: 'Lawyer',            isOnline: true,  lastActiveTime: 'just now' },
    { id: 'w3', name: 'Noor',   age: 26, avatar: '👩‍🎨', title: 'Designer',          isOnline: true,  lastActiveTime: 'just now' },
    { id: 'w4', name: 'Lena',   age: 27, avatar: '👩‍💼', title: 'Brand strategist',  isOnline: true,  lastActiveTime: '1h ago'   },
    { id: 'w5', name: 'Talia',  age: 30, avatar: '👩‍💻', title: 'VC analyst',        isOnline: false, lastActiveTime: '1d ago'   },
    { id: 'w6', name: 'Reyna',  age: 25, avatar: '🎭',   title: 'Fashion buyer',    isOnline: true,  lastActiveTime: 'just now' },
    { id: 'w7', name: 'Zara',   age: 28, avatar: '👩‍🔬', title: 'Biotech founder',  isOnline: true,  lastActiveTime: '20m ago'  },
    { id: 'w8', name: 'Sofia',  age: 31, avatar: '🎨',   title: 'Creative director', isOnline: false, lastActiveTime: '3h ago'   },
  ];

  const menProfiles: Profile[] = [
    { id: 'm1', name: 'Marcus', age: 34, avatar: '👨‍💼', title: 'Private equity',    isOnline: true,  lastActiveTime: 'just now' },
    { id: 'm2', name: 'Elliot', age: 31, avatar: '👨‍🍳', title: 'Restaurant owner', isOnline: true,  lastActiveTime: '30m ago'  },
    { id: 'm3', name: 'James',  age: 38, avatar: '👨‍⚖️', title: 'Attorney',         isOnline: true,  lastActiveTime: 'just now' },
    { id: 'm4', name: 'Kai',    age: 29, avatar: '👨‍🚀', title: 'Aerospace eng.',   isOnline: false, lastActiveTime: '2h ago'   },
    { id: 'm5', name: 'Darius', age: 36, avatar: '👨‍🎤', title: 'Music producer',   isOnline: true,  lastActiveTime: 'just now' },
    { id: 'm6', name: 'Theo',   age: 32, avatar: '👨‍💻', title: 'Tech founder',     isOnline: true,  lastActiveTime: '45m ago'  },
    { id: 'm7', name: 'Nico',   age: 33, avatar: '👨‍🎨', title: 'Creative dir.',    isOnline: false, lastActiveTime: '4h ago'   },
    { id: 'm8', name: 'Ruben',  age: 37, avatar: '🏋️',   title: 'Sports agent',    isOnline: true,  lastActiveTime: '10m ago'  },
  ];

  const profiles = $derived(
    resolvedGender === 'woman' ? menProfiles : womenProfiles
  );

  const displayTitle = $derived(
    title ?? (resolvedGender === 'woman' ? 'Verified Men Online Now' : 'Verified Women Online Now')
  );

  const displaySubtitle = $derived(subtitle ?? '6 live · 10 today');

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
        <div class="avatar-item">
          <div class="avatar-wrap">
            <div class="avatar">{profile.avatar}</div>
            <div class="status-dot" class:online={profile.isOnline}></div>
          </div>
          <span class="profile-name">{profile.name} {profile.age}</span>
          <span class="profile-title">{profile.title}</span>
          {#if profile.lastActiveTime}
            <span class="profile-time" class:online={profile.isOnline}>
              {profile.isOnline ? '● ' : '● '}{profile.lastActiveTime}
            </span>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <div class="carousel-footer">
    <span class="footer-icon">⚡</span>
    <p class="footer-text">
      Finish onboarding and you'll be speaking to a few of them
      <em class="highlight"> within 30 minutes.</em>
    </p>
  </div>
</div>

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

  /* Infinite scroll track */
  .track-wrapper {
    overflow: hidden;
    padding: 12px 0;
  }

  .track {
    display: flex;
    gap: 20px;
    width: max-content;
    padding: 0 16px;
    animation: scroll 22s linear infinite;
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

  .avatar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    width: 72px;
  }

  .avatar-wrap {
    position: relative;
    width: 62px;
    height: 62px;
  }

  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent-tint), var(--bg-3));
    border: 2px solid var(--border-2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
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

  .profile-title {
    font-size: 10px;
    color: var(--text-3);
    white-space: nowrap;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 72px;
  }

  .profile-time {
    font-size: 10px;
    color: var(--text-4);
    white-space: nowrap;
  }

  .profile-time.online {
    color: var(--accent-bright);
  }

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
