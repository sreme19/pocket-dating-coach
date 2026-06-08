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
    archetype?: string;
    onSubmit: (data: Record<string, string[]>) => void;
    onCancel?: () => void;
    onSkip?: () => void;
  }

  let { archetype = '', onSubmit, onCancel, onSkip }: Props = $props();

  // ── Casual Generous Man ───────────────────────────────────────────────────
  const SECTIONS_CASUAL_MAN: Section[] = [
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
  const REQUIRED_CASUAL_MAN = ['chemistry', 'lifestyle', 'standards'];

  // ── Spoiled Casual Woman ──────────────────────────────────────────────────
  const SECTIONS_SPOILED_CASUAL: Section[] = [
    {
      key: 'vibe',
      kind: 'card',
      icon: '✨',
      title: 'Your day-to-day vibe',
      sub: 'Pick the closest match',
      options: [
        { emoji: '💅', label: 'Low-key luxury',       sub: 'Selective, private, effortlessly elevated' },
        { emoji: '🌸', label: 'Social & spontaneous', sub: 'Love going out, meeting people, staying active' },
        { emoji: '🏠', label: 'Homebody at heart',    sub: 'Comfort-first — cosy > chaotic' },
        { emoji: '✈️', label: 'Always on the move',  sub: 'Travel, events, never really settling in one place' },
        { emoji: '🌊', label: 'Balanced & relaxed',   sub: 'Mix of both — depends on the week' },
      ],
    },
    {
      key: 'how_you_like_to_be_treated',
      kind: 'multi',
      icon: '💎',
      title: 'How you like to be treated',
      sub: 'Pick up to 4',
      max: 4,
      chips: [
        { emoji: '🎁', label: 'Thoughtful gifting' },
        { emoji: '🌹', label: 'Consistent romance' },
        { emoji: '💬', label: 'Undivided attention' },
        { emoji: '✈️', label: 'Elevated experiences' },
        { emoji: '🛍', label: 'Generous without being asked' },
      ],
      more: [
        { emoji: '🍾', label: 'Surprise upgrades' },
        { emoji: '🚗', label: 'Picked up & dropped off' },
        { emoji: '🏨', label: 'Nice hotels, no questions' },
        { emoji: '💐', label: 'Small gestures that show effort' },
      ],
    },
    {
      key: 'standards',
      kind: 'multi',
      icon: '🛡',
      title: 'Standards you hold',
      sub: 'Pick up to 5',
      max: 5,
      chips: [
        { emoji: '🔒', label: 'Discretion matters' },
        { emoji: '🧘', label: 'Drama-free only' },
        { emoji: '💬', label: 'Honest & direct' },
        { emoji: '🤝', label: 'Mutual respect' },
        { emoji: '🚫', label: 'No games or pressure' },
      ],
      more: [
        { emoji: '✅', label: 'Clear expectations from the start' },
        { emoji: '🔐', label: 'Privacy respected' },
        { emoji: '🛡', label: 'Safety & trust first' },
        { emoji: '❤️', label: 'Respects my boundaries' },
        { emoji: '🔍', label: 'Verified profiles preferred' },
      ],
    },
    {
      key: 'chemistry',
      kind: 'multi',
      icon: '💋',
      title: 'Chemistry & connection',
      sub: 'Pick any · private to you',
      privacy: true,
      chips: [
        { emoji: '😏', label: 'Playful flirtation' },
        { emoji: '💋', label: 'Natural affection' },
        { emoji: '🕯', label: 'Slow-burn tension' },
        { emoji: '🌹', label: 'Romance over rush' },
        { emoji: '🔒', label: 'Prefer discretion' },
      ],
      more: [
        { emoji: '⚡', label: 'Instant spark' },
        { emoji: '🥂', label: 'Good conversation first' },
        { emoji: '🌌', label: 'Open-minded connection' },
        { emoji: '💫', label: 'Keep it casual' },
      ],
    },
  ];
  const REQUIRED_SPOILED_CASUAL = ['vibe', 'standards', 'chemistry'];

  // ── Hopeless Romantic ─────────────────────────────────────────────────────
  const SECTIONS_ROMANTIC: Section[] = [
    {
      key: 'emotional_openness',
      kind: 'card',
      icon: '🫀',
      title: 'How open are you emotionally?',
      sub: 'Pick the closest to where you are',
      options: [
        { emoji: '💚', label: 'Fully open and ready', sub: 'Heart on my sleeve — I dive in' },
        { emoji: '🌱', label: 'Cautiously open', sub: 'Open, but I take time to trust' },
        { emoji: '🕊', label: 'Getting there', sub: 'Working on opening up more' },
        { emoji: '🧱', label: 'Selective', sub: 'Only open with the right person' },
      ],
    },
    {
      key: 'how_you_show_up',
      kind: 'multi',
      icon: '💬',
      title: 'How you show up in a relationship',
      sub: 'Pick up to 4',
      max: 4,
      chips: [
        { emoji: '📅', label: 'Daily check-ins' },
        { emoji: '💬', label: 'Deep conversations' },
        { emoji: '❤️', label: 'Expressing feelings naturally' },
        { emoji: '🙌', label: 'Acts of care and service' },
        { emoji: '🧠', label: 'Remembering what matters to them' },
      ],
      more: [
        { emoji: '🎁', label: 'Thoughtful surprises' },
        { emoji: '📞', label: 'Being available when needed' },
        { emoji: '🌹', label: 'Grand romantic gestures' },
        { emoji: '🤫', label: 'Showing love quietly but deeply' },
      ],
    },
    {
      key: 'what_youre_done_with',
      kind: 'multi',
      icon: '🚫',
      title: 'What you\'re done settling for',
      sub: 'Pick up to 4 · private',
      privacy: true,
      max: 4,
      chips: [
        { emoji: '🧊', label: 'Emotional unavailability' },
        { emoji: '🎭', label: 'Surface-level connections' },
        { emoji: '❓', label: 'Mixed signals' },
        { emoji: '🪞', label: 'Being an afterthought' },
        { emoji: '🌡', label: 'Hot and cold behaviour' },
      ],
      more: [
        { emoji: '😶', label: 'One-sided effort' },
        { emoji: '💬', label: 'People who can\'t communicate' },
        { emoji: '🚪', label: 'Half-in, half-out energy' },
        { emoji: '🥀', label: 'Love that drains instead of fills' },
      ],
    },
    {
      key: 'standards',
      kind: 'multi',
      icon: '🌟',
      title: 'Relationship standards',
      sub: 'Pick up to 5',
      max: 5,
      chips: [
        { emoji: '❤️', label: 'Emotional availability' },
        { emoji: '💬', label: 'Consistent communication' },
        { emoji: '🛡️', label: 'Faithfulness and loyalty' },
        { emoji: '🌟', label: 'Making each other a priority' },
        { emoji: '🏠', label: 'Being each other\'s safe place' },
      ],
      more: [
        { emoji: '🤝', label: 'Mutual respect' },
        { emoji: '🌹', label: 'Intentional romance' },
        { emoji: '🧘', label: 'Drama-free love' },
        { emoji: '🔑', label: 'Growing together' },
        { emoji: '🧠', label: 'Emotional intelligence' },
      ],
    },
  ];
  const REQUIRED_ROMANTIC = ['emotional_openness', 'how_you_show_up', 'standards'];

  // ── Forever Focused ───────────────────────────────────────────────────────
  const SECTIONS_FOREVER: Section[] = [
    {
      key: 'life_stage',
      kind: 'card',
      icon: '🚀',
      title: 'Where you are in life',
      sub: 'Pick the closest match',
      options: [
        { emoji: '🏗', label: 'Building my career and future', sub: 'Ambitious, still setting up the foundation' },
        { emoji: '✅', label: 'Established and ready to settle', sub: 'In a great place — ready for the next chapter' },
        { emoji: '⚖️', label: 'Balancing ambition and personal life', sub: 'Growing professionally, ready emotionally' },
        { emoji: '🎯', label: 'Completely ready to commit now', sub: 'Done waiting — looking for the right person' },
      ],
    },
    {
      key: 'timeline',
      kind: 'single',
      icon: '📅',
      title: 'Your timeline',
      sub: 'When are you ready to commit?',
      chips: [
        { emoji: '⚡', label: 'Ready now' },
        { emoji: '📅', label: 'Within this year' },
        { emoji: '🌱', label: 'In the next few years' },
        { emoji: '🌊', label: 'When the right person comes' },
      ],
    },
    {
      key: 'non_negotiables',
      kind: 'multi',
      icon: '🔑',
      title: 'Non-negotiables',
      sub: 'Pick up to 4 · private',
      privacy: true,
      max: 4,
      chips: [
        { emoji: '🛡️', label: 'Loyalty' },
        { emoji: '👨‍👩‍👧', label: 'Aligned on children' },
        { emoji: '💰', label: 'Financial responsibility' },
        { emoji: '💬', label: 'Honest communication' },
        { emoji: '🧘', label: 'Emotional maturity' },
      ],
      more: [
        { emoji: '🚫', label: 'No games' },
        { emoji: '🌟', label: 'Consistent effort' },
        { emoji: '🏡', label: 'Family-oriented' },
        { emoji: '📈', label: 'Growth mindset' },
        { emoji: '🤝', label: 'Mutual respect' },
      ],
    },
    {
      key: 'relationship_approach',
      kind: 'multi',
      icon: '🎯',
      title: 'Relationship approach',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🎯', label: 'Intentional dating from day one' },
        { emoji: '💬', label: 'Direct about what I want' },
        { emoji: '🚫', label: 'No casual involvement' },
        { emoji: '🌱', label: 'Patient but purposeful' },
        { emoji: '🧭', label: 'Looking for my person — not a placeholder' },
      ],
      more: [
        { emoji: '📋', label: 'Clear expectations early' },
        { emoji: '🤝', label: 'Partnership mentality' },
        { emoji: '📈', label: 'Building something great' },
      ],
    },
  ];
  const REQUIRED_FOREVER = ['life_stage', 'timeline', 'relationship_approach'];

  // ── Traditional Matrimony ─────────────────────────────────────────────────
  const SECTIONS_MATRIMONY: Section[] = [
    {
      key: 'marital_status',
      kind: 'single',
      icon: '💍',
      title: 'Your marital status',
      sub: 'Select one',
      chips: [
        { emoji: '✨', label: 'Never married' },
        { emoji: '🔄', label: 'Divorced' },
        { emoji: '🕊', label: 'Widowed' },
      ],
    },
    {
      key: 'religion',
      kind: 'single',
      icon: '🕌',
      title: 'Your religion',
      sub: 'Select one',
      chips: [
        { emoji: '🕉', label: 'Hindu' },
        { emoji: '☪️', label: 'Muslim' },
        { emoji: '✝️', label: 'Christian' },
        { emoji: '🔱', label: 'Sikh' },
        { emoji: '☸️', label: 'Buddhist' },
        { emoji: '🔶', label: 'Jain' },
        { emoji: '🌐', label: 'Other' },
      ],
    },
    {
      key: 'lifestyle',
      kind: 'multi',
      icon: '🌿',
      title: 'Your lifestyle',
      sub: 'Select all that apply',
      chips: [
        { emoji: '🥗', label: 'Vegetarian' },
        { emoji: '🚭', label: 'Non-smoker' },
        { emoji: '🚱', label: 'Non-drinker' },
        { emoji: '🙏', label: 'Religiously practicing' },
        { emoji: '👨‍👩‍👧', label: 'Family-oriented' },
        { emoji: '💪', label: 'Fitness-focused' },
      ],
    },
    {
      key: 'income',
      kind: 'single',
      icon: '💰',
      title: 'Annual income (optional)',
      sub: 'Helps with serious matrimony matching',
      privacy: true,
      chips: [
        { label: 'Under ₹5L' },
        { label: '₹5L – ₹10L' },
        { label: '₹10L – ₹25L' },
        { label: '₹25L – ₹50L' },
        { label: '₹50L+' },
        { emoji: '🔒', label: 'Prefer not to say', quiet: true },
      ],
    },
  ];
  const REQUIRED_MATRIMONY = ['marital_status', 'religion', 'lifestyle'];

  // ── Rebound / Healing ─────────────────────────────────────────────────────
  const SECTIONS_REBOUND: Section[] = [
    {
      key: 'where_you_are',
      kind: 'card',
      icon: '🌱',
      title: 'Where you are right now',
      sub: 'Be honest — it helps us match well',
      options: [
        { emoji: '🌱', label: 'Just starting to explore again', sub: 'Very early days — nothing intense' },
        { emoji: '🏊', label: 'Dipping my toes in', sub: 'Curious and a little cautious' },
        { emoji: '🌿', label: 'Getting more comfortable', sub: 'More ready than I was' },
        { emoji: '✅', label: 'Ready but taking it slow', sub: 'Healed enough — just careful' },
      ],
    },
    {
      key: 'what_you_need',
      kind: 'multi',
      icon: '🤲',
      title: 'What you need',
      sub: 'Pick up to 4',
      max: 4,
      chips: [
        { emoji: '⏳', label: 'Patience with my pace' },
        { emoji: '🚫', label: 'No pressure to define anything' },
        { emoji: '💬', label: 'Honest and real connection' },
        { emoji: '☕', label: 'Good company without expectations' },
        { emoji: '🕊', label: 'Someone who gets it' },
      ],
      more: [
        { emoji: '🤫', label: 'Space when I need it' },
        { emoji: '😊', label: 'Easy, low-key interactions' },
        { emoji: '🧘', label: 'Zero drama' },
        { emoji: '💛', label: 'Warmth without obligation' },
      ],
    },
    {
      key: 'comfort_level',
      kind: 'single',
      icon: '🌡',
      title: 'Your comfort level',
      sub: 'Where are you at?',
      chips: [
        { emoji: '☕', label: 'Very casual interactions only' },
        { emoji: '📱', label: 'Friendly texting and meetups' },
        { emoji: '🌱', label: 'Something that could grow slowly' },
        { emoji: '🚪', label: 'Open but absolutely no rushing' },
      ],
    },
    {
      key: 'standards',
      kind: 'multi',
      icon: '🛡',
      title: 'Standards you hold',
      sub: 'Pick up to 4',
      max: 4,
      chips: [
        { emoji: '💬', label: 'Honesty' },
        { emoji: '🧘', label: 'Drama-free' },
        { emoji: '⚓', label: 'Emotional steadiness' },
        { emoji: '🤝', label: 'Respects where I\'m at' },
        { emoji: '🚫', label: 'No manipulation' },
      ],
      more: [
        { emoji: '🕊', label: 'Patient without resentment' },
        { emoji: '💬', label: 'Direct and honest' },
        { emoji: '🌿', label: 'Low-pressure energy' },
        { emoji: '❤️', label: 'Genuine care' },
      ],
    },
  ];
  const REQUIRED_REBOUND = ['where_you_are', 'what_you_need', 'comfort_level'];

  // ── Untouched Heart ───────────────────────────────────────────────────────
  const SECTIONS_UNTOUCHED: Section[] = [
    {
      key: 'experience_level',
      kind: 'card',
      icon: '🕊️',
      title: 'Where you\'re coming from',
      sub: 'Be yourself — this is a judgement-free zone',
      options: [
        { emoji: '🌟', label: 'Complete beginner — owning it', sub: 'Zero experience, totally okay with that' },
        { emoji: '🌱', label: 'Had a little, nothing serious', sub: 'Dipped a toe in but never really dated' },
        { emoji: '🧭', label: 'Still figuring out what I want', sub: 'Exploring what dating even means for me' },
        { emoji: '✅', label: 'Ready to genuinely try', sub: 'Decided this is the time' },
      ],
    },
    {
      key: 'what_excites_you',
      kind: 'multi',
      icon: '🌸',
      title: 'What excites you about this',
      sub: 'Pick up to 4',
      max: 4,
      chips: [
        { emoji: '✨', label: 'Meeting someone new' },
        { emoji: '🌱', label: 'Real first-time experiences' },
        { emoji: '🔍', label: 'Figuring out how this all works' },
        { emoji: '💎', label: 'Finding someone genuine' },
        { emoji: '🗺', label: 'An adventure I haven\'t been on' },
      ],
      more: [
        { emoji: '💬', label: 'Having real conversations' },
        { emoji: '🧩', label: 'Learning about myself through this' },
        { emoji: '🤝', label: 'A connection that feels safe' },
        { emoji: '🌟', label: 'Seeing what\'s possible' },
      ],
    },
    {
      key: 'what_you_need',
      kind: 'multi',
      icon: '🤲',
      title: 'What you need',
      sub: 'Pick up to 4',
      max: 4,
      chips: [
        { emoji: '⏳', label: 'Patience' },
        { emoji: '🌊', label: 'No pressure' },
        { emoji: '💎', label: 'Someone as sincere as me' },
        { emoji: '🌸', label: 'A gentle start' },
        { emoji: '🚫', label: 'No games or confusion' },
      ],
      more: [
        { emoji: '💬', label: 'Clear and honest communication' },
        { emoji: '🤗', label: 'Warmth without overwhelming' },
        { emoji: '🛡', label: 'Safety to be exactly where I am' },
      ],
    },
    {
      key: 'values',
      kind: 'multi',
      icon: '💙',
      title: 'What matters most to you',
      sub: 'Pick up to 4',
      max: 4,
      chips: [
        { emoji: '💬', label: 'Honesty above everything' },
        { emoji: '🤍', label: 'Kindness' },
        { emoji: '🚫', label: 'No games' },
        { emoji: '🌊', label: 'Taking time' },
        { emoji: '🌟', label: 'Being genuinely real' },
      ],
      more: [
        { emoji: '🙏', label: 'Respect' },
        { emoji: '💛', label: 'Warmth' },
        { emoji: '✅', label: 'Sincerity over polish' },
        { emoji: '🤝', label: 'Mutual curiosity' },
      ],
    },
  ];
  const REQUIRED_UNTOUCHED = ['experience_level', 'what_excites_you', 'what_you_need'];

  // ── Second Chapter ────────────────────────────────────────────────────────
  const SECTIONS_SECOND_CHAPTER: Section[] = [
    {
      key: 'where_you_are',
      kind: 'card',
      icon: '🔄',
      title: 'Where you are right now',
      sub: 'Pick the most honest answer',
      options: [
        { emoji: '✅', label: 'Genuinely ready — learned and grown', sub: 'Done processing, clear on who I am now' },
        { emoji: '🌿', label: 'Ready with a healthy perspective', sub: 'Past it — open and grounded' },
        { emoji: '🚪', label: 'Careful but open', sub: 'Willing, just not rushing in' },
        { emoji: '🌱', label: 'Hopeful, going slowly', sub: 'Optimistic but taking my time' },
      ],
    },
    {
      key: 'what_is_different',
      kind: 'multi',
      icon: '💡',
      title: 'What\'s different this time',
      sub: 'Pick up to 4',
      max: 4,
      chips: [
        { emoji: '🧘', label: 'I know myself better' },
        { emoji: '🚫', label: 'Not carrying the past' },
        { emoji: '🔍', label: 'I know what I actually need' },
        { emoji: '💪', label: 'I\'ve done the work' },
        { emoji: '🌱', label: 'My standards are clearer' },
      ],
      more: [
        { emoji: '⚓', label: 'More grounded than before' },
        { emoji: '💬', label: 'Better at communicating now' },
        { emoji: '🌟', label: 'Appreciation over infatuation' },
        { emoji: '🎯', label: 'Know my non-negotiables' },
      ],
    },
    {
      key: 'what_you_need',
      kind: 'multi',
      icon: '🤲',
      title: 'What you need this time',
      sub: 'Pick up to 4',
      max: 4,
      chips: [
        { emoji: '🚫', label: 'No rush to fill a role' },
        { emoji: '❤️', label: 'Emotional availability' },
        { emoji: '✅', label: 'Genuine readiness' },
        { emoji: '🤝', label: 'Someone who means it' },
        { emoji: '💬', label: 'Honest communication from the start' },
      ],
      more: [
        { emoji: '🧘', label: 'Patience and steadiness' },
        { emoji: '🌱', label: 'Space to grow together' },
        { emoji: '💛', label: 'Warmth without urgency' },
        { emoji: '🛡', label: 'Safety to be real' },
      ],
    },
    {
      key: 'non_negotiables',
      kind: 'multi',
      icon: '🔑',
      title: 'Non-negotiables · private',
      sub: 'Pick up to 4',
      privacy: true,
      max: 4,
      chips: [
        { emoji: '🧘', label: 'No drama' },
        { emoji: '💬', label: 'Honest communication' },
        { emoji: '🌟', label: 'Emotional maturity' },
        { emoji: '🎯', label: 'Knowing what they want' },
        { emoji: '🤝', label: 'Mutual respect' },
      ],
      more: [
        { emoji: '⏳', label: 'Not in a hurry to perform' },
        { emoji: '🛡', label: 'Consistent and reliable' },
        { emoji: '🌹', label: 'Genuine warmth' },
        { emoji: '✅', label: 'Ready to actually show up' },
      ],
    },
  ];
  const REQUIRED_SECOND_CHAPTER = ['where_you_are', 'what_is_different', 'what_you_need'];

  // ── Just Friends ──────────────────────────────────────────────────────────
  const SECTIONS_JUST_FRIENDS: Section[] = [
    {
      key: 'social_style',
      kind: 'card',
      icon: '👥',
      title: 'Your social style',
      sub: 'Pick the closest match',
      options: [
        { emoji: '☕', label: 'One-on-one conversations', sub: 'I prefer depth over group dynamics' },
        { emoji: '👥', label: 'Small group hangouts', sub: 'A few good people is perfect' },
        { emoji: '🎉', label: 'Large social circles', sub: 'Love meeting lots of people' },
        { emoji: '🔄', label: 'Mix of both', sub: 'Depends on the mood' },
      ],
    },
    {
      key: 'what_you_enjoy',
      kind: 'multi',
      icon: '🎉',
      title: 'Activities you enjoy',
      sub: 'Pick up to 5',
      max: 5,
      chips: [
        { emoji: '🍽', label: 'Eating out' },
        { emoji: '🏞', label: 'Outdoor activities' },
        { emoji: '🎬', label: 'Watching films or sport' },
        { emoji: '🎨', label: 'Creative projects' },
        { emoji: '💪', label: 'Fitness activities' },
      ],
      more: [
        { emoji: '🎵', label: 'Concerts & live music' },
        { emoji: '✈️', label: 'Travelling' },
        { emoji: '🧠', label: 'Intellectual discussions' },
        { emoji: '🌆', label: 'Exploring the city' },
        { emoji: '🎮', label: 'Gaming' },
        { emoji: '📚', label: 'Books & culture' },
      ],
    },
    {
      key: 'good_friend_traits',
      kind: 'multi',
      icon: '🤝',
      title: 'What makes a good friend',
      sub: 'Pick up to 4',
      max: 4,
      chips: [
        { emoji: '✅', label: 'Shows up when they say they will' },
        { emoji: '💬', label: 'Honest' },
        { emoji: '😊', label: 'Easy to be around' },
        { emoji: '🔑', label: 'Good conversation' },
        { emoji: '🤝', label: 'Respects space' },
      ],
      more: [
        { emoji: '😂', label: 'Funny' },
        { emoji: '💬', label: 'Real talk, not small talk' },
        { emoji: '📞', label: 'Actually responds' },
        { emoji: '🌿', label: 'No drama' },
      ],
    },
    {
      key: 'comfort_zone',
      kind: 'single',
      icon: '🌊',
      title: 'What you\'re open to',
      sub: 'Keep it real',
      chips: [
        { emoji: '😊', label: 'Keep it casual and fun' },
        { emoji: '💬', label: 'Open to heartfelt conversations too' },
        { emoji: '🌱', label: 'Friendship first — see what happens' },
        { emoji: '🤝', label: 'Platonic only' },
      ],
    },
  ];
  const REQUIRED_JUST_FRIENDS = ['social_style', 'what_you_enjoy', 'good_friend_traits'];

  function buildSections(a: string): { sections: Section[]; required: string[] } {
    if (a === 'casual_generous_man')
      return { sections: SECTIONS_CASUAL_MAN,        required: REQUIRED_CASUAL_MAN };
    if (a === 'spoiled_casual_woman')
      return { sections: SECTIONS_SPOILED_CASUAL,    required: REQUIRED_SPOILED_CASUAL };
    if (a === 'hopeless_romantic_man' || a === 'hopeless_romantic_woman')
      return { sections: SECTIONS_ROMANTIC,       required: REQUIRED_ROMANTIC };
    if (a === 'forever_focused_man' || a === 'forever_focused_woman')
      return { sections: SECTIONS_FOREVER,        required: REQUIRED_FOREVER };
    if (a === 'traditional_matrimony_man' || a === 'traditional_matrimony_woman')
      return { sections: SECTIONS_MATRIMONY,      required: REQUIRED_MATRIMONY };
    if (a === 'rebound_healing_man' || a === 'rebound_healing_woman')
      return { sections: SECTIONS_REBOUND,        required: REQUIRED_REBOUND };
    if (a === 'untouched_heart_man' || a === 'untouched_heart_woman')
      return { sections: SECTIONS_UNTOUCHED,      required: REQUIRED_UNTOUCHED };
    if (a === 'second_chapter_man' || a === 'second_chapter_woman')
      return { sections: SECTIONS_SECOND_CHAPTER, required: REQUIRED_SECOND_CHAPTER };
    if (a === 'just_friends_man' || a === 'just_friends_woman')
      return { sections: SECTIONS_JUST_FRIENDS,   required: REQUIRED_JUST_FRIENDS };
    return { sections: SECTIONS_CASUAL_MAN, required: REQUIRED_CASUAL_MAN }; // default
  }

  const { sections: SECTIONS, required: REQUIRED_KEYS } = $derived(buildSections(archetype));

  const heroTitle = $derived.by(() => {
    if (archetype === 'hopeless_romantic_man' || archetype === 'hopeless_romantic_woman') return "How you love and what you bring.";
    if (archetype === 'forever_focused_man' || archetype === 'forever_focused_woman') return "Where you are and where you're going.";
    if (archetype === 'traditional_matrimony_man' || archetype === 'traditional_matrimony_woman') return "Your background and lifestyle.";
    if (archetype === 'rebound_healing_man' || archetype === 'rebound_healing_woman') return "Where you are in your journey.";
    if (archetype === 'untouched_heart_man' || archetype === 'untouched_heart_woman') return "Where you're starting from.";
    if (archetype === 'second_chapter_man' || archetype === 'second_chapter_woman') return "What's different this time.";
    if (archetype === 'just_friends_man' || archetype === 'just_friends_woman') return "Your social style and interests.";
    if (archetype === 'spoiled_casual_woman') return "Your vibe and what you value.";
    return "How you live and what you value."; // casual / default
  });

  let picks = $state<Record<string, string[]>>({});

  // Reset picks when archetype changes
  $effect(() => {
    const fresh: Record<string, string[]> = {};
    for (const s of SECTIONS) fresh[s.key] = [];
    picks = fresh;
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
    <h1 class="hero-title">{heroTitle}</h1>
    <div class="hero-meta">
      <span>⏱</span> ~2 min · {filledCount} of {SECTIONS.length} sections answered
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
    <p class="cta-hint">🔒 Anything marked private stays with you. Only badges appear publicly.</p>
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
    background: rgba(255, 122, 77, 0.1);
    border-color: rgba(255, 122, 77, 0.3);
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
    background: rgba(255, 122, 77, 0.1);
    border-color: rgba(255, 122, 77, 0.5);
    color: var(--accent-bright);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(255, 122, 77, 0.18);
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
    background: rgba(255, 122, 77, 0.08);
    border-color: rgba(255, 122, 77, 0.5);
    box-shadow: 0 4px 14px rgba(255, 122, 77, 0.18);
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
    background: rgba(255, 122, 77, 0.1);
    border: 1px solid rgba(255, 122, 77, 0.16);
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
    box-shadow: 0 8px 24px rgba(255, 122, 77, 0.28);
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
