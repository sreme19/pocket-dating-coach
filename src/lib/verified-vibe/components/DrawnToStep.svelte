<script lang="ts">
  interface Chip { emoji: string; label: string; }
  interface Section {
    key: string;
    icon: string;
    title: string;
    sub: string;
    max: number;
    chips: Chip[];
    more: Chip[];
  }

  interface Props {
    onSubmit: (picks: Record<string, string[]>) => void;
    onCancel?: () => void;
    onSkip?: () => void;
  }

  let { onSubmit, onCancel, onSkip }: Props = $props();

  const SECTIONS: Section[] = [
    {
      key: 'energy',
      icon: '✨',
      title: "Energy you're drawn to",
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '✨', label: 'Confident' },
        { emoji: '🥰', label: 'Emotionally warm' },
        { emoji: '🎭', label: 'Adventurous' },
        { emoji: '💃', label: 'Glamorous' },
        { emoji: '🔒', label: 'Discreet' },
      ],
      more: [
        { emoji: '💋', label: 'Affectionate' },
        { emoji: '😏', label: 'Flirty & playful' },
        { emoji: '🔥', label: 'Passionate' },
        { emoji: '🧲', label: 'Magnetic presence' },
      ],
    },
    {
      key: 'experiences',
      icon: '🌍',
      title: 'Experiences to share',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🌍', label: 'International travel' },
        { emoji: '🍷', label: 'Fine dining' },
        { emoji: '✈️', label: 'Spontaneous trips' },
        { emoji: '🏨', label: 'Luxury hotels' },
        { emoji: '🎨', label: 'Art & culture' },
      ],
      more: [
        { emoji: '🍾', label: 'High-end social' },
        { emoji: '🎭', label: 'VIP nightlife' },
        { emoji: '🌴', label: 'Relaxing escapes' },
        { emoji: '🚗', label: 'Exotic cars' },
      ],
    },
    {
      key: 'appreciation',
      icon: '💎',
      title: 'How appreciation lands',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '❤️', label: 'Quality time' },
        { emoji: '💬', label: 'Attention & words' },
        { emoji: '💎', label: 'Financial generosity' },
        { emoji: '🎁', label: 'Thoughtful gifting' },
        { emoji: '🕰', label: 'Consistency' },
      ],
      more: [
        { emoji: '🥂', label: 'Elevated experiences' },
        { emoji: '🛍', label: 'Luxury treatment' },
        { emoji: '🌹', label: 'Romance & affection' },
        { emoji: '💼', label: 'Supporting my ambitions' },
      ],
    },
    {
      key: 'chemistry',
      icon: '🔥',
      title: 'Chemistry you enjoy',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '⚡', label: 'Instant sparks' },
        { emoji: '😏', label: 'Flirty banter' },
        { emoji: '🕯', label: 'Slow-burn attraction' },
        { emoji: '❤️', label: 'Emotional connection first' },
        { emoji: '🔥', label: 'Passionate chemistry' },
      ],
      more: [
        { emoji: '💋', label: 'Affection & touch' },
        { emoji: '🌹', label: 'Romantic intimacy' },
        { emoji: '🍷', label: 'Sensual experiences' },
        { emoji: '🌌', label: 'Open-minded connection' },
      ],
    },
  ];

  let picks = $state<Record<string, string[]>>({
    energy: [], experiences: [], appreciation: [], chemistry: []
  });
  let expanded = $state<Record<string, boolean>>({});

  const filledSections = $derived(SECTIONS.filter(s => (picks[s.key]?.length ?? 0) > 0).length);
  const totalPicked   = $derived(SECTIONS.reduce((n, s) => n + (picks[s.key]?.length ?? 0), 0));
  const totalMax      = $derived(SECTIONS.reduce((n, s) => n + s.max, 0));
  const ready         = $derived(filledSections >= SECTIONS.length);

  function toggle(sectionKey: string, label: string, max: number) {
    const cur = picks[sectionKey] ?? [];
    let next: string[];
    if (cur.includes(label)) {
      next = cur.filter(x => x !== label);
    } else if (cur.length >= max) {
      next = [...cur.slice(1), label];
    } else {
      next = [...cur, label];
    }
    picks = { ...picks, [sectionKey]: next };
  }
</script>

<div class="drawn-wrap">
  <!-- Hero -->
  <div class="hero">
    <h1 class="hero-title">What you're drawn to.</h1>
    <div class="hero-meta">
      <span>⏱</span> ~2 min · {filledSections} of 4 sections answered
    </div>
  </div>

  <!-- Sections -->
  {#each SECTIONS as section (section.key)}
    {@const sectionPicks = picks[section.key] ?? []}
    {@const count = sectionPicks.length}
    {@const filled = count > 0}
    {@const isExpanded = expanded[section.key] ?? false}
    {@const chips = isExpanded ? [...section.chips, ...section.more] : section.chips}

    <div class="section">
      <div class="section-header">
        <div class="section-left">
          <div class="section-title" class:section-title--filled={filled}>
            <span class="section-icon">{section.icon}</span>
            {section.title}
          </div>
          <div class="section-sub">{section.sub}</div>
        </div>
        <div class="count-pip" class:count-pip--filled={count > 0}>
          {count}<span class="count-denom">/{section.max}</span>
        </div>
      </div>

      <div class="chips">
        {#each chips as chip (chip.label)}
          {@const isPicked = sectionPicks.includes(chip.label)}
          <button
            class="chip"
            class:chip--picked={isPicked}
            onclick={() => toggle(section.key, chip.label, section.max)}
          >
            <span class="chip-emoji">{chip.emoji}</span>
            <span>{chip.label}</span>
            {#if isPicked}<span class="chip-check">✓</span>{/if}
          </button>
        {/each}

        {#if section.more.length > 0 && !isExpanded}
          <button
            class="chip chip--more"
            onclick={() => { expanded = { ...expanded, [section.key]: true }; }}
          >
            <span class="chip-plus">+</span>
            <span>{section.more.length} more</span>
          </button>
        {/if}
        {#if section.more.length > 0 && isExpanded}
          <button
            class="chip chip--fewer"
            onclick={() => { expanded = { ...expanded, [section.key]: false }; }}
          >
            Show fewer
          </button>
        {/if}
      </div>
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
        Pick at least one in each ({filledSections}/{SECTIONS.length})
      {/if}
    </button>
    <p class="cta-hint">You can edit any of these later from your profile.</p>
    {#if onSkip}
      <button class="skip-btn" onclick={onSkip}>Skip this step</button>
    {/if}
  </div>
</div>

<style>
  .drawn-wrap {
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
