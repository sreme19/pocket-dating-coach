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
    archetype?: string;
    onSubmit: (picks: Record<string, string[]>) => void;
    onCancel?: () => void;
    onSkip?: () => void;
  }

  let { archetype = '', onSubmit, onCancel, onSkip }: Props = $props();

  // ── Casual / Generous (casual_generous_man, spoiled_casual_woman) ──────────
  const SECTIONS_CASUAL: Section[] = [
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

  // ── Hopeless Romantic ─────────────────────────────────────────────────────
  const SECTIONS_ROMANTIC: Section[] = [
    {
      key: 'partner_energy',
      icon: '💞',
      title: 'Partner energy you want',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🥰', label: 'Emotionally warm' },
        { emoji: '🔥', label: 'Passionately present' },
        { emoji: '💬', label: 'Open about feelings' },
        { emoji: '🛡️', label: 'Fiercely loyal' },
        { emoji: '🌹', label: 'Romantically expressive' },
      ],
      more: [
        { emoji: '🤍', label: 'Deeply empathetic' },
        { emoji: '💌', label: 'Poetic soul' },
        { emoji: '🌙', label: 'Nurturing by nature' },
        { emoji: '✨', label: 'Spontaneously romantic' },
      ],
    },
    {
      key: 'connection_style',
      icon: '💬',
      title: 'Connection you crave',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🌃', label: 'Late-night conversations' },
        { emoji: '📩', label: 'Heartfelt check-ins' },
        { emoji: '🎁', label: 'Planning surprises' },
        { emoji: '🫂', label: 'Being emotionally held' },
        { emoji: '🤝', label: 'Showing up consistently' },
      ],
      more: [
        { emoji: '📖', label: 'Making traditions together' },
        { emoji: '🧠', label: 'Noticing the small things' },
        { emoji: '📞', label: 'Being each other\'s first call' },
        { emoji: '💫', label: 'Feeling truly chosen' },
      ],
    },
    {
      key: 'love_language',
      icon: '❤️',
      title: 'Love languages',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '⏱', label: 'Quality time' },
        { emoji: '💬', label: 'Words of affirmation' },
        { emoji: '🤗', label: 'Physical affection' },
        { emoji: '🙌', label: 'Acts of service' },
        { emoji: '🎁', label: 'Thoughtful gestures' },
      ],
      more: [
        { emoji: '💌', label: 'Letters and notes' },
        { emoji: '😂', label: 'Shared inside jokes' },
        { emoji: '🌟', label: '"Thinking of you" moments' },
        { emoji: '🍳', label: 'Cooking for each other' },
      ],
    },
    {
      key: 'chemistry',
      icon: '🕯',
      title: 'Chemistry you enjoy',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🕯', label: 'Slow-burn that goes deep' },
        { emoji: '💥', label: 'Intense emotional connection' },
        { emoji: '🫶', label: 'The feeling of being known' },
        { emoji: '🌙', label: 'Quiet understanding' },
        { emoji: '🔥', label: 'Passionate intensity' },
      ],
      more: [
        { emoji: '👁', label: 'Deep eye contact' },
        { emoji: '😄', label: 'Playful teasing with real warmth' },
        { emoji: '🌊', label: 'Overwhelming at times — the good kind' },
        { emoji: '🤫', label: 'A love that doesn\'t need to perform' },
      ],
    },
  ];

  // ── Forever Focused ───────────────────────────────────────────────────────
  const SECTIONS_FOREVER: Section[] = [
    {
      key: 'partner_qualities',
      icon: '🎯',
      title: 'Partner qualities',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🧘', label: 'Emotionally mature' },
        { emoji: '🚀', label: 'Ambitious & driven' },
        { emoji: '🤝', label: 'Partnership-minded' },
        { emoji: '💬', label: 'Honest and direct' },
        { emoji: '🏡', label: 'Family-oriented' },
      ],
      more: [
        { emoji: '📈', label: 'Growth-focused' },
        { emoji: '💰', label: 'Financially responsible' },
        { emoji: '🛡️', label: 'Loyal by nature' },
        { emoji: '🧠', label: 'Intellectually curious' },
      ],
    },
    {
      key: 'partnership_vision',
      icon: '🏡',
      title: 'Partnership vision',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🏗', label: 'Building a life together' },
        { emoji: '🎯', label: 'Aligned on major goals' },
        { emoji: '📈', label: 'Mutual growth and ambition' },
        { emoji: '🌅', label: 'Creating something lasting' },
        { emoji: '🤝', label: 'True partnership in everything' },
      ],
      more: [
        { emoji: '🏠', label: 'Buying a home together' },
        { emoji: '👨‍👩‍👧', label: 'Starting a family someday' },
        { emoji: '✈️', label: 'Travelling with purpose' },
        { emoji: '💡', label: 'Investing in each other' },
      ],
    },
    {
      key: 'what_you_value',
      icon: '💡',
      title: 'What you value most',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '💬', label: 'Direct communication' },
        { emoji: '📅', label: 'Long-term thinking' },
        { emoji: '🧭', label: 'Shared values' },
        { emoji: '🎯', label: 'Intentional choices' },
        { emoji: '❤️', label: 'Emotional accountability' },
      ],
      more: [
        { emoji: '✅', label: 'No grey areas' },
        { emoji: '💰', label: 'Financial clarity' },
        { emoji: '🔄', label: 'Consistent follow-through' },
        { emoji: '🧠', label: 'Knowing what they want' },
      ],
    },
    {
      key: 'chemistry',
      icon: '🔑',
      title: 'Chemistry you enjoy',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🏛', label: 'Deep trust built over time' },
        { emoji: '📈', label: 'Attraction that grows with depth' },
        { emoji: '🌟', label: 'Natural alignment' },
        { emoji: '💡', label: 'Intellectual spark' },
        { emoji: '🏆', label: 'Partners in everything' },
      ],
      more: [
        { emoji: '🔥', label: 'Comfort without losing passion' },
        { emoji: '🌅', label: 'The kind that gets better with time' },
        { emoji: '🫶', label: 'Deep ease with someone great' },
        { emoji: '⚡', label: 'Chemistry built on respect' },
      ],
    },
  ];

  // ── Traditional Matrimony ─────────────────────────────────────────────────
  const SECTIONS_MATRIMONY: Section[] = [
    {
      key: 'core_values',
      icon: '🏛️',
      title: 'Values that matter most',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🏡', label: 'Family-first' },
        { emoji: '🕌', label: 'Culturally aligned' },
        { emoji: '🙏', label: 'Respectful & grounded' },
        { emoji: '📿', label: 'Traditional values' },
        { emoji: '✝️', label: 'Religiously compatible' },
      ],
      more: [
        { emoji: '🌍', label: 'Community-oriented' },
        { emoji: '💰', label: 'Financially responsible' },
        { emoji: '👨‍👩‍👧', label: 'Parenting-aligned' },
        { emoji: '🌱', label: 'Grounded in roots' },
      ],
    },
    {
      key: 'family_approach',
      icon: '👨‍👩‍👧',
      title: 'Family approach',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🤝', label: 'Family approval matters' },
        { emoji: '🏠', label: 'Respecting elders' },
        { emoji: '🧬', label: 'Building legacy together' },
        { emoji: '🎉', label: 'Strong family bonds' },
        { emoji: '👐', label: 'Cultural event participation' },
      ],
      more: [
        { emoji: '🏘', label: 'Extended family involvement' },
        { emoji: '📿', label: 'Shared traditions' },
        { emoji: '🌺', label: 'Home-building values' },
        { emoji: '🫂', label: 'Family-led search' },
      ],
    },
    {
      key: 'partner_fit',
      icon: '🎓',
      title: 'Partner background',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🕌', label: 'Same religion' },
        { emoji: '🎓', label: 'Similar education' },
        { emoji: '💼', label: 'Stable career' },
        { emoji: '🌍', label: 'Cultural community fit' },
        { emoji: '🏡', label: 'Similar upbringing' },
      ],
      more: [
        { emoji: '📿', label: 'Shared traditions' },
        { emoji: '💰', label: 'Financially settled' },
        { emoji: '🌱', label: 'Home-building values' },
        { emoji: '🌸', label: 'Aligned on children' },
      ],
    },
    {
      key: 'connection_style',
      icon: '🤝',
      title: 'Connection approach',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🕊', label: 'Respectful courtship' },
        { emoji: '⏳', label: 'Gradual trust-building' },
        { emoji: '💍', label: 'Long-term vision first' },
        { emoji: '👨‍👩‍👧', label: 'Meeting families early' },
        { emoji: '✅', label: 'Demonstrating seriousness' },
      ],
      more: [
        { emoji: '🙏', label: 'Patience and respect' },
        { emoji: '📋', label: 'Proper introductions' },
        { emoji: '💬', label: 'Honest about intent upfront' },
        { emoji: '🌱', label: 'Letting it develop properly' },
      ],
    },
  ];

  // ── Rebound / Healing ─────────────────────────────────────────────────────
  const SECTIONS_REBOUND: Section[] = [
    {
      key: 'energy_needed',
      icon: '🌱',
      title: 'Energy you need right now',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🕊', label: 'Patient and unhurried' },
        { emoji: '🤝', label: 'Non-judgmental' },
        { emoji: '😊', label: 'Easy to be around' },
        { emoji: '💬', label: 'Genuine and honest' },
        { emoji: '⚓', label: 'Emotionally steady' },
      ],
      more: [
        { emoji: '👂', label: 'Good listener' },
        { emoji: '🛡', label: 'Respects my pace' },
        { emoji: '🌿', label: 'Light touch' },
        { emoji: '✅', label: 'Straightforward' },
      ],
    },
    {
      key: 'what_slow_means',
      icon: '⏳',
      title: 'What "slow" means to you',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🚫', label: 'No pressure to define anything' },
        { emoji: '🌊', label: 'Genuinely day by day' },
        { emoji: '🤲', label: 'No big expectations early' },
        { emoji: '🌙', label: 'Space without distance' },
        { emoji: '📅', label: 'Checking in without hovering' },
      ],
      more: [
        { emoji: '🌱', label: 'Letting things develop naturally' },
        { emoji: '🧘', label: 'Patience without resentment' },
        { emoji: '🌸', label: 'Gentle presence when I need it' },
        { emoji: '🎯', label: 'Real without rushing' },
      ],
    },
    {
      key: 'what_you_seek',
      icon: '💬',
      title: 'What you\'re looking for',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '💬', label: 'Honest conversations' },
        { emoji: '🤫', label: 'Comfortable silence' },
        { emoji: '🌟', label: 'Something real without rush' },
        { emoji: '☕', label: 'Low-drama connection' },
        { emoji: '🫶', label: 'Good company, no pressure' },
      ],
      more: [
        { emoji: '🌿', label: 'Someone who just gets it' },
        { emoji: '🔑', label: 'Natural chemistry' },
        { emoji: '🤝', label: 'Mutual understanding' },
        { emoji: '🕊', label: 'Connection that feels light' },
      ],
    },
    {
      key: 'chemistry',
      icon: '🌊',
      title: 'Pace of connection',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🌱', label: 'Gradual trust' },
        { emoji: '😌', label: 'Natural comfort' },
        { emoji: '🚪', label: 'Careful openness' },
        { emoji: '✨', label: 'Little moments that add up' },
        { emoji: '🌙', label: 'No timelines' },
      ],
      more: [
        { emoji: '🏗', label: 'Building something slow and real' },
        { emoji: '🧘', label: 'Connection that doesn\'t feel forced' },
        { emoji: '🔥', label: 'Warmth without pressure' },
        { emoji: '🌿', label: 'Just being present together' },
      ],
    },
  ];

  // ── Untouched Heart ───────────────────────────────────────────────────────
  const SECTIONS_UNTOUCHED: Section[] = [
    {
      key: 'partner_energy',
      icon: '🕊️',
      title: 'Partner energy',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🕊', label: 'Patient and gentle' },
        { emoji: '💪', label: 'Encouraging' },
        { emoji: '💎', label: 'Sincere' },
        { emoji: '🔍', label: 'Curious about me' },
        { emoji: '🌊', label: 'Unhurried' },
      ],
      more: [
        { emoji: '🤗', label: 'Kind by default' },
        { emoji: '🛡', label: 'Makes me feel safe' },
        { emoji: '😄', label: 'Laughs easily' },
        { emoji: '💬', label: 'Emotionally available' },
      ],
    },
    {
      key: 'what_you_hope_for',
      icon: '🌸',
      title: 'What you\'re hoping for',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '📖', label: 'Getting to know each other slowly' },
        { emoji: '✨', label: 'Honest first-time experiences' },
        { emoji: '💬', label: 'Real conversations' },
        { emoji: '🌱', label: 'Something that feels right' },
        { emoji: '🤝', label: 'Learning together' },
      ],
      more: [
        { emoji: '🛡', label: 'No performance required' },
        { emoji: '🌸', label: 'A gentle beginning' },
        { emoji: '🧩', label: 'Figuring it out as we go' },
        { emoji: '🌟', label: 'Something real and unhurried' },
      ],
    },
    {
      key: 'what_matters',
      icon: '💙',
      title: 'What matters most',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '💎', label: 'Sincerity over polish' },
        { emoji: '🕊', label: 'Patience over pressure' },
        { emoji: '✅', label: 'Real over perfect' },
        { emoji: '🤍', label: 'Kindness above all' },
        { emoji: '🚫', label: 'No games' },
      ],
      more: [
        { emoji: '🌊', label: 'No rush' },
        { emoji: '🌱', label: 'Let it be what it is' },
        { emoji: '💬', label: 'Open and easy conversation' },
        { emoji: '🙏', label: 'Genuine care' },
      ],
    },
    {
      key: 'chemistry',
      icon: '⚡',
      title: 'Chemistry you enjoy',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '⚡', label: 'Nervous excitement' },
        { emoji: '😊', label: 'Natural rapport' },
        { emoji: '🔍', label: 'Genuine curiosity' },
        { emoji: '😊', label: 'The simple joy of talking' },
        { emoji: '🌸', label: 'Shy smiles that mean something' },
      ],
      more: [
        { emoji: '🫶', label: 'Feeling understood for the first time' },
        { emoji: '🌙', label: 'Quiet comfort' },
        { emoji: '🌱', label: 'Slow discovery' },
        { emoji: '✨', label: 'Something new and exciting' },
      ],
    },
  ];

  // ── Second Chapter ────────────────────────────────────────────────────────
  const SECTIONS_SECOND_CHAPTER: Section[] = [
    {
      key: 'what_you_seek',
      icon: '🔄',
      title: 'What you\'re looking for',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🧘', label: 'Emotionally mature' },
        { emoji: '⚓', label: 'Grounded and settled' },
        { emoji: '🏛', label: 'Wise from experience' },
        { emoji: '✅', label: 'Ready — not just willing' },
        { emoji: '🤝', label: 'Genuinely available' },
      ],
      more: [
        { emoji: '🚫', label: 'Doesn\'t bring old drama' },
        { emoji: '🔍', label: 'Knows themselves' },
        { emoji: '🏗', label: 'Established in life' },
        { emoji: '💬', label: 'Clear communicator' },
      ],
    },
    {
      key: 'this_chapter',
      icon: '📖',
      title: 'What this chapter is about',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🏗', label: 'Building something better this time' },
        { emoji: '🚫', label: 'Not repeating old patterns' },
        { emoji: '🫶', label: 'Appreciation over infatuation' },
        { emoji: '🌊', label: 'Partnership with real depth' },
        { emoji: '🌱', label: 'Learning from before, not living in it' },
      ],
      more: [
        { emoji: '💎', label: 'Someone who knows what they\'ve got' },
        { emoji: '🌅', label: 'Starting fresh with wisdom' },
        { emoji: '🔑', label: 'Earned trust, not assumed' },
        { emoji: '✨', label: 'Real connection, not just company' },
      ],
    },
    {
      key: 'what_you_appreciate',
      icon: '💛',
      title: 'What you appreciate',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '❤️', label: 'Emotional availability' },
        { emoji: '🕊', label: 'Patience built from experience' },
        { emoji: '💬', label: 'Honest communication' },
        { emoji: '⚓', label: 'Stability' },
        { emoji: '✅', label: 'Genuine readiness' },
      ],
      more: [
        { emoji: '🚫', label: 'No games at this stage' },
        { emoji: '🤝', label: 'Someone who means it' },
        { emoji: '🧘', label: 'Grounded, not perfect' },
        { emoji: '🌸', label: 'Softness without weakness' },
      ],
    },
    {
      key: 'chemistry',
      icon: '🔥',
      title: 'Chemistry you enjoy',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '🏠', label: 'Deep comfort that arrives slowly' },
        { emoji: '🔑', label: 'Rebuilt trust' },
        { emoji: '💛', label: 'Mature attraction' },
        { emoji: '💬', label: 'Realness over butterflies' },
        { emoji: '🌙', label: 'Easy conversation' },
      ],
      more: [
        { emoji: '🏡', label: 'The kind that feels like coming home' },
        { emoji: '📈', label: 'Earned closeness' },
        { emoji: '🌿', label: 'Steady warmth' },
        { emoji: '✨', label: 'Attraction without urgency' },
      ],
    },
  ];

  // ── Just Friends ──────────────────────────────────────────────────────────
  const SECTIONS_JUST_FRIENDS: Section[] = [
    {
      key: 'friend_energy',
      icon: '🤝',
      title: 'Friend energy',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '😊', label: 'Easy to talk to' },
        { emoji: '😂', label: 'Genuinely funny' },
        { emoji: '👂', label: 'Good listener' },
        { emoji: '🧘', label: 'Low-drama' },
        { emoji: '💎', label: 'Authentic' },
      ],
      more: [
        { emoji: '💬', label: 'Keeps it real' },
        { emoji: '🚀', label: 'Doesn\'t overthink' },
        { emoji: '🔍', label: 'Interested in others' },
        { emoji: '✅', label: 'Reliable' },
      ],
    },
    {
      key: 'activities',
      icon: '🎉',
      title: 'Activities you enjoy',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '☕', label: 'Coffee & conversations' },
        { emoji: '🎲', label: 'Spontaneous plans' },
        { emoji: '🧠', label: 'Intellectual discussions' },
        { emoji: '🏞', label: 'Outdoor activities' },
        { emoji: '🍽', label: 'Good food & music' },
      ],
      more: [
        { emoji: '👥', label: 'Group hangouts' },
        { emoji: '🎨', label: 'Creative projects' },
        { emoji: '⚽', label: 'Watching sport together' },
        { emoji: '🌆', label: 'Exploring the city' },
      ],
    },
    {
      key: 'great_connection',
      icon: '✨',
      title: 'What makes a great connection',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '💬', label: 'Natural conversation flow' },
        { emoji: '😄', label: 'Shared sense of humour' },
        { emoji: '🌊', label: 'Can talk about anything' },
        { emoji: '🤫', label: 'Comfortable silence' },
        { emoji: '🚫', label: 'Zero awkwardness' },
      ],
      more: [
        { emoji: '✅', label: 'No hidden agenda' },
        { emoji: '🤝', label: 'Mutual respect' },
        { emoji: '💬', label: 'Direct and real' },
        { emoji: '🌟', label: 'Easy to be around' },
      ],
    },
    {
      key: 'vibe',
      icon: '🌊',
      title: 'Vibe you enjoy',
      sub: 'Pick up to 3',
      max: 3,
      chips: [
        { emoji: '😌', label: 'Warm and easy-going' },
        { emoji: '💡', label: 'Intellectually stimulating' },
        { emoji: '🎭', label: 'Adventurous without pressure' },
        { emoji: '😂', label: 'Funny and laid-back' },
        { emoji: '🌿', label: 'Just genuinely real' },
      ],
      more: [
        { emoji: '✅', label: 'Makes plans and shows up' },
        { emoji: '🎯', label: 'No performance' },
        { emoji: '⚡', label: 'Good energy to be around' },
        { emoji: '🤝', label: 'Comfortable in their own skin' },
      ],
    },
  ];

  function buildSections(a: string): Section[] {
    if (a === 'casual_generous_man' || a === 'spoiled_casual_woman') return SECTIONS_CASUAL;
    if (a === 'hopeless_romantic_man' || a === 'hopeless_romantic_woman') return SECTIONS_ROMANTIC;
    if (a === 'forever_focused_man' || a === 'forever_focused_woman') return SECTIONS_FOREVER;
    if (a === 'traditional_matrimony_man' || a === 'traditional_matrimony_woman') return SECTIONS_MATRIMONY;
    if (a === 'rebound_healing_man' || a === 'rebound_healing_woman') return SECTIONS_REBOUND;
    if (a === 'untouched_heart_man' || a === 'untouched_heart_woman') return SECTIONS_UNTOUCHED;
    if (a === 'second_chapter_man' || a === 'second_chapter_woman') return SECTIONS_SECOND_CHAPTER;
    if (a === 'just_friends_man' || a === 'just_friends_woman') return SECTIONS_JUST_FRIENDS;
    return SECTIONS_CASUAL; // sensible default
  }

  const SECTIONS = $derived(buildSections(archetype));

  const heroTitle = $derived.by(() => {
    if (archetype === 'hopeless_romantic_man' || archetype === 'hopeless_romantic_woman') return "What you're drawn to in a person.";
    if (archetype === 'forever_focused_man' || archetype === 'forever_focused_woman') return "What you're building toward.";
    if (archetype === 'traditional_matrimony_man' || archetype === 'traditional_matrimony_woman') return "What you value in a partner.";
    if (archetype === 'rebound_healing_man' || archetype === 'rebound_healing_woman') return "What you need right now.";
    if (archetype === 'untouched_heart_man' || archetype === 'untouched_heart_woman') return "What you're hoping for.";
    if (archetype === 'second_chapter_man' || archetype === 'second_chapter_woman') return "What this chapter is about.";
    if (archetype === 'just_friends_man' || archetype === 'just_friends_woman') return "What makes a great connection.";
    return "What you're drawn to."; // casual / default
  });

  let picks = $state<Record<string, string[]>>({});
  let expanded = $state<Record<string, boolean>>({});

  // Reset picks when archetype changes so stale keys don't linger
  $effect(() => {
    const fresh: Record<string, string[]> = {};
    for (const s of SECTIONS) fresh[s.key] = [];
    picks = fresh;
  });

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
    <h1 class="hero-title">{heroTitle}</h1>
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
