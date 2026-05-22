<script lang="ts">
  /**
   * BestieAvatar — cartoon lady illustration with layered golden stars.
   * Used in every AI Bestie avatar placement across Verified Vibe.
   */
  let { size = 48, borderRadius = '50%' }: { size?: number; borderRadius?: string } = $props();

  // Unique IDs so multiple instances on the same page don't clash on gradient/clip refs
  const uid = Math.random().toString(36).slice(2, 7);
</script>

<div
  class="bestie-avatar"
  style="width:{size}px;height:{size}px;border-radius:{borderRadius};flex-shrink:0;"
  aria-label="AI Bestie"
>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <!-- Background gradient -->
      <linearGradient id="bg-{uid}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ec4899"/>
        <stop offset="100%" stop-color="#a855f7"/>
      </linearGradient>
      <!-- Lip gradient -->
      <linearGradient id="lip-{uid}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#e8457a"/>
        <stop offset="100%" stop-color="#c42d5e"/>
      </linearGradient>
      <!-- Hair sheen -->
      <linearGradient id="hair-{uid}" x1="30%" y1="0%" x2="70%" y2="100%">
        <stop offset="0%" stop-color="#2a0a40"/>
        <stop offset="40%" stop-color="#1a0530"/>
        <stop offset="100%" stop-color="#0d0020"/>
      </linearGradient>
      <!-- Skin gradient -->
      <linearGradient id="skin-{uid}" x1="30%" y1="0%" x2="70%" y2="100%">
        <stop offset="0%" stop-color="#fdd5b0"/>
        <stop offset="100%" stop-color="#f5b88a"/>
      </linearGradient>
      <!-- Star gold gradient -->
      <linearGradient id="star-{uid}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffe066"/>
        <stop offset="100%" stop-color="#ffb300"/>
      </linearGradient>
      <!-- Clip to circle -->
      <clipPath id="clip-{uid}">
        <circle cx="50" cy="50" r="50"/>
      </clipPath>
    </defs>

    <!-- Background -->
    <circle cx="50" cy="50" r="50" fill="url(#bg-{uid})"/>

    <g clip-path="url(#clip-{uid})">

      <!-- ── Hair (back layer) ── -->
      <!-- Main hair mass -->
      <ellipse cx="50" cy="28" rx="28" ry="30" fill="url(#hair-{uid})"/>
      <!-- Left side flow down past face -->
      <path d="M22 32 Q14 58 16 100 L30 100 Q26 70 32 50 Q36 40 38 34 Z" fill="url(#hair-{uid})"/>
      <!-- Right side flow -->
      <path d="M78 32 Q86 58 84 100 L70 100 Q74 70 68 50 Q64 40 62 34 Z" fill="url(#hair-{uid})"/>

      <!-- ── Shoulders (peeking at bottom) ── -->
      <ellipse cx="50" cy="102" rx="32" ry="18" fill="#f5b88a"/>
      <!-- Off-shoulder top hint -->
      <path d="M18 92 Q30 88 50 90 Q70 88 82 92 L84 110 L16 110 Z" fill="#d946a0" opacity="0.85"/>

      <!-- ── Neck ── -->
      <rect x="43" y="74" width="14" height="22" rx="7" fill="url(#skin-{uid})"/>
      <!-- Neck shadow -->
      <rect x="43" y="74" width="14" height="6" rx="3" fill="rgba(200,120,60,0.15)"/>

      <!-- ── Face ── -->
      <ellipse cx="50" cy="52" rx="22" ry="25" fill="url(#skin-{uid})"/>

      <!-- ── Ear hints ── -->
      <ellipse cx="28" cy="52" rx="4" ry="5" fill="#f5b88a"/>
      <ellipse cx="72" cy="52" rx="4" ry="5" fill="#f5b88a"/>

      <!-- ── Eyebrows (arched, defined) ── -->
      <path d="M32 40 Q37 36.5 43 38.5" stroke="#2a0a40" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M57 38.5 Q63 36.5 68 40" stroke="#2a0a40" stroke-width="2.8" fill="none" stroke-linecap="round"/>

      <!-- ── Eyes ── -->
      <!-- Eye whites -->
      <ellipse cx="39" cy="47" rx="6.5" ry="6" fill="white"/>
      <ellipse cx="61" cy="47" rx="6.5" ry="6" fill="white"/>
      <!-- Iris -->
      <circle cx="39.5" cy="47.5" r="4.5" fill="#2a1040"/>
      <circle cx="60.5" cy="47.5" r="4.5" fill="#2a1040"/>
      <!-- Pupil -->
      <circle cx="39.5" cy="47.5" r="2.5" fill="#100018"/>
      <circle cx="60.5" cy="47.5" r="2.5" fill="#100018"/>
      <!-- Iris ring shine -->
      <circle cx="39.5" cy="47.5" r="4.5" fill="none" stroke="#7c3aed" stroke-width="0.8" opacity="0.6"/>
      <circle cx="60.5" cy="47.5" r="4.5" fill="none" stroke="#7c3aed" stroke-width="0.8" opacity="0.6"/>
      <!-- Eye highlight -->
      <circle cx="37.8" cy="45.8" r="1.6" fill="rgba(255,255,255,0.9)"/>
      <circle cx="59.0" cy="45.8" r="1.6" fill="rgba(255,255,255,0.9)"/>
      <circle cx="40.8" cy="48.5" r="0.7" fill="rgba(255,255,255,0.5)"/>
      <circle cx="62.0" cy="48.5" r="0.7" fill="rgba(255,255,255,0.5)"/>

      <!-- Upper eyelid crease -->
      <path d="M33 43.5 Q39 41 45.5 43.5" stroke="rgba(100,30,80,0.35)" stroke-width="1" fill="none"/>
      <path d="M54.5 43.5 Q61 41 67 43.5" stroke="rgba(100,30,80,0.35)" stroke-width="1" fill="none"/>

      <!-- Eyelashes (upper) -->
      <path d="M33 44 Q32 41.5 31 40" stroke="#120028" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M35.5 42.5 Q35 40 34.5 38.5" stroke="#120028" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M38.5 41.5 Q38.5 39 39 37.5" stroke="#120028" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M41.5 42 Q42 39.5 43 38" stroke="#120028" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M44 43 Q45 40.5 46.2 39.5" stroke="#120028" stroke-width="1.3" fill="none" stroke-linecap="round"/>

      <path d="M56 43 Q55 40.5 53.8 39.5" stroke="#120028" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <path d="M58.5 42 Q58 39.5 57 38" stroke="#120028" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M61.5 41.5 Q61.5 39 61 37.5" stroke="#120028" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M64.5 42.5 Q65 40 65.5 38.5" stroke="#120028" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M67 44 Q68 41.5 69 40" stroke="#120028" stroke-width="1.4" fill="none" stroke-linecap="round"/>

      <!-- Lower lash (subtle) -->
      <path d="M33.5 50.5 Q33 52.5 32.5 53.5" stroke="#2a0a40" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.5"/>
      <path d="M44.5 50.5 Q45 52.5 45.5 53.5" stroke="#2a0a40" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.5"/>
      <path d="M55.5 50.5 Q55 52.5 54.5 53.5" stroke="#2a0a40" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.5"/>
      <path d="M66.5 50.5 Q67 52.5 67.5 53.5" stroke="#2a0a40" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.5"/>

      <!-- Eyeshadow -->
      <path d="M33 44 Q39 42 45.5 44" stroke="#d946a0" stroke-width="1.2" fill="none" opacity="0.4"/>
      <path d="M54.5 44 Q61 42 67 44" stroke="#d946a0" stroke-width="1.2" fill="none" opacity="0.4"/>

      <!-- ── Nose ── -->
      <path d="M47 58 Q50 62 53 58" stroke="#d4886a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <circle cx="47.5" cy="60" r="1" fill="rgba(180,100,60,0.3)"/>
      <circle cx="52.5" cy="60" r="1" fill="rgba(180,100,60,0.3)"/>

      <!-- ── Lips ── -->
      <!-- Upper lip cupid's bow -->
      <path d="M39 67 Q43.5 63.5 50 65.5 Q56.5 63.5 61 67 Q56 69 50 69 Q44 69 39 67 Z" fill="url(#lip-{uid})"/>
      <!-- Lower lip -->
      <path d="M39 67 Q50 76 61 67 Q56 70 50 71.5 Q44 70 39 67 Z" fill="#d93870"/>
      <!-- Upper lip highlight -->
      <path d="M45 65.5 Q50 64 55 65.5" stroke="rgba(255,255,255,0.25)" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <!-- Lower lip highlight -->
      <ellipse cx="50" cy="70" rx="5" ry="1.8" fill="rgba(255,255,255,0.18)"/>

      <!-- ── Blush ── -->
      <ellipse cx="30" cy="58" rx="8" ry="5" fill="rgba(255,100,150,0.18)"/>
      <ellipse cx="70" cy="58" rx="8" ry="5" fill="rgba(255,100,150,0.18)"/>

      <!-- ── Hair (front layer — strands framing face) ── -->
      <!-- Centre parting wisp -->
      <path d="M44 28 Q46 34 45 42" stroke="#2a0a40" stroke-width="3.5" fill="none" stroke-linecap="round" opacity="0.7"/>
      <path d="M50 26 Q50 30 50 36" stroke="#2a0a40" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.4"/>
      <!-- Side strand left -->
      <path d="M23 35 Q28 45 30 58" stroke="#1a0530" stroke-width="5" fill="none" stroke-linecap="round"/>
      <!-- Side strand right -->
      <path d="M77 35 Q72 45 70 58" stroke="#1a0530" stroke-width="5" fill="none" stroke-linecap="round"/>

    </g>

    <!-- ── Golden stars (layered over the avatar, not clipped) ── -->
    <!-- Star helper: 5-point star centred at (cx,cy) with outer r=ro, inner r=ri -->

    <!-- Large star — top-right -->
    <polygon
      points="
        78,8  79.8,13.8  85.8,13.8  81,17.2  82.8,23  78,19.6  73.2,23  75,17.2  70.2,13.8  76.2,13.8
      "
      fill="url(#star-{uid})"
      stroke="#ffcc00"
      stroke-width="0.5"
      filter="drop-shadow(0 0 2px rgba(255,200,0,0.7))"
    />

    <!-- Medium star — top-left -->
    <polygon
      points="
        20,5  21.3,9.2  25.7,9.2  22.2,11.7  23.5,15.9  20,13.4  16.5,15.9  17.8,11.7  14.3,9.2  18.7,9.2
      "
      fill="url(#star-{uid})"
      stroke="#ffcc00"
      stroke-width="0.5"
      filter="drop-shadow(0 0 1.5px rgba(255,200,0,0.6))"
    />

    <!-- Small star — mid-right -->
    <polygon
      points="
        89,38  90,41.1  93.2,41.1  90.6,43  91.6,46.1  89,44.2  86.4,46.1  87.4,43  84.8,41.1  88,41.1
      "
      fill="url(#star-{uid})"
      stroke="#ffcc00"
      stroke-width="0.4"
      filter="drop-shadow(0 0 1px rgba(255,200,0,0.5))"
    />

    <!-- Sparkle dot accents -->
    <circle cx="86" cy="22" r="1.2" fill="#ffe566" opacity="0.9"/>
    <circle cx="12" cy="30" r="0.9" fill="#ffe566" opacity="0.7"/>
    <circle cx="92" cy="55" r="0.8" fill="#ffe566" opacity="0.6"/>

  </svg>
</div>

<style>
  .bestie-avatar {
    position: relative;
    overflow: hidden;
    display: block;
  }
</style>
