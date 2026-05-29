<script lang="ts">
  interface Chip { emoji?: string; label: string; quiet?: boolean; }
  interface CardOption { emoji: string; label: string; sub: string; }

  type SectionKind = 'multi' | 'single' | 'card';

  interface Section {
    key: string;
    kind: SectionKind;
    icon: string;
    title: string;
    sub: string;
    privacy?: boolean;
    max?: number;
    chips?: Chip[];
    more?: Chip[];
    options?: CardOption[];
  }

  interface Props {
    onSubmit: (data: Record<string, string[]>) => void;
    onCancel?: () => void;
    onSkip?: () => void;
  }

  let { onSubmit, onCancel, onSkip }: Props = $props();

  const SECTIONS: Section[] = [
    {
      key: 'chemistry',
      kind: 'multi',
      icon: '💋',
      title: 'Chemistry & intimacy',
      sub: 'Pick any · private to you',
      privacy: true,
      chips: [
        { emoji: '💋', label: 'PDA' },
        { emoji: '😏', label: 'Teasing & flirtation' },
        { emoji: '🌹', label: 'Sensual connection' },
        { emoji: '✨', label: 'Exploring fantasies' },
        { emoji: '🔒', label: 'Prefer discretion' },
      ],
      more: [
        { emoji: '🕯', label: 'Roleplay' },
        { emoji: '🎭', label: 'Power dynamics' },
        { emoji: '🖤', label: 'BDSM-friendly' },
        { emoji: '💫', label: 'Open relationships' },
      ],
    },
    {
      key: 'lifestyle',
      kind: 'card',
      icon: '💼',
      title: 'Your current lifestyle',
      sub: 'Pick the closest match',
      options: [
        { emoji: '✅', label: 'Comfortable & established', sub: 'Stable income, settled into life' },
        { emoji: '💰', label: 'High-income lifestyle',     sub: 'Strong earner, comfortable spending' },
        { emoji: '🏢', label: 'Executive / founder',       sub: 'Senior leadership, building something' },
        { emoji: '💎', label: 'Luxury-oriented',           sub: 'Quality over quantity, premium tastes' },
        { emoji: '🤝', label: 'Confident & generous',      sub: 'Financially open with people you care about' },
      ],
    },
    {
      key: 'income',
      kind: 'single',
      icon: '💰',
      title: 'Approximate annual income',
      sub: 'Optional · only used to refine matches',
      privacy: true,
      chips: [
        { label: 'Under ₹25L' },
        { label: '₹25L – ₹50L' },
        { label: '₹50L – ₹1Cr' },
        { label: '₹1Cr – ₹3Cr' },
        { label: '₹3Cr – ₹10Cr' },
        { label: '₹10Cr+' },
        { emoji: '🔒', label: 'Prefer not to say', quiet: true },
      ],
    },
    {
      key: 'standards',
      kind: 'multi',
      icon: '🛡',
      title: 'Standards that matter',
      sub: 'Pick up to 5',
      max: 5,
      chips: [
        { emoji: '💬', label: 'Honest communication' },
        { emoji: '❤️', label: 'Emotional maturity' },
        { emoji: '🤝', label: 'Mutual respect' },
        { emoji: '🧘', label: 'Drama-free' },
        { emoji: '🌹', label: 'Consistency' },
      ],
      more: [
        { emoji: '🔒', label: 'Discretion matters' },
        { emoji: '✨', label: 'Clear expectations' },
        { emoji: '🛡', label: 'Safety & trust first' },
        { emoji: '🔍', label: 'Verified profiles preferred' },
        { emoji: '🚫', label: 'No games or manipulation' },
        { emoji: '🔐', label: 'Privacy respected' },
        { emoji: '❤️', label: 'Respect for boundaries' },
      ],
    },
  ];

  // chemistry, lifestyle, standards required; income optional
  const REQUIRED_KEYS = ['chemistry', 'lifestyle', 'standards'];

  let picks = $state<Record<string, string[]>>({
    chemistry: [], lifestyle: [], income: [], standards: [],
  });
  let expanded = $state<Record<string, boolean>>({});

  const filledCount    = $derived(SECTIONS.filter(s => (picks[s.key]?.length ?? 0) > 0).length);
  const filledRequired = $derived(REQUIRED_KEYS.filter(k => (picks[k]?.length ?? 0) > 0).length);
  const ready          = $derived(filledRequired >= REQUIRED_KEYS.length);

  function toggleMulti(key: string, label: string, max: number) {
    const cur = picks[key] ?? [];
    let next: string[];
    if (cur.includes(label))      next = cur.filter(x => x !== label);
    else if (cur.length >= max)   next = [...cur.slice(1), label];
    else                          next = [...cur, label];
    picks = { ...picks, [key]: next };
  }

  function pickSingle(key: string, label: string) {
    const cur = picks[key] ?? [];
    picks = { ...picks, [key]: cur.includes(label) ? [] : [label] };
  }
</script>

<div class="live-wrap">
  <!-- Hero -->
  <div class="hero">
    <h1 class="hero-title">How you live and what you value.</h1>
    <div class="hero-meta">
      <span>⏱</span> ~2 min · {filledCount} of 4 sections answered
    </div>
  </div>

  <!-- Sections -->
  {#each SECTIONS as section (section.key)}
    {@const sectionPicks = picks[section.key] ?? []}
    {@const filled = sectionPicks.length > 0}
    {@const isExpanded = expanded[section.key] ?? false}

    <div class="section">
      <!-- Section header -->
      <div class="section-header">
        <div class="section-left">
          <div class="section-title" class:section-title--filled={filled}>
            <span class="section-icon">{section.icon}</span>
            {section.title}
          </div>
          <div class="section-sub">
            {section.sub}
            {#if section.privacy}
              <span class="privacy-badge">🔒 Private</span>
            {/if}
          </div>
        </div>
        {#if section.max}
          <div class="count-pip" class:count-pip--filled={sectionPicks.length > 0}>
            {sectionPicks.length}<span class="count-denom">/{section.max}</span>
          </div>
        {/if}
      </div>

      <!-- Multi-chip -->
      {#if section.kind === 'multi' && section.chips}
        {@const chips = isExpanded ? [...section.chips, ...(section.more ?? [])] : section.chips}
        <div class="chips">
          {#each chips as chip (chip.label)}
            {@const isPicked = sectionPicks.includes(chip.label)}
            <button
              class="chip"
              class:chip--picked={isPicked}
              onclick={() => toggleMulti(section.key, chip.label, section.max ?? 5)}
            >
              {#if chip.emoji}<span class="chip-emoji">{chip.emoji}</span>{/if}
              <span>{chip.label}</span>
              {#if isPicked}<span class="chip-check">✓</span>{/if}
            </button>
          {/each}

          {#if (section.more?.length ?? 0) > 0 && !isExpanded}
            <button
              class="chip chip--more"
              onclick={() => { expanded = { ...expanded, [section.key]: true }; }}
            >
              <span class="chip-plus">+</span>
              <span>{section.more!.length} more</span>
            </button>
          {/if}
          {#if (section.more?.length ?? 0) > 0 && isExpanded}
            <button
              class="chip chip--fewer"
              onclick={() => { expanded = { ...expanded, [section.key]: false }; }}
            >
              Show fewer
            </button>
          {/if}
        </div>

      <!-- Single-chip (income) -->
      {:else if section.kind === 'single' && section.chips}
        <div class="chips">
          {#each section.chips as chip (chip.label)}
            {@const isPicked = sectionPicks.includes(chip.label)}
            <button
              class="chip"
              class:chip--picked={isPicked}
              class:chip--quiet={chip.quiet}
              onclick={() => pickSingle(section.key, chip.label)}
            >
              {#if chip.emoji}<span class="chip-emoji">{chip.emoji}</span>{/if}
              <span>{chip.label}</span>
              {#if isPicked}<span class="chip-check">✓</span>{/if}
            </button>
          {/each}
        </div>

      <!-- Card options (lifestyle) — rendered as chips -->
      {:else if section.kind === 'card' && section.options}
        <div class="chips">
          {#each section.options as opt (opt.label)}
            {@const isPicked = sectionPicks.includes(opt.label)}
            <button
              class="chip"
              class:chip--picked={isPicked}
              onclick={() => pickSingle(section.key, opt.label)}
            >
              <span class="chip-emoji">{opt.emoji}</span>
              <span>{opt.label}</span>
              {#if isPicked}<span class="chip-check">✓</span>{/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/each}

  <div class="spacer"></div>

  <!-- CTA -->
  <div class="cta-wrap">
    <button
      class="cta-btn"
      class:cta-btn--ready={ready}
      disabled={!ready}
      onclick={() => ready && onSubmit(picks)}
    >
      {#if ready}
        Continue →
      {:else}
        Answer the required sections ({filledRequired}/{REQUIRED_KEYS.length})
      {/if}
    </button>
    <p class="cta-hint">🔒 Income &amp; intimacy stay private. Only badges appear publicly.</p>
    {#if onSkip}
      <button class="skip-btn" onclick={onSkip}>Skip this step</button>
    {/if}
  </div>
</div>

<style>
  .live-wrap {
    display: flex;
    flex-direction: column;
    padding-bottom: 8px;
  }

  /* Hero */
  .hero {
    text-align: center;
    padding: 20px 18px 8px;
  }
  .hero-title {
    font-size: 32px;
    font-style: italic;
    font-weight: 400;
    font-family: 'Instrument Serif', 'Cormorant Garamond', Georgia, serif;
    color: var(--accent-bright);
    margin: 0 0 8px;
    letter-spacing: -0.01em;
    line-height: 1.1;
  }
  .hero-meta {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-3);
  }

  /* Section */
  .section {
    padding: 20px 0 4px;
    border-top: 1px solid var(--border-1);
  }
  .section:first-of-type {
    border-top: none;
  }
  .section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .section-left {
    flex: 1;
    min-width: 0;
  }
  .section-title {
    font-size: 22px;
    font-style: italic;
    font-weight: 400;
    font-family: 'Instrument Serif', 'Cormorant Garamond', Georgia, serif;
    color: var(--text-1);
    display: flex;
    align-items: baseline;
    gap: 7px;
    line-height: 1.2;
    transition: color 0.25s ease;
    letter-spacing: -0.005em;
  }
  .section-title--filled {
    color: var(--accent-bright);
  }
  .section-icon {
    font-style: normal;
    font-size: 20px;
  }
  .section-sub {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--text-3);
    margin-top: 4px;
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .privacy-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--border-1);
    color: var(--text-3);
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* Count pip */
  .count-pip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 5px 9px;
    border-radius: 999px;
    flex-shrink: 0;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--border-1);
    color: var(--text-3);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
    transition: all 0.2s ease;
  }
  .count-pip--filled {
    background: rgba(52, 211, 153, 0.1);
    border-color: rgba(52, 211, 153, 0.3);
    color: var(--accent-bright);
  }
  .count-denom {
    opacity: 0.55;
  }

  /* Chips */
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    background: var(--bg-2);
    border: 1.5px solid var(--border-1);
    color: var(--text-1);
    border-radius: 999px;
    font-size: 13.5px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s ease;
    line-height: 1;
  }
  .chip:active {
    transform: scale(0.97);
  }
  .chip--picked {
    background: rgba(52, 211, 153, 0.1);
    border-color: rgba(52, 211, 153, 0.5);
    color: var(--accent-bright);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(52, 211, 153, 0.18);
  }
  .chip--quiet {
    background: transparent;
    border-color: var(--border-1);
    color: var(--text-3);
  }
  .chip-emoji {
    font-size: 15px;
  }
  .chip-check {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent-bright);
  }
  .chip--more {
    background: transparent;
    border-style: dashed;
    border-color: rgba(255,255,255,0.12);
    color: rgba(244,247,251,0.38);
    font-size: 13px;
  }
  .chip-plus {
    font-size: 14px;
    line-height: 1;
  }
  .chip--fewer {
    background: transparent;
    border-color: var(--border-1);
    color: var(--text-3);
    font-size: 12.5px;
  }

  /* Cards (lifestyle) */
  .cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .card-opt {
    width: 100%;
    text-align: left;
    padding: 12px 14px;
    background: var(--bg-2);
    border: 1.5px solid var(--border-1);
    border-radius: 14px;
    color: var(--text-1);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all 0.15s ease;
    font-family: inherit;
  }
  .card-opt--picked {
    background: rgba(52, 211, 153, 0.08);
    border-color: rgba(52, 211, 153, 0.5);
    box-shadow: 0 4px 14px rgba(52, 211, 153, 0.18);
  }
  .card-opt:active {
    transform: scale(0.99);
  }
  .card-radio {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1.5px solid var(--border-1);
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }
  .card-radio--picked {
    border-color: var(--accent-bright);
    background: var(--accent-bright);
  }
  .card-radio-check {
    font-size: 10px;
    font-weight: 700;
    color: #052819;
    line-height: 1;
  }
  .card-emoji {
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
  }
  .card-text {
    flex: 1;
    min-width: 0;
  }
  .card-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    margin-bottom: 2px;
    transition: color 0.15s ease;
  }
  .card-label--picked {
    color: var(--accent-bright);
  }
  .card-sub {
    font-size: 11.5px;
    line-height: 1.3;
    color: var(--text-3);
    font-weight: 400;
  }

  /* CTA */
  .spacer {
    height: 16px;
  }
  .cta-wrap {
    padding: 0 0 4px;
  }
  .cta-btn {
    width: 100%;
    padding: 16px;
    background: rgba(52, 211, 153, 0.1);
    border: 1px solid rgba(52, 211, 153, 0.16);
    border-radius: 16px;
    color: var(--text-3);
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: not-allowed;
    transition: all 0.25s ease;
  }
  .cta-btn--ready {
    background: var(--accent-bright);
    border-color: var(--accent-bright);
    color: #052819;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(52, 211, 153, 0.28);
  }
  .cta-btn--ready:active {
    opacity: 0.88;
    transform: scale(0.98);
  }
  .cta-hint {
    margin: 10px 0 0;
    text-align: center;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--text-3);
  }
  .skip-btn {
    display: block;
    width: 100%;
    margin-top: 10px;
    padding: 10px;
    background: transparent;
    border: none;
    color: var(--text-3);
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    text-align: center;
    opacity: 0.7;
    transition: opacity 0.15s ease;
  }
  .skip-btn:active {
    opacity: 0.5;
  }
</style>
