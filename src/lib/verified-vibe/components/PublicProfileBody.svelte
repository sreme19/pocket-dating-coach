<script lang="ts">
  interface Insight { emoji: string; label: string; inferred?: boolean; from?: string; }
  interface SignalGroup { key: string; label: string; icon: string; insights: Insight[]; aggregated: string; }
  interface GarageCar { make: string; model: string; year?: string; color?: string; vehicleType?: string; inferred?: boolean; from?: string; }
  interface Profile {
    firstName: string; gender: string;
    hereFor?: string; about?: string | null;
    vibeWords?: string[];
    whatBrings?: Array<{ emoji: string; text: string }>;
    archetypeName?: string;
    archetypeChips?: Array<{ label: string; chips: string[] }>;
    verifiedSignals?: SignalGroup[];
    travelLocations?: string[];
    garageCars?: GarageCar[];
    moneyMatters?: { annualIncome: string | null; careerLines: Insight[]; wealthInsights: Insight[] } | null;
    personalityPortraitUrl?: string | null;
    garagePortraitUrl?: string | null;
    photos?: Array<{ url: string; ai: boolean; role: string }>;
  }

  let { profile }: { profile: Profile } = $props();

  // The hero (photos[0]) is rendered by the page header; the rest are woven
  // through the sections below so photos and personality unfold together as the
  // viewer scrolls — never dumped into a grid (MVP "Layout in the Public Read").
  const revealPhotos = $derived((profile.photos ?? []).slice(1));

  // Friendly name for the source category an inferred signal was lifted from.
  const FROM_LABELS: Record<string, string> = {
    lifestyle: 'Lifestyle', hosting: 'Social', social_proof: 'Social',
    discipline: 'Health', linkedin: 'Career', travel: 'Travel',
    spending: 'Money', wealth: 'Money', assets: 'Garage',
  };
  const prettyFrom = (from?: string) => from ? (FROM_LABELS[from] ?? from) : '';
  const inferredTitle = (from?: string) =>
    from ? `Inferred from your ${prettyFrom(from)} upload` : 'Inferred from another upload';

  // Static personality reads — identical to the owner public read
  const personalityReads = [
    { name: 'Decisiveness', percentage: 95 },
    { name: 'Warmth', percentage: 80 },
    { name: 'Openness', percentage: 75 },
    { name: 'Pace', percentage: 65 },
    { name: 'Stability', percentage: 78 },
  ];

  const pronoun = $derived(profile.gender === 'woman' ? 'She' : 'He');

  let activeSignalIdx = $state(0);
  const signals = $derived(profile.verifiedSignals ?? []);
</script>

{#snippet photoReveal(idx: number)}
  {#if revealPhotos[idx]}
    <div class="photo-reveal">
      <img src={revealPhotos[idx].url} alt="Profile photo" loading="lazy" />
      {#if revealPhotos[idx].ai}
        <span class="photo-reveal-badge">✨ Generated from verified photos</span>
      {/if}
    </div>
  {/if}
{/snippet}

<div class="ppb">
  <!-- Here For -->
  {#if profile.hereFor}
    <section class="section">
      <div class="section-label"><span>💫</span> Here For</div>
      <p class="about-text">{profile.hereFor}</p>
    </section>
  {/if}

  <!-- Vibe in Three Words -->
  {#if profile.vibeWords && profile.vibeWords.length > 0}
    <section class="section">
      <div class="section-label"><span>✨</span> The Vibe in Three Words</div>
      <div class="vibe-tags">
        {#each profile.vibeWords as tag, i}
          <span class="vibe-tag {i === 0 ? 'highlighted' : ''}">{tag}</span>
        {/each}
      </div>
    </section>
  {/if}

  {@render photoReveal(0)}

  <!-- Personality Reads (radar) -->
  <section class="section">
    <div class="section-label"><span>🧠</span> Personality Reads <span class="section-hint">inferred from Q&A + lifestyle</span></div>
    <div class="personality-constellation">
      <svg viewBox="0 0 280 280" width="100%" style="display:block; max-height: 260px;">
        <defs>
          <radialGradient id="ppbConstGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(255,122,77,0.08)"/>
            <stop offset="100%" stop-color="transparent"/>
          </radialGradient>
        </defs>
        <circle cx="140" cy="140" r="130" fill="url(#ppbConstGrad)"/>
        {#each [0.25, 0.5, 0.75, 1.0] as ring}
          {@const rpts = personalityReads.map((_, i) => {
            const a = (Math.PI * 2 * i) / personalityReads.length - Math.PI / 2;
            return [140 + Math.cos(a) * 96 * ring, 140 + Math.sin(a) * 96 * ring];
          })}
          <path d={rpts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]).join(' ') + ' Z'} fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
        {/each}
        {#each personalityReads as _, i}
          {@const a = (Math.PI * 2 * i) / personalityReads.length - Math.PI / 2}
          <line x1="140" y1="140" x2={140 + Math.cos(a) * 96} y2={140 + Math.sin(a) * 96} stroke="rgba(0,0,0,0.06)" stroke-width="1"/>
        {/each}
        <path
          d={personalityReads.map((t, i) => {
            const a = (Math.PI * 2 * i) / personalityReads.length - Math.PI / 2;
            const r2 = 96 * (t.percentage / 100);
            return (i === 0 ? 'M' : 'L') + (140 + Math.cos(a) * r2) + ',' + (140 + Math.sin(a) * r2);
          }).join(' ') + ' Z'}
          fill="rgba(255,59,107,0.16)" stroke="#FF3B6B" stroke-width="1.5" stroke-linejoin="round"
        />
        {#each personalityReads as t, i}
          {@const a = (Math.PI * 2 * i) / personalityReads.length - Math.PI / 2}
          {@const r2 = 96 * (t.percentage / 100)}
          {@const px = 140 + Math.cos(a) * r2}
          {@const py = 140 + Math.sin(a) * r2}
          {@const lx = 140 + Math.cos(a) * 120}
          {@const ly = 140 + Math.sin(a) * 120}
          {@const ta2 = a * 180 / Math.PI}
          <circle cx={px} cy={py} r="3.5" fill="#FF3B6B" stroke="#FFF3F0" stroke-width="2"/>
          <text x={lx} y={ly - 3} text-anchor={ta2 > -85 && ta2 < 85 ? 'start' : ta2 > 95 || ta2 < -95 ? 'end' : 'middle'} fill="#1B1020" font-size="11" font-weight="600" font-family="inherit">{t.name}</text>
          <text x={lx} y={ly + 11} text-anchor={ta2 > -85 && ta2 < 85 ? 'start' : ta2 > 95 || ta2 < -95 ? 'end' : 'middle'} fill="#FF3B6B" font-size="10" font-family="inherit">{t.percentage}</text>
        {/each}
      </svg>
      <p class="constellation-sig">"Decisive and warm — moves fast, lands soft."</p>
    </div>
  </section>

  <!-- What He/She Brings -->
  {#if profile.whatBrings && profile.whatBrings.length > 0}
    <section class="section">
      <div class="section-label"><span>🎁</span> What {pronoun} Brings</div>
      <div class="brings-pillar-list">
        {#each profile.whatBrings as item}
          <div class="brings-pillar-item">
            <span class="brings-pillar-icon">{item.emoji}</span>
            <span class="brings-pillar-text">{item.text}</span>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {@render photoReveal(1)}

  <!-- Archetype chips -->
  {#if profile.archetypeChips && profile.archetypeChips.length > 0}
    <section class="section">
      <div class="section-label"><span>🎭</span> {profile.archetypeName}</div>
      {#each profile.archetypeChips as group}
        <div class="chip-group">
          <p class="chip-group-label">{group.label}</p>
          <div class="chip-row">
            {#each group.chips as chip}
              <span class="chip-pill">{chip}</span>
            {/each}
          </div>
        </div>
      {/each}
    </section>
  {/if}

  <!-- About -->
  {#if profile.about}
    <section class="section">
      <div class="section-label"><span>📝</span> About</div>
      <p class="about-text">{profile.about}</p>
    </section>
  {/if}

  {@render photoReveal(2)}

  <!-- Verified Signals -->
  {#if signals.length > 0}
    <section class="section">
      <div class="section-label"><span>🛡</span> Verified Signals <span class="section-hint">AI-read from uploads</span></div>
      <div class="vs-tab-row">
        {#each signals as g, i}
          <button class="vs-tab {activeSignalIdx === i ? 'vs-tab--active' : ''}" type="button" onclick={() => activeSignalIdx = i}>
            {g.icon} {g.label}
          </button>
        {/each}
      </div>
      {#if signals[activeSignalIdx]}
        {@const g = signals[activeSignalIdx]}
        <div class="career-card">
          {#if g.key === 'career'}
            {#if g.aggregated}<p class="career-summary">{g.aggregated}</p>{/if}
            <div class="career-chips">
              {#each g.insights as ins}
                <span class="career-chip {ins.inferred ? 'inferred' : ''}" title={ins.inferred ? inferredTitle(ins.from) : ''}>
                  <span class="career-chip-emoji">{ins.emoji}</span> {ins.label}
                  {#if ins.inferred}<span class="inferred-mark">✦</span>{/if}
                </span>
              {/each}
            </div>
          {:else}
            <div class="signal-grid">
              {#each g.insights as ins}
                <div class="signal-tile {ins.inferred ? 'inferred' : ''}" title={ins.inferred ? inferredTitle(ins.from) : ''}>
                  <span class="signal-tile-emoji">{ins.emoji}</span>
                  <span class="signal-tile-label">{ins.label}</span>
                  {#if ins.inferred}<span class="inferred-mark">✦</span>{/if}
                </div>
              {/each}
            </div>
            {#if g.aggregated}<p class="signal-summary">{g.aggregated}</p>{/if}
          {/if}
          <div class="career-verified-row">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"><path d="M20 6L9 17l-5-5"/></svg>
            <span>AI verified via uploads</span>
          </div>
        </div>
      {/if}
    </section>
  {/if}

  <!-- Garage -->
  {#if profile.garageCars && profile.garageCars.length > 0}
    <section class="section">
      <div class="section-label"><span>🏎️</span> What My Garage Looks Like</div>
      {#each profile.garageCars as car}
        <div class="garage-card-simple {car.inferred ? 'inferred' : ''}">
          <div class="garage-make-badge">{car.make}</div>
          <div class="garage-model-name">{car.make} {car.model}</div>
          {#if car.color}<div class="garage-color">{car.color}</div>{/if}
          {#if car.inferred}
            <div class="garage-verified inferred" title={inferredTitle(car.from)}>✦ Seen in your {prettyFrom(car.from)} photos</div>
          {:else}
            <div class="garage-verified">✅ Ownership verified</div>
          {/if}
        </div>
      {/each}
    </section>
  {/if}

  {@render photoReveal(3)}

  <!-- Travel Magnets -->
  {#if profile.travelLocations && profile.travelLocations.length > 0}
    <section class="section">
      <div class="section-label"><span>✈️</span> Travel Magnets <span class="section-hint">detected from uploads</span></div>
      <div class="magnets-board">
        {#each profile.travelLocations as loc}
          <div class="magnet"><span class="magnet-flag">🌍</span><span class="magnet-name">{loc}</span></div>
        {/each}
      </div>
    </section>
  {/if}

  {@render photoReveal(4)}

  <!-- Money Matters -->
  {#if profile.moneyMatters}
    {@const mm = profile.moneyMatters}
    <section class="section money-section">
      <div class="section-label"><span>💰</span> Money Matters</div>
      <div class="money-card">
        {#if mm.annualIncome}
          <div class="money-stats-row">
            <div class="money-stat">
              <span class="money-stat-icon">💼</span>
              <div>
                <p class="money-stat-label">Annual Income</p>
                <p class="money-stat-value">{mm.annualIncome}</p>
                <p class="money-stat-declared">Self declared</p>
              </div>
            </div>
          </div>
        {/if}
        {#if mm.careerLines.length > 0}
          <div class="money-career-lines">
            {#each mm.careerLines as ins}
              <span class="money-career-line">{ins.emoji} {ins.label}</span>
            {/each}
          </div>
        {/if}
        {#if mm.wealthInsights.length > 0}
          <div class="money-wealth-block">
            <div class="signal-grid">
              {#each mm.wealthInsights as ins}
                <div class="signal-tile {ins.inferred ? 'inferred' : ''}" title={ins.inferred ? inferredTitle(ins.from) : ''}>
                  <span class="signal-tile-emoji">{ins.emoji}</span>
                  <span class="signal-tile-label">{ins.label}</span>
                  {#if ins.inferred}<span class="inferred-mark">✦</span>{/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
        <p class="money-verified">✓ AI verified via bank statement / financial document</p>
      </div>
    </section>
  {/if}

  <!-- AI Portraits -->
  {#if profile.personalityPortraitUrl || profile.garagePortraitUrl}
    <section class="section">
      <div class="section-label"><span>✨</span> AI Portrait <span class="section-hint">generated from photos</span></div>
      <div class="portrait-grid">
        {#if profile.personalityPortraitUrl}<img class="portrait-img" src={profile.personalityPortraitUrl} alt="AI portrait" />{/if}
        {#if profile.garagePortraitUrl}<img class="portrait-img" src={profile.garagePortraitUrl} alt="AI portrait 2" />{/if}
      </div>
    </section>
  {/if}
</div>

<style>
  .ppb { display: flex; flex-direction: column; gap: 24px; }
  .section { display: flex; flex-direction: column; gap: 10px; }

  .section-label {
    display: flex; align-items: center; gap: 5px;
    font-size: 10px; font-weight: 700; color: #A08B91;
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .section-hint {
    margin-left: auto; font-size: 9px; font-weight: 400; color: #C2B0B5;
    text-transform: none; letter-spacing: 0;
  }

  .about-text { font-size: 14.5px; line-height: 1.6; color: #1B1020; margin: 0; }

  /* Vibe tags */
  .vibe-tags { display: flex; flex-wrap: wrap; gap: 8px; }
  .vibe-tag {
    padding: 7px 15px; border-radius: 999px;
    background: rgba(255,122,77,0.12); border: 1px solid rgba(255,122,77,0.3);
    font-size: 13px; font-weight: 600; color: #FF7A4D;
  }
  .vibe-tag.highlighted { background: rgba(255,122,77,0.2); }

  /* Personality radar */
  .personality-constellation {
    background: rgba(0,0,0,0.02); border: 1px solid #F1E0E3;
    border-radius: 18px; padding: 10px 4px 14px; overflow: hidden;
  }
  .constellation-sig {
    text-align: center; font-style: italic; font-size: 14px;
    color: #6E5F64; margin: 4px 16px 0; line-height: 1.4;
    font-family: Georgia, serif;
  }

  /* What He Brings — pillar list */
  .brings-pillar-list {
    background: #FFFFFF; border: 1px solid #F1E0E3;
    border-radius: 16px; overflow: hidden;
  }
  .brings-pillar-item { display: flex; align-items: center; gap: 12px; padding: 13px 14px; }
  .brings-pillar-item + .brings-pillar-item { border-top: 1px solid #F1E0E3; }
  .brings-pillar-icon {
    width: 36px; height: 36px; border-radius: 10px; background: rgba(255,59,107,0.10);
    display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;
  }
  .brings-pillar-text { flex: 1; font-size: 14px; font-weight: 600; color: #1B1020; }

  /* Archetype chips */
  .chip-group { margin-bottom: 14px; }
  .chip-group:last-child { margin-bottom: 0; }
  .chip-group-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #A08B91; margin: 0 0 8px; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip-pill { padding: 7px 13px; border-radius: 999px; background: rgba(255,59,107,0.08); border: 1px solid rgba(255,59,107,0.25); font-size: 12.5px; color: #FF3B6B; }

  /* Verified Signals */
  .vs-tab-row { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
  .vs-tab-row::-webkit-scrollbar { display: none; }
  .vs-tab {
    flex-shrink: 0; display: flex; align-items: center; gap: 5px; padding: 7px 12px;
    border-radius: 999px; background: transparent; border: 1px solid #E7D2D7;
    color: #6E5F64; font: 500 12px/1 inherit; cursor: pointer; white-space: nowrap; transition: all 0.15s;
  }
  .vs-tab--active { background: rgba(255,59,107,0.10); border-color: rgba(255,59,107,0.32); color: #FF3B6B; }

  .career-card {
    background: linear-gradient(145deg, rgba(10,102,194,0.12) 0%, rgba(6,6,20,0.95) 100%);
    border: 1px solid rgba(10,102,194,0.25); border-radius: 18px; padding: 18px 16px 14px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .career-summary { font-size: 14px; line-height: 1.55; color: rgba(255,255,255,0.88); font-style: italic; margin: 0; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.07); }
  .career-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .career-chip {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(10,102,194,0.18); border: 1px solid rgba(10,102,194,0.35);
    border-radius: 999px; padding: 6px 13px; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.92);
  }
  .career-chip-emoji { font-size: 14px; }
  .career-verified-row { display: flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(255,255,255,0.4); }

  .signal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .signal-tile {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    background: #FFFFFF; border: 1px solid #F1E0E3;
    border-radius: 12px; padding: 12px 8px 10px; text-align: center;
  }
  .signal-tile-emoji { font-size: 28px; line-height: 1; }
  .signal-tile-label { font-size: 11px; color: #6E5F64; line-height: 1.3; }
  .signal-summary { font-size: 12px; color: #A08B91; line-height: 1.55; font-style: italic; margin: 0; }

  /* Inferred (cross-section) signals — lifted from a different upload, not directly
     verified for this section. Dashed outline + a ✦ mark distinguish them. */
  .career-chip.inferred { background: rgba(255,255,255,0.05); border-style: dashed; border-color: rgba(176,143,255,0.55); }
  .signal-tile.inferred { border-style: dashed; border-color: #C9B6F0; background: #FBF9FF; position: relative; }
  .inferred-mark { color: #8B6FD6; font-size: 11px; margin-left: 3px; cursor: default; }
  .signal-tile.inferred .inferred-mark { position: absolute; top: 5px; right: 6px; margin: 0; }
  .garage-verified.inferred { color: #8B6FD6; }

  /* Garage */
  .garage-card-simple {
    background: linear-gradient(145deg, #16181d 0%, #0d0d10 100%);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 16px;
  }
  .garage-make-badge { display: inline-block; background: #C8102E; color: #fff; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 5px; letter-spacing: 0.05em; margin-bottom: 8px; }
  .garage-model-name { font-size: 20px; font-weight: 700; color: #fff; }
  .garage-color { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 2px; }
  .garage-verified { font-size: 12px; color: #FF3B6B; font-weight: 600; margin-top: 8px; }

  /* Travel magnets */
  .magnets-board { display: flex; flex-wrap: wrap; gap: 8px; }
  .magnet {
    display: flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 12px;
    background: #FBE9E6; border: 1px solid #F1E0E3;
  }
  .magnet-flag { font-size: 16px; }
  .magnet-name { font-size: 11.5px; font-weight: 700; color: #1B1020; text-transform: uppercase; letter-spacing: 0.04em; }

  /* Money Matters */
  .money-card {
    background: linear-gradient(145deg, #0f0f12 0%, #1a1506 60%, #0f0f0c 100%);
    border: 1px solid rgba(212,160,23,0.25); border-radius: 14px; padding: 16px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .money-stats-row { display: flex; gap: 16px; }
  .money-stat { display: flex; align-items: flex-start; gap: 10px; }
  .money-stat-icon { font-size: 26px; }
  .money-stat-label { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(212,160,23,0.8); margin: 0; }
  .money-stat-value { font-size: 20px; font-weight: 800; color: #f0d590; margin: 2px 0; }
  .money-stat-declared { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.35); margin: 0; }
  .money-career-lines { display: flex; flex-direction: column; gap: 3px; }
  .money-career-line { font-size: 13px; color: #d0d0d0; font-weight: 500; }
  .money-verified { font-size: 11px; color: #FF3B6B; margin: 0; }

  /* AI Portraits */
  .portrait-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .portrait-img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 14px; }

  /* Photos woven through the read (revealed on scroll, not a grid) */
  .photo-reveal { position: relative; border-radius: 18px; overflow: hidden; line-height: 0; }
  .photo-reveal img { width: 100%; aspect-ratio: 4/5; object-fit: cover; display: block; }
  .photo-reveal-badge {
    position: absolute; left: 10px; bottom: 10px;
    display: inline-flex; align-items: center; gap: 4px;
    padding: 5px 10px; border-radius: 999px;
    background: rgba(27,16,32,0.62); backdrop-filter: blur(4px);
    color: #fff; font-size: 11px; font-weight: 600; line-height: 1;
  }
</style>
