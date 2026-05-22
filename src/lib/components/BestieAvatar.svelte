<script lang="ts">
  /**
   * BestieAvatar — flat-vector cartoon lady: dark hair, red lips, off-shoulder
   * corset dress, confident hands-on-hips pose. Three golden stars layered over.
   */
  let { size = 48, borderRadius = '50%' }: { size?: number; borderRadius?: string } = $props();
  const uid = Math.random().toString(36).slice(2, 7);
</script>

<div
  class="bestie-avatar"
  style="width:{size}px;height:{size}px;border-radius:{borderRadius};flex-shrink:0;"
  aria-label="AI Bestie"
>
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <linearGradient id="bg-{uid}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ec4899"/>
        <stop offset="100%" stop-color="#a855f7"/>
      </linearGradient>
      <linearGradient id="star-{uid}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffe566"/>
        <stop offset="100%" stop-color="#ffa500"/>
      </linearGradient>
      <clipPath id="clip-{uid}">
        <circle cx="100" cy="100" r="100"/>
      </clipPath>
    </defs>

    <!-- Background gradient -->
    <circle cx="100" cy="100" r="100" fill="url(#bg-{uid})"/>

    <g clip-path="url(#clip-{uid})">

      <!-- ══ HAIR — back mass, flows right ══ -->
      <path d="
        M 58 15
        Q 72 2,  100 0
        Q 130 2, 148 16
        Q 166 32, 168 60
        Q 172 90, 164 120
        Q 158 148, 150 178
        L 140 178
        Q 148 148, 154 120
        Q 162 90, 158 60
        Q 154 36, 136 22
        Q 118  8,  98  8
        Q 76  8, 64  22
        Q 52  36, 50  58
        Q 48  78, 50  98
        L 44  98
        Q 42  76, 44  54
        Q 46  30, 58  15 Z
      " fill="#130820"/>

      <!-- Right-side flowing hair over shoulder -->
      <path d="
        M 145 18
        Q 170 38, 172 68
        Q 175 98, 166 128
        Q 158 155, 150 182
        L 143 182
        Q 150 155, 158 128
        Q 166 98, 163 68
        Q 160 40, 138 22 Z
      " fill="#1c0d30"/>

      <!-- Hair highlight (sheen on top) -->
      <path d="
        M 86 4
        Q 100 1, 118 8
        Q 108 5, 100 5
        Q 93 5, 86 8 Z
      " fill="#2e1248" opacity="0.9"/>

      <!-- ══ BODY — black dress bottom ══ -->
      <path d="
        M 18 185
        Q 44 155, 72 142
        Q 86 136, 100 135
        Q 114 136, 128 142
        Q 156 155, 182 185
        L 182 200 L 18 200 Z
      " fill="#0f0f0f"/>

      <!-- Arm left (hint of skin, hands on hips pose) -->
      <path d="
        M 22 182
        Q 36 164, 54 154
        Q 44 170, 38 188 Z
      " fill="#d4a882"/>

      <!-- Arm right -->
      <path d="
        M 178 182
        Q 164 164, 146 154
        Q 156 170, 162 188 Z
      " fill="#d4a882"/>

      <!-- ══ NECK ══ -->
      <path d="
        M 88 112
        Q 100 118, 112 112
        L 114 142
        Q 100 147, 86 142 Z
      " fill="#d4a882"/>
      <!-- Neck centre shadow -->
      <path d="M 97 112 L 103 112 L 104 128 L 96 128 Z" fill="rgba(160,90,50,0.18)"/>

      <!-- ══ BARE SHOULDERS ══ -->
      <ellipse cx="62"  cy="138" rx="22" ry="9" fill="#d4a882"/>
      <ellipse cx="138" cy="138" rx="22" ry="9" fill="#d4a882"/>

      <!-- ══ OFF-SHOULDER DRESS (sweetheart top) ══ -->
      <!-- Left cap-sleeve / strap falling off shoulder -->
      <path d="
        M 40 130
        Q 62 124, 80 132
        L 80 142
        Q 62 134, 40 140 Z
      " fill="#111111"/>
      <!-- Right cap-sleeve -->
      <path d="
        M 160 130
        Q 138 124, 120 132
        L 120 142
        Q 138 134, 160 140 Z
      " fill="#111111"/>

      <!-- Sweetheart neckline (décolletage skin) -->
      <path d="
        M 74 136
        Q 82 142, 100 140
        Q 118 142, 126 136
        Q 116 128, 100 126
        Q 84 128, 74 136 Z
      " fill="#d4a882"/>
      <!-- Shadow under bust -->
      <path d="
        M 74 136
        Q 82 140, 100 138
        Q 118 140, 126 136
        Q 118 144, 100 144
        Q 82 144, 74 136 Z
      " fill="rgba(140,80,40,0.25)"/>

      <!-- Dress body (covers lower bust / waist) -->
      <path d="
        M 74 140
        Q 82 145, 100 144
        Q 118 145, 126 140
        L 126 152
        Q 112 156, 100 156
        Q 88 156, 74 152 Z
      " fill="#111111"/>

      <!-- ══ CORSET SHEER SECTION ══ -->
      <path d="
        M 76 153
        Q 88 148, 100 147
        Q 112 148, 124 153
        L 126 186
        Q 113 183, 100 182
        Q 87 183, 74 186 Z
      " fill="#c09070" opacity="0.55"/>

      <!-- Corset boning lines -->
      <line x1="89"  y1="149" x2="87"  y2="186" stroke="#7a4d28" stroke-width="1.4" opacity="0.65"/>
      <line x1="96"  y1="148" x2="95"  y2="186" stroke="#7a4d28" stroke-width="1.4" opacity="0.65"/>
      <line x1="100" y1="147" x2="100" y2="186" stroke="#7a4d28" stroke-width="1.4" opacity="0.65"/>
      <line x1="104" y1="148" x2="105" y2="186" stroke="#7a4d28" stroke-width="1.4" opacity="0.65"/>
      <line x1="111" y1="149" x2="113" y2="186" stroke="#7a4d28" stroke-width="1.4" opacity="0.65"/>
      <!-- Corset horizontal edge lines -->
      <path d="M 76 153 Q 88 149, 100 148 Q 112 149, 124 153" stroke="#7a4d28" stroke-width="1.2" fill="none" opacity="0.7"/>
      <path d="M 74 186 Q 87 184, 100 183 Q 113 184, 126 186" stroke="#7a4d28" stroke-width="1.2" fill="none" opacity="0.7"/>

      <!-- ══ FACE ══ -->
      <ellipse cx="100" cy="70" rx="34" ry="41" fill="#d4a882"/>

      <!-- Jaw / cheekbone definition (subtle shadow) -->
      <path d="M 68 78 Q 72 92, 78 104 Q 86 114, 100 116 Q 114 114, 122 104 Q 128 92, 132 78" fill="none" stroke="rgba(160,90,50,0.12)" stroke-width="8"/>

      <!-- Cheek blush (very subtle) -->
      <ellipse cx="74"  cy="80" rx="10" ry="6" fill="rgba(210,110,80,0.12)"/>
      <ellipse cx="126" cy="80" rx="10" ry="6" fill="rgba(210,110,80,0.12)"/>

      <!-- Ear hints -->
      <ellipse cx="66"  cy="72" rx="5" ry="7" fill="#c49070"/>
      <ellipse cx="134" cy="72" rx="5" ry="7" fill="#c49070"/>

      <!-- ══ HAIR FRONT (strands framing face) ══ -->
      <!-- Left side hairline strand -->
      <path d="
        M 68 18
        Q 60 36, 60 58
        Q 59 72, 62 86
        L 57 86
        Q 54 72, 55 58
        Q 55 36, 63 16 Z
      " fill="#130820"/>

      <!-- Right-side cascading strand over shoulder -->
      <path d="
        M 135 20
        Q 148 36, 152 60
        Q 156 82, 153 102
        L 148 102
        Q 151 82, 147 60
        Q 143 38, 130 22 Z
      " fill="#130820"/>

      <!-- ══ EYEBROWS — defined, arched ══ -->
      <path d="M 76 53 Q 83 47.5, 92 50" stroke="#120820" stroke-width="4"   fill="none" stroke-linecap="round"/>
      <path d="M 108 50 Q 117 47.5, 124 53" stroke="#120820" stroke-width="4" fill="none" stroke-linecap="round"/>

      <!-- ══ EYES ══ -->
      <!-- Left eye white -->
      <ellipse cx="85"  cy="63" rx="8.5" ry="6.5" fill="#f0ede8"/>
      <!-- Left iris (steel blue) -->
      <ellipse cx="85"  cy="63" rx="6.5" ry="5.5" fill="#6e9ab8"/>
      <!-- Left pupil -->
      <circle  cx="85"  cy="63" r="4"    fill="#100820"/>
      <!-- Left eye highlight -->
      <circle  cx="82.5" cy="60.8" r="2"  fill="rgba(255,255,255,0.88)"/>
      <circle  cx="87"   cy="65"   r="0.9" fill="rgba(255,255,255,0.4)"/>
      <!-- Left upper lid (crease + shadow) -->
      <path d="M 76.5 60 Q 85 55, 93.5 60" stroke="#120820" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <!-- Left lashes -->
      <path d="M 76.5 60 Q 74.5 57, 73 54.5" stroke="#100820" stroke-width="2"   fill="none" stroke-linecap="round"/>
      <path d="M 79.5 57.5 Q 78.5 55, 78 52.5" stroke="#100820" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M 85   55.5 Q 85 53, 85 50.5"   stroke="#100820" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M 90.5 57.5 Q 92 55, 93 52.5"   stroke="#100820" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M 93.5 60   Q 95.5 57.5, 96.5 55.5" stroke="#100820" stroke-width="1.6" fill="none" stroke-linecap="round"/>

      <!-- Right eye white -->
      <ellipse cx="115" cy="63" rx="8.5" ry="6.5" fill="#f0ede8"/>
      <!-- Right iris -->
      <ellipse cx="115" cy="63" rx="6.5" ry="5.5" fill="#6e9ab8"/>
      <!-- Right pupil -->
      <circle  cx="115" cy="63" r="4"    fill="#100820"/>
      <!-- Right eye highlight -->
      <circle  cx="112.5" cy="60.8" r="2"  fill="rgba(255,255,255,0.88)"/>
      <circle  cx="117"   cy="65"   r="0.9" fill="rgba(255,255,255,0.4)"/>
      <!-- Right upper lid -->
      <path d="M 106.5 60 Q 115 55, 123.5 60" stroke="#120820" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <!-- Right lashes -->
      <path d="M 106.5 60 Q 104.5 57, 103 54.5"   stroke="#100820" stroke-width="2"   fill="none" stroke-linecap="round"/>
      <path d="M 109.5 57.5 Q 108.5 55, 108 52.5" stroke="#100820" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M 115 55.5   Q 115 53, 115 50.5"   stroke="#100820" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M 120.5 57.5 Q 122 55, 123 52.5"   stroke="#100820" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M 123.5 60   Q 125.5 57.5, 126.5 55.5" stroke="#100820" stroke-width="1.6" fill="none" stroke-linecap="round"/>

      <!-- Lower lash (subtle) -->
      <path d="M 77 66 Q 76.5 68, 76 69.5"   stroke="#100820" stroke-width="1" fill="none" opacity="0.4"/>
      <path d="M 107 66 Q 106.5 68, 106 69.5" stroke="#100820" stroke-width="1" fill="none" opacity="0.4"/>

      <!-- ══ NOSE ══ -->
      <path d="M 95 78 Q 100 84, 105 78" stroke="#b07548" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="96.5" cy="81" rx="3" ry="2.2" fill="rgba(150,85,45,0.35)"/>
      <ellipse cx="103.5" cy="81" rx="3" ry="2.2" fill="rgba(150,85,45,0.35)"/>

      <!-- ══ LIPS ══ -->
      <!-- Upper lip — cupid's bow -->
      <path d="
        M 83 90
        Q 90 84.5, 100 87
        Q 110 84.5, 117 90
        Q 110 94, 100 94
        Q 90 94, 83 90 Z
      " fill="#7a1228"/>
      <!-- Lower lip — fuller -->
      <path d="
        M 83 90
        Q 100 101, 117 90
        Q 110 96, 100 98
        Q 90 96, 83 90 Z
      " fill="#9e1e38"/>
      <!-- Lower lip highlight -->
      <ellipse cx="100" cy="95" rx="7" ry="2.8" fill="rgba(200,80,100,0.2)"/>
      <!-- Mouth line -->
      <path d="M 83 90 Q 91.5 89, 100 90 Q 108.5 89, 117 90" stroke="#5a0c1e" stroke-width="0.9" fill="none" opacity="0.6"/>

      <!-- ══ COLLARBONE ══ -->
      <path d="M 52 128 Q 72 124, 86 130" stroke="rgba(160,95,55,0.3)" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M 148 128 Q 128 124, 114 130" stroke="rgba(160,95,55,0.3)" stroke-width="2.2" fill="none" stroke-linecap="round"/>

    </g>

    <!-- ══ GOLDEN STARS (layered over clip, never cropped) ══ -->
    <!-- Large star — top-right -->
    <polygon
      points="79,7 80.9,13.2 87.2,13.2 82.1,16.9 84,23.1 79,19.4 74,23.1 75.9,16.9 70.8,13.2 77.1,13.2"
      fill="url(#star-{uid})" stroke="#ffcc00" stroke-width="0.6"
      filter="drop-shadow(0 0 2.5px rgba(255,200,0,0.8))"
    />
    <!-- Medium star — top-left -->
    <polygon
      points="21,5 22.3,9.5 27,9.5 23.3,12.2 24.6,16.7 21,14 17.4,16.7 18.7,12.2 15,9.5 19.7,9.5"
      fill="url(#star-{uid})" stroke="#ffcc00" stroke-width="0.5"
      filter="drop-shadow(0 0 1.8px rgba(255,200,0,0.7))"
    />
    <!-- Small star — right edge -->
    <polygon
      points="190,42 191,45.4 194.5,45.4 191.7,47.5 192.7,50.9 190,48.8 187.3,50.9 188.3,47.5 185.5,45.4 189,45.4"
      fill="url(#star-{uid})" stroke="#ffcc00" stroke-width="0.4"
      filter="drop-shadow(0 0 1px rgba(255,200,0,0.6))"
    />
    <!-- Sparkle dots -->
    <circle cx="10"  cy="35" r="1.5" fill="#ffe566" opacity="0.85"/>
    <circle cx="188" cy="22" r="1.2" fill="#ffe566" opacity="0.75"/>
    <circle cx="194" cy="58" r="0.9" fill="#ffe566" opacity="0.6"/>
  </svg>
</div>

<style>
  .bestie-avatar {
    display: block;
    overflow: hidden;
    flex-shrink: 0;
  }
</style>
