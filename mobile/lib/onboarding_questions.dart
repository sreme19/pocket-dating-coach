// Archetype-specific onboarding question sets — NATIVE PORT of the web flow.
//
// SOURCE OF TRUTH (keep in lockstep — see drift note):
//   src/lib/verified-vibe/components/DrawnToStep.svelte
//   src/lib/verified-vibe/components/HowYouLiveStep.svelte
// If the web question sets change, this file MUST be updated to match.

enum QKind { multi, single, card }

class QOption {
  final String? emoji;
  final String label;
  final String? sub; // card subtitle (CardOption.sub); null for plain chips
  final bool quiet;  // muted styling, e.g. "Prefer not to say"
  const QOption(this.label, {this.emoji, this.sub, this.quiet = false});
}

class QSection {
  final String key;
  final QKind kind;
  final String icon;
  final String title;
  final String sub;
  final bool private; // web `privacy: true`
  final int max;      // multi-select cap; ignored for single/card
  final List<QOption> options; // chips (multi/single) OR card options
  final List<QOption> more;    // "+ more" chips (multi only)
  const QSection({
    required this.key,
    required this.kind,
    required this.icon,
    required this.title,
    required this.sub,
    this.private = false,
    this.max = 3,
    this.options = const [],
    this.more = const [],
  });
}

// ─────────────────────────────────────────────────────────────────────────
// DrawnTo question sets (all multi, max 3)
// ─────────────────────────────────────────────────────────────────────────

const List<QSection> _drawnToCasual = [
  QSection(
    key: 'energy', kind: QKind.multi, icon: '✨',
    title: "Energy you're drawn to", sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Confident', emoji: '✨'),
      QOption('Emotionally warm', emoji: '🥰'),
      QOption('Adventurous', emoji: '🎭'),
      QOption('Glamorous', emoji: '💃'),
      QOption('Discreet', emoji: '🔒'),
    ],
    more: [
      QOption('Affectionate', emoji: '💋'),
      QOption('Flirty & playful', emoji: '😏'),
      QOption('Passionate', emoji: '🔥'),
      QOption('Magnetic presence', emoji: '🧲'),
    ],
  ),
  QSection(
    key: 'experiences', kind: QKind.multi, icon: '🌍',
    title: 'Experiences to share', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('International travel', emoji: '🌍'),
      QOption('Fine dining', emoji: '🍷'),
      QOption('Spontaneous trips', emoji: '✈️'),
      QOption('Luxury hotels', emoji: '🏨'),
      QOption('Art & culture', emoji: '🎨'),
    ],
    more: [
      QOption('High-end social', emoji: '🍾'),
      QOption('VIP nightlife', emoji: '🎭'),
      QOption('Relaxing escapes', emoji: '🌴'),
      QOption('Exotic cars', emoji: '🚗'),
    ],
  ),
  QSection(
    key: 'appreciation', kind: QKind.multi, icon: '💎',
    title: 'How appreciation lands', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Quality time', emoji: '❤️'),
      QOption('Attention & words', emoji: '💬'),
      QOption('Financial generosity', emoji: '💎'),
      QOption('Thoughtful gifting', emoji: '🎁'),
      QOption('Consistency', emoji: '🕰'),
    ],
    more: [
      QOption('Elevated experiences', emoji: '🥂'),
      QOption('Luxury treatment', emoji: '🛍'),
      QOption('Romance & affection', emoji: '🌹'),
      QOption('Supporting my ambitions', emoji: '💼'),
    ],
  ),
  QSection(
    key: 'chemistry', kind: QKind.multi, icon: '🔥',
    title: 'Chemistry you enjoy', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Instant sparks', emoji: '⚡'),
      QOption('Flirty banter', emoji: '😏'),
      QOption('Slow-burn attraction', emoji: '🕯'),
      QOption('Emotional connection first', emoji: '❤️'),
      QOption('Passionate chemistry', emoji: '🔥'),
    ],
    more: [
      QOption('Affection & touch', emoji: '💋'),
      QOption('Romantic intimacy', emoji: '🌹'),
      QOption('Sensual experiences', emoji: '🍷'),
      QOption('Open-minded connection', emoji: '🌌'),
    ],
  ),
];

const List<QSection> _drawnToRomantic = [
  QSection(
    key: 'partner_energy', kind: QKind.multi, icon: '💞',
    title: 'Partner energy you want', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Emotionally warm', emoji: '🥰'),
      QOption('Passionately present', emoji: '🔥'),
      QOption('Open about feelings', emoji: '💬'),
      QOption('Fiercely loyal', emoji: '🛡️'),
      QOption('Romantically expressive', emoji: '🌹'),
    ],
    more: [
      QOption('Deeply empathetic', emoji: '🤍'),
      QOption('Poetic soul', emoji: '💌'),
      QOption('Nurturing by nature', emoji: '🌙'),
      QOption('Spontaneously romantic', emoji: '✨'),
    ],
  ),
  QSection(
    key: 'connection_style', kind: QKind.multi, icon: '💬',
    title: 'Connection you crave', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Late-night conversations', emoji: '🌃'),
      QOption('Heartfelt check-ins', emoji: '📩'),
      QOption('Planning surprises', emoji: '🎁'),
      QOption('Being emotionally held', emoji: '🫂'),
      QOption('Showing up consistently', emoji: '🤝'),
    ],
    more: [
      QOption('Making traditions together', emoji: '📖'),
      QOption('Noticing the small things', emoji: '🧠'),
      QOption("Being each other's first call", emoji: '📞'),
      QOption('Feeling truly chosen', emoji: '💫'),
    ],
  ),
  QSection(
    key: 'love_language', kind: QKind.multi, icon: '❤️',
    title: 'Love languages', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Quality time', emoji: '⏱'),
      QOption('Words of affirmation', emoji: '💬'),
      QOption('Physical affection', emoji: '🤗'),
      QOption('Acts of service', emoji: '🙌'),
      QOption('Thoughtful gestures', emoji: '🎁'),
    ],
    more: [
      QOption('Letters and notes', emoji: '💌'),
      QOption('Shared inside jokes', emoji: '😂'),
      QOption('"Thinking of you" moments', emoji: '🌟'),
      QOption('Cooking for each other', emoji: '🍳'),
    ],
  ),
  QSection(
    key: 'chemistry', kind: QKind.multi, icon: '🕯',
    title: 'Chemistry you enjoy', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Slow-burn that goes deep', emoji: '🕯'),
      QOption('Intense emotional connection', emoji: '💥'),
      QOption('The feeling of being known', emoji: '🫶'),
      QOption('Quiet understanding', emoji: '🌙'),
      QOption('Passionate intensity', emoji: '🔥'),
    ],
    more: [
      QOption('Deep eye contact', emoji: '👁'),
      QOption('Playful teasing with real warmth', emoji: '😄'),
      QOption('Overwhelming at times — the good kind', emoji: '🌊'),
      QOption("A love that doesn't need to perform", emoji: '🤫'),
    ],
  ),
];

const List<QSection> _drawnToForever = [
  QSection(
    key: 'partner_qualities', kind: QKind.multi, icon: '🎯',
    title: 'Partner qualities', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Emotionally mature', emoji: '🧘'),
      QOption('Ambitious & driven', emoji: '🚀'),
      QOption('Partnership-minded', emoji: '🤝'),
      QOption('Honest and direct', emoji: '💬'),
      QOption('Family-oriented', emoji: '🏡'),
    ],
    more: [
      QOption('Growth-focused', emoji: '📈'),
      QOption('Financially responsible', emoji: '💰'),
      QOption('Loyal by nature', emoji: '🛡️'),
      QOption('Intellectually curious', emoji: '🧠'),
    ],
  ),
  QSection(
    key: 'partnership_vision', kind: QKind.multi, icon: '🏡',
    title: 'Partnership vision', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Building a life together', emoji: '🏗'),
      QOption('Aligned on major goals', emoji: '🎯'),
      QOption('Mutual growth and ambition', emoji: '📈'),
      QOption('Creating something lasting', emoji: '🌅'),
      QOption('True partnership in everything', emoji: '🤝'),
    ],
    more: [
      QOption('Buying a home together', emoji: '🏠'),
      QOption('Starting a family someday', emoji: '👨‍👩‍👧'),
      QOption('Travelling with purpose', emoji: '✈️'),
      QOption('Investing in each other', emoji: '💡'),
    ],
  ),
  QSection(
    key: 'what_you_value', kind: QKind.multi, icon: '💡',
    title: 'What you value most', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Direct communication', emoji: '💬'),
      QOption('Long-term thinking', emoji: '📅'),
      QOption('Shared values', emoji: '🧭'),
      QOption('Intentional choices', emoji: '🎯'),
      QOption('Emotional accountability', emoji: '❤️'),
    ],
    more: [
      QOption('No grey areas', emoji: '✅'),
      QOption('Financial clarity', emoji: '💰'),
      QOption('Consistent follow-through', emoji: '🔄'),
      QOption('Knowing what they want', emoji: '🧠'),
    ],
  ),
  QSection(
    key: 'chemistry', kind: QKind.multi, icon: '🔑',
    title: 'Chemistry you enjoy', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Deep trust built over time', emoji: '🏛'),
      QOption('Attraction that grows with depth', emoji: '📈'),
      QOption('Natural alignment', emoji: '🌟'),
      QOption('Intellectual spark', emoji: '💡'),
      QOption('Partners in everything', emoji: '🏆'),
    ],
    more: [
      QOption('Comfort without losing passion', emoji: '🔥'),
      QOption('The kind that gets better with time', emoji: '🌅'),
      QOption('Deep ease with someone great', emoji: '🫶'),
      QOption('Chemistry built on respect', emoji: '⚡'),
    ],
  ),
];

const List<QSection> _drawnToMatrimony = [
  QSection(
    key: 'core_values', kind: QKind.multi, icon: '🏛️',
    title: 'Values that matter most', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Family-first', emoji: '🏡'),
      QOption('Culturally aligned', emoji: '🕌'),
      QOption('Respectful & grounded', emoji: '🙏'),
      QOption('Traditional values', emoji: '📿'),
      QOption('Religiously compatible', emoji: '✝️'),
    ],
    more: [
      QOption('Community-oriented', emoji: '🌍'),
      QOption('Financially responsible', emoji: '💰'),
      QOption('Parenting-aligned', emoji: '👨‍👩‍👧'),
      QOption('Grounded in roots', emoji: '🌱'),
    ],
  ),
  QSection(
    key: 'family_approach', kind: QKind.multi, icon: '👨‍👩‍👧',
    title: 'Family approach', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Family approval matters', emoji: '🤝'),
      QOption('Respecting elders', emoji: '🏠'),
      QOption('Building legacy together', emoji: '🧬'),
      QOption('Strong family bonds', emoji: '🎉'),
      QOption('Cultural event participation', emoji: '👐'),
    ],
    more: [
      QOption('Extended family involvement', emoji: '🏘'),
      QOption('Shared traditions', emoji: '📿'),
      QOption('Home-building values', emoji: '🌺'),
      QOption('Family-led search', emoji: '🫂'),
    ],
  ),
  QSection(
    key: 'partner_fit', kind: QKind.multi, icon: '🎓',
    title: 'Partner background', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Same religion', emoji: '🕌'),
      QOption('Similar education', emoji: '🎓'),
      QOption('Stable career', emoji: '💼'),
      QOption('Cultural community fit', emoji: '🌍'),
      QOption('Similar upbringing', emoji: '🏡'),
    ],
    more: [
      QOption('Shared traditions', emoji: '📿'),
      QOption('Financially settled', emoji: '💰'),
      QOption('Home-building values', emoji: '🌱'),
      QOption('Aligned on children', emoji: '🌸'),
    ],
  ),
  QSection(
    key: 'connection_style', kind: QKind.multi, icon: '🤝',
    title: 'Connection approach', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Respectful courtship', emoji: '🕊'),
      QOption('Gradual trust-building', emoji: '⏳'),
      QOption('Long-term vision first', emoji: '💍'),
      QOption('Meeting families early', emoji: '👨‍👩‍👧'),
      QOption('Demonstrating seriousness', emoji: '✅'),
    ],
    more: [
      QOption('Patience and respect', emoji: '🙏'),
      QOption('Proper introductions', emoji: '📋'),
      QOption('Honest about intent upfront', emoji: '💬'),
      QOption('Letting it develop properly', emoji: '🌱'),
    ],
  ),
];

const List<QSection> _drawnToRebound = [
  QSection(
    key: 'energy_needed', kind: QKind.multi, icon: '🌱',
    title: 'Energy you need right now', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Patient and unhurried', emoji: '🕊'),
      QOption('Non-judgmental', emoji: '🤝'),
      QOption('Easy to be around', emoji: '😊'),
      QOption('Genuine and honest', emoji: '💬'),
      QOption('Emotionally steady', emoji: '⚓'),
    ],
    more: [
      QOption('Good listener', emoji: '👂'),
      QOption('Respects my pace', emoji: '🛡'),
      QOption('Light touch', emoji: '🌿'),
      QOption('Straightforward', emoji: '✅'),
    ],
  ),
  QSection(
    key: 'what_slow_means', kind: QKind.multi, icon: '⏳',
    title: 'What "slow" means to you', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('No pressure to define anything', emoji: '🚫'),
      QOption('Genuinely day by day', emoji: '🌊'),
      QOption('No big expectations early', emoji: '🤲'),
      QOption('Space without distance', emoji: '🌙'),
      QOption('Checking in without hovering', emoji: '📅'),
    ],
    more: [
      QOption('Letting things develop naturally', emoji: '🌱'),
      QOption('Patience without resentment', emoji: '🧘'),
      QOption('Gentle presence when I need it', emoji: '🌸'),
      QOption('Real without rushing', emoji: '🎯'),
    ],
  ),
  QSection(
    key: 'what_you_seek', kind: QKind.multi, icon: '💬',
    title: "What you're looking for", sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Honest conversations', emoji: '💬'),
      QOption('Comfortable silence', emoji: '🤫'),
      QOption('Something real without rush', emoji: '🌟'),
      QOption('Low-drama connection', emoji: '☕'),
      QOption('Good company, no pressure', emoji: '🫶'),
    ],
    more: [
      QOption('Someone who just gets it', emoji: '🌿'),
      QOption('Natural chemistry', emoji: '🔑'),
      QOption('Mutual understanding', emoji: '🤝'),
      QOption('Connection that feels light', emoji: '🕊'),
    ],
  ),
  QSection(
    key: 'chemistry', kind: QKind.multi, icon: '🌊',
    title: 'Pace of connection', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Gradual trust', emoji: '🌱'),
      QOption('Natural comfort', emoji: '😌'),
      QOption('Careful openness', emoji: '🚪'),
      QOption('Little moments that add up', emoji: '✨'),
      QOption('No timelines', emoji: '🌙'),
    ],
    more: [
      QOption('Building something slow and real', emoji: '🏗'),
      QOption("Connection that doesn't feel forced", emoji: '🧘'),
      QOption('Warmth without pressure', emoji: '🔥'),
      QOption('Just being present together', emoji: '🌿'),
    ],
  ),
];

const List<QSection> _drawnToUntouched = [
  QSection(
    key: 'partner_energy', kind: QKind.multi, icon: '🕊️',
    title: 'Partner energy', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Patient and gentle', emoji: '🕊'),
      QOption('Encouraging', emoji: '💪'),
      QOption('Sincere', emoji: '💎'),
      QOption('Curious about me', emoji: '🔍'),
      QOption('Unhurried', emoji: '🌊'),
    ],
    more: [
      QOption('Kind by default', emoji: '🤗'),
      QOption('Makes me feel safe', emoji: '🛡'),
      QOption('Laughs easily', emoji: '😄'),
      QOption('Emotionally available', emoji: '💬'),
    ],
  ),
  QSection(
    key: 'what_you_hope_for', kind: QKind.multi, icon: '🌸',
    title: "What you're hoping for", sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Getting to know each other slowly', emoji: '📖'),
      QOption('Honest first-time experiences', emoji: '✨'),
      QOption('Real conversations', emoji: '💬'),
      QOption('Something that feels right', emoji: '🌱'),
      QOption('Learning together', emoji: '🤝'),
    ],
    more: [
      QOption('No performance required', emoji: '🛡'),
      QOption('A gentle beginning', emoji: '🌸'),
      QOption('Figuring it out as we go', emoji: '🧩'),
      QOption('Something real and unhurried', emoji: '🌟'),
    ],
  ),
  QSection(
    key: 'what_matters', kind: QKind.multi, icon: '💙',
    title: 'What matters most', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Sincerity over polish', emoji: '💎'),
      QOption('Patience over pressure', emoji: '🕊'),
      QOption('Real over perfect', emoji: '✅'),
      QOption('Kindness above all', emoji: '🤍'),
      QOption('No games', emoji: '🚫'),
    ],
    more: [
      QOption('No rush', emoji: '🌊'),
      QOption('Let it be what it is', emoji: '🌱'),
      QOption('Open and easy conversation', emoji: '💬'),
      QOption('Genuine care', emoji: '🙏'),
    ],
  ),
  QSection(
    key: 'chemistry', kind: QKind.multi, icon: '⚡',
    title: 'Chemistry you enjoy', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Nervous excitement', emoji: '⚡'),
      QOption('Natural rapport', emoji: '😊'),
      QOption('Genuine curiosity', emoji: '🔍'),
      QOption('The simple joy of talking', emoji: '😊'),
      QOption('Shy smiles that mean something', emoji: '🌸'),
    ],
    more: [
      QOption('Feeling understood for the first time', emoji: '🫶'),
      QOption('Quiet comfort', emoji: '🌙'),
      QOption('Slow discovery', emoji: '🌱'),
      QOption('Something new and exciting', emoji: '✨'),
    ],
  ),
];

const List<QSection> _drawnToSecondChapter = [
  QSection(
    key: 'what_you_seek', kind: QKind.multi, icon: '🔄',
    title: "What you're looking for", sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Emotionally mature', emoji: '🧘'),
      QOption('Grounded and settled', emoji: '⚓'),
      QOption('Wise from experience', emoji: '🏛'),
      QOption('Ready — not just willing', emoji: '✅'),
      QOption('Genuinely available', emoji: '🤝'),
    ],
    more: [
      QOption("Doesn't bring old drama", emoji: '🚫'),
      QOption('Knows themselves', emoji: '🔍'),
      QOption('Established in life', emoji: '🏗'),
      QOption('Clear communicator', emoji: '💬'),
    ],
  ),
  QSection(
    key: 'this_chapter', kind: QKind.multi, icon: '📖',
    title: 'What this chapter is about', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Building something better this time', emoji: '🏗'),
      QOption('Not repeating old patterns', emoji: '🚫'),
      QOption('Appreciation over infatuation', emoji: '🫶'),
      QOption('Partnership with real depth', emoji: '🌊'),
      QOption('Learning from before, not living in it', emoji: '🌱'),
    ],
    more: [
      QOption("Someone who knows what they've got", emoji: '💎'),
      QOption('Starting fresh with wisdom', emoji: '🌅'),
      QOption('Earned trust, not assumed', emoji: '🔑'),
      QOption('Real connection, not just company', emoji: '✨'),
    ],
  ),
  QSection(
    key: 'what_you_appreciate', kind: QKind.multi, icon: '💛',
    title: 'What you appreciate', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Emotional availability', emoji: '❤️'),
      QOption('Patience built from experience', emoji: '🕊'),
      QOption('Honest communication', emoji: '💬'),
      QOption('Stability', emoji: '⚓'),
      QOption('Genuine readiness', emoji: '✅'),
    ],
    more: [
      QOption('No games at this stage', emoji: '🚫'),
      QOption('Someone who means it', emoji: '🤝'),
      QOption('Grounded, not perfect', emoji: '🧘'),
      QOption('Softness without weakness', emoji: '🌸'),
    ],
  ),
  QSection(
    key: 'chemistry', kind: QKind.multi, icon: '🔥',
    title: 'Chemistry you enjoy', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Deep comfort that arrives slowly', emoji: '🏠'),
      QOption('Rebuilt trust', emoji: '🔑'),
      QOption('Mature attraction', emoji: '💛'),
      QOption('Realness over butterflies', emoji: '💬'),
      QOption('Easy conversation', emoji: '🌙'),
    ],
    more: [
      QOption('The kind that feels like coming home', emoji: '🏡'),
      QOption('Earned closeness', emoji: '📈'),
      QOption('Steady warmth', emoji: '🌿'),
      QOption('Attraction without urgency', emoji: '✨'),
    ],
  ),
];

const List<QSection> _drawnToJustFriends = [
  QSection(
    key: 'friend_energy', kind: QKind.multi, icon: '🤝',
    title: 'Friend energy', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Easy to talk to', emoji: '😊'),
      QOption('Genuinely funny', emoji: '😂'),
      QOption('Good listener', emoji: '👂'),
      QOption('Low-drama', emoji: '🧘'),
      QOption('Authentic', emoji: '💎'),
    ],
    more: [
      QOption('Keeps it real', emoji: '💬'),
      QOption("Doesn't overthink", emoji: '🚀'),
      QOption('Interested in others', emoji: '🔍'),
      QOption('Reliable', emoji: '✅'),
    ],
  ),
  QSection(
    key: 'activities', kind: QKind.multi, icon: '🎉',
    title: 'Activities you enjoy', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Coffee & conversations', emoji: '☕'),
      QOption('Spontaneous plans', emoji: '🎲'),
      QOption('Intellectual discussions', emoji: '🧠'),
      QOption('Outdoor activities', emoji: '🏞'),
      QOption('Good food & music', emoji: '🍽'),
    ],
    more: [
      QOption('Group hangouts', emoji: '👥'),
      QOption('Creative projects', emoji: '🎨'),
      QOption('Watching sport together', emoji: '⚽'),
      QOption('Exploring the city', emoji: '🌆'),
    ],
  ),
  QSection(
    key: 'great_connection', kind: QKind.multi, icon: '✨',
    title: 'What makes a great connection', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Natural conversation flow', emoji: '💬'),
      QOption('Shared sense of humour', emoji: '😄'),
      QOption('Can talk about anything', emoji: '🌊'),
      QOption('Comfortable silence', emoji: '🤫'),
      QOption('Zero awkwardness', emoji: '🚫'),
    ],
    more: [
      QOption('No hidden agenda', emoji: '✅'),
      QOption('Mutual respect', emoji: '🤝'),
      QOption('Direct and real', emoji: '💬'),
      QOption('Easy to be around', emoji: '🌟'),
    ],
  ),
  QSection(
    key: 'vibe', kind: QKind.multi, icon: '🌊',
    title: 'Vibe you enjoy', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Warm and easy-going', emoji: '😌'),
      QOption('Intellectually stimulating', emoji: '💡'),
      QOption('Adventurous without pressure', emoji: '🎭'),
      QOption('Funny and laid-back', emoji: '😂'),
      QOption('Just genuinely real', emoji: '🌿'),
    ],
    more: [
      QOption('Makes plans and shows up', emoji: '✅'),
      QOption('No performance', emoji: '🎯'),
      QOption('Good energy to be around', emoji: '⚡'),
      QOption('Comfortable in their own skin', emoji: '🤝'),
    ],
  ),
];

// ─────────────────────────────────────────────────────────────────────────
// HowYouLive question sets (mixed kinds; some private)
// ─────────────────────────────────────────────────────────────────────────

const List<QSection> _howCasualMan = [
  QSection(
    key: 'chemistry', kind: QKind.multi, icon: '💋',
    title: 'Chemistry & intimacy', sub: 'Pick any · private to you', private: true, max: 5,
    options: [
      QOption('PDA', emoji: '💋'),
      QOption('Teasing & flirtation', emoji: '😏'),
      QOption('Sensual connection', emoji: '🌹'),
      QOption('Exploring fantasies', emoji: '✨'),
      QOption('Prefer discretion', emoji: '🔒'),
    ],
    more: [
      QOption('Roleplay', emoji: '🕯'),
      QOption('Power dynamics', emoji: '🎭'),
      QOption('BDSM-friendly', emoji: '🖤'),
      QOption('Open relationships', emoji: '💫'),
    ],
  ),
  QSection(
    key: 'lifestyle', kind: QKind.card, icon: '💼',
    title: 'Your current lifestyle', sub: 'Pick the closest match',
    options: [
      QOption('Comfortable & established', emoji: '✅', sub: 'Stable income, settled into life'),
      QOption('High-income lifestyle', emoji: '💰', sub: 'Strong earner, comfortable spending'),
      QOption('Executive / founder', emoji: '🏢', sub: 'Senior leadership, building something'),
      QOption('Luxury-oriented', emoji: '💎', sub: 'Quality over quantity, premium tastes'),
      QOption('Confident & generous', emoji: '🤝', sub: 'Financially open with people you care about'),
    ],
  ),
  QSection(
    key: 'income', kind: QKind.single, icon: '💰',
    title: 'Approximate annual income', sub: 'Optional · only used to refine matches', private: true,
    options: [
      QOption('Under ₹25L'),
      QOption('₹25L – ₹50L'),
      QOption('₹50L – ₹1Cr'),
      QOption('₹1Cr – ₹3Cr'),
      QOption('₹3Cr – ₹10Cr'),
      QOption('₹10Cr+'),
      QOption('Prefer not to say', emoji: '🔒', quiet: true),
    ],
  ),
  QSection(
    key: 'standards', kind: QKind.multi, icon: '🛡',
    title: 'Standards that matter', sub: 'Pick up to 5', max: 5,
    options: [
      QOption('Honest communication', emoji: '💬'),
      QOption('Emotional maturity', emoji: '❤️'),
      QOption('Mutual respect', emoji: '🤝'),
      QOption('Drama-free', emoji: '🧘'),
      QOption('Consistency', emoji: '🌹'),
    ],
    more: [
      QOption('Discretion matters', emoji: '🔒'),
      QOption('Clear expectations', emoji: '✨'),
      QOption('Safety & trust first', emoji: '🛡'),
      QOption('Verified profiles preferred', emoji: '🔍'),
      QOption('No games or manipulation', emoji: '🚫'),
      QOption('Privacy respected', emoji: '🔐'),
      QOption('Respect for boundaries', emoji: '❤️'),
    ],
  ),
];

const List<QSection> _howSpoiledCasual = [
  QSection(
    key: 'vibe', kind: QKind.card, icon: '✨',
    title: 'Your day-to-day vibe', sub: 'Pick the closest match',
    options: [
      QOption('Low-key luxury', emoji: '💅', sub: 'Selective, private, effortlessly elevated'),
      QOption('Social & spontaneous', emoji: '🌸', sub: 'Love going out, meeting people, staying active'),
      QOption('Homebody at heart', emoji: '🏠', sub: 'Comfort-first — cosy > chaotic'),
      QOption('Always on the move', emoji: '✈️', sub: 'Travel, events, never really settling in one place'),
      QOption('Balanced & relaxed', emoji: '🌊', sub: 'Mix of both — depends on the week'),
    ],
  ),
  QSection(
    key: 'how_you_like_to_be_treated', kind: QKind.multi, icon: '💎',
    title: 'How you like to be treated', sub: 'Pick up to 4', max: 4,
    options: [
      QOption('Thoughtful gifting', emoji: '🎁'),
      QOption('Consistent romance', emoji: '🌹'),
      QOption('Undivided attention', emoji: '💬'),
      QOption('Elevated experiences', emoji: '✈️'),
      QOption('Generous without being asked', emoji: '🛍'),
    ],
    more: [
      QOption('Surprise upgrades', emoji: '🍾'),
      QOption('Picked up & dropped off', emoji: '🚗'),
      QOption('Nice hotels, no questions', emoji: '🏨'),
      QOption('Small gestures that show effort', emoji: '💐'),
    ],
  ),
  QSection(
    key: 'standards', kind: QKind.multi, icon: '🛡',
    title: 'Standards you hold', sub: 'Pick up to 5', max: 5,
    options: [
      QOption('Discretion matters', emoji: '🔒'),
      QOption('Drama-free only', emoji: '🧘'),
      QOption('Honest & direct', emoji: '💬'),
      QOption('Mutual respect', emoji: '🤝'),
      QOption('No games or pressure', emoji: '🚫'),
    ],
    more: [
      QOption('Clear expectations from the start', emoji: '✅'),
      QOption('Privacy respected', emoji: '🔐'),
      QOption('Safety & trust first', emoji: '🛡'),
      QOption('Respects my boundaries', emoji: '❤️'),
      QOption('Verified profiles preferred', emoji: '🔍'),
    ],
  ),
  QSection(
    key: 'chemistry', kind: QKind.multi, icon: '💋',
    title: 'Chemistry & connection', sub: 'Pick any · private to you', private: true, max: 5,
    options: [
      QOption('Playful flirtation', emoji: '😏'),
      QOption('Natural affection', emoji: '💋'),
      QOption('Slow-burn tension', emoji: '🕯'),
      QOption('Romance over rush', emoji: '🌹'),
      QOption('Prefer discretion', emoji: '🔒'),
    ],
    more: [
      QOption('Instant spark', emoji: '⚡'),
      QOption('Good conversation first', emoji: '🥂'),
      QOption('Open-minded connection', emoji: '🌌'),
      QOption('Keep it casual', emoji: '💫'),
    ],
  ),
];

const List<QSection> _howRomantic = [
  QSection(
    key: 'emotional_openness', kind: QKind.card, icon: '🫀',
    title: 'How open are you emotionally?', sub: 'Pick the closest to where you are',
    options: [
      QOption('Fully open and ready', emoji: '💚', sub: 'Heart on my sleeve — I dive in'),
      QOption('Cautiously open', emoji: '🌱', sub: 'Open, but I take time to trust'),
      QOption('Getting there', emoji: '🕊', sub: 'Working on opening up more'),
      QOption('Selective', emoji: '🧱', sub: 'Only open with the right person'),
    ],
  ),
  QSection(
    key: 'how_you_show_up', kind: QKind.multi, icon: '💬',
    title: 'How you show up in a relationship', sub: 'Pick up to 4', max: 4,
    options: [
      QOption('Daily check-ins', emoji: '📅'),
      QOption('Deep conversations', emoji: '💬'),
      QOption('Expressing feelings naturally', emoji: '❤️'),
      QOption('Acts of care and service', emoji: '🙌'),
      QOption('Remembering what matters to them', emoji: '🧠'),
    ],
    more: [
      QOption('Thoughtful surprises', emoji: '🎁'),
      QOption('Being available when needed', emoji: '📞'),
      QOption('Grand romantic gestures', emoji: '🌹'),
      QOption('Showing love quietly but deeply', emoji: '🤫'),
    ],
  ),
  QSection(
    key: 'what_youre_done_with', kind: QKind.multi, icon: '🚫',
    title: "What you're done settling for", sub: 'Pick up to 4 · private', private: true, max: 4,
    options: [
      QOption('Emotional unavailability', emoji: '🧊'),
      QOption('Surface-level connections', emoji: '🎭'),
      QOption('Mixed signals', emoji: '❓'),
      QOption('Being an afterthought', emoji: '🪞'),
      QOption('Hot and cold behaviour', emoji: '🌡'),
    ],
    more: [
      QOption('One-sided effort', emoji: '😶'),
      QOption("People who can't communicate", emoji: '💬'),
      QOption('Half-in, half-out energy', emoji: '🚪'),
      QOption('Love that drains instead of fills', emoji: '🥀'),
    ],
  ),
  QSection(
    key: 'standards', kind: QKind.multi, icon: '🌟',
    title: 'Relationship standards', sub: 'Pick up to 5', max: 5,
    options: [
      QOption('Emotional availability', emoji: '❤️'),
      QOption('Consistent communication', emoji: '💬'),
      QOption('Faithfulness and loyalty', emoji: '🛡️'),
      QOption('Making each other a priority', emoji: '🌟'),
      QOption("Being each other's safe place", emoji: '🏠'),
    ],
    more: [
      QOption('Mutual respect', emoji: '🤝'),
      QOption('Intentional romance', emoji: '🌹'),
      QOption('Drama-free love', emoji: '🧘'),
      QOption('Growing together', emoji: '🔑'),
      QOption('Emotional intelligence', emoji: '🧠'),
    ],
  ),
];

const List<QSection> _howForever = [
  QSection(
    key: 'life_stage', kind: QKind.card, icon: '🚀',
    title: 'Where you are in life', sub: 'Pick the closest match',
    options: [
      QOption('Building my career and future', emoji: '🏗', sub: 'Ambitious, still setting up the foundation'),
      QOption('Established and ready to settle', emoji: '✅', sub: 'In a great place — ready for the next chapter'),
      QOption('Balancing ambition and personal life', emoji: '⚖️', sub: 'Growing professionally, ready emotionally'),
      QOption('Completely ready to commit now', emoji: '🎯', sub: 'Done waiting — looking for the right person'),
    ],
  ),
  QSection(
    key: 'timeline', kind: QKind.single, icon: '📅',
    title: 'Your timeline', sub: 'When are you ready to commit?',
    options: [
      QOption('Ready now', emoji: '⚡'),
      QOption('Within this year', emoji: '📅'),
      QOption('In the next few years', emoji: '🌱'),
      QOption('When the right person comes', emoji: '🌊'),
    ],
  ),
  QSection(
    key: 'non_negotiables', kind: QKind.multi, icon: '🔑',
    title: 'Non-negotiables', sub: 'Pick up to 4 · private', private: true, max: 4,
    options: [
      QOption('Loyalty', emoji: '🛡️'),
      QOption('Aligned on children', emoji: '👨‍👩‍👧'),
      QOption('Financial responsibility', emoji: '💰'),
      QOption('Honest communication', emoji: '💬'),
      QOption('Emotional maturity', emoji: '🧘'),
    ],
    more: [
      QOption('No games', emoji: '🚫'),
      QOption('Consistent effort', emoji: '🌟'),
      QOption('Family-oriented', emoji: '🏡'),
      QOption('Growth mindset', emoji: '📈'),
      QOption('Mutual respect', emoji: '🤝'),
    ],
  ),
  QSection(
    key: 'relationship_approach', kind: QKind.multi, icon: '🎯',
    title: 'Relationship approach', sub: 'Pick up to 3', max: 3,
    options: [
      QOption('Intentional dating from day one', emoji: '🎯'),
      QOption('Direct about what I want', emoji: '💬'),
      QOption('No casual involvement', emoji: '🚫'),
      QOption('Patient but purposeful', emoji: '🌱'),
      QOption('Looking for my person — not a placeholder', emoji: '🧭'),
    ],
    more: [
      QOption('Clear expectations early', emoji: '📋'),
      QOption('Partnership mentality', emoji: '🤝'),
      QOption('Building something great', emoji: '📈'),
    ],
  ),
];

const List<QSection> _howMatrimony = [
  QSection(
    key: 'marital_status', kind: QKind.single, icon: '💍',
    title: 'Your marital status', sub: 'Select one',
    options: [
      QOption('Never married', emoji: '✨'),
      QOption('Divorced', emoji: '🔄'),
      QOption('Widowed', emoji: '🕊'),
    ],
  ),
  QSection(
    key: 'religion', kind: QKind.single, icon: '🕌',
    title: 'Your religion', sub: 'Select one',
    options: [
      QOption('Hindu', emoji: '🕉'),
      QOption('Muslim', emoji: '☪️'),
      QOption('Christian', emoji: '✝️'),
      QOption('Sikh', emoji: '🔱'),
      QOption('Buddhist', emoji: '☸️'),
      QOption('Jain', emoji: '🔶'),
      QOption('Other', emoji: '🌐'),
    ],
  ),
  QSection(
    key: 'lifestyle', kind: QKind.multi, icon: '🌿',
    title: 'Your lifestyle', sub: 'Select all that apply', max: 5,
    options: [
      QOption('Vegetarian', emoji: '🥗'),
      QOption('Non-smoker', emoji: '🚭'),
      QOption('Non-drinker', emoji: '🚱'),
      QOption('Religiously practicing', emoji: '🙏'),
      QOption('Family-oriented', emoji: '👨‍👩‍👧'),
      QOption('Fitness-focused', emoji: '💪'),
    ],
  ),
  QSection(
    key: 'income', kind: QKind.single, icon: '💰',
    title: 'Annual income (optional)', sub: 'Helps with serious matrimony matching', private: true,
    options: [
      QOption('Under ₹5L'),
      QOption('₹5L – ₹10L'),
      QOption('₹10L – ₹25L'),
      QOption('₹25L – ₹50L'),
      QOption('₹50L+'),
      QOption('Prefer not to say', emoji: '🔒', quiet: true),
    ],
  ),
];

const List<QSection> _howRebound = [
  QSection(
    key: 'where_you_are', kind: QKind.card, icon: '🌱',
    title: 'Where you are right now', sub: 'Be honest — it helps us match well',
    options: [
      QOption('Just starting to explore again', emoji: '🌱', sub: 'Very early days — nothing intense'),
      QOption('Dipping my toes in', emoji: '🏊', sub: 'Curious and a little cautious'),
      QOption('Getting more comfortable', emoji: '🌿', sub: 'More ready than I was'),
      QOption('Ready but taking it slow', emoji: '✅', sub: 'Healed enough — just careful'),
    ],
  ),
  QSection(
    key: 'what_you_need', kind: QKind.multi, icon: '🤲',
    title: 'What you need', sub: 'Pick up to 4', max: 4,
    options: [
      QOption('Patience with my pace', emoji: '⏳'),
      QOption('No pressure to define anything', emoji: '🚫'),
      QOption('Honest and real connection', emoji: '💬'),
      QOption('Good company without expectations', emoji: '☕'),
      QOption('Someone who gets it', emoji: '🕊'),
    ],
    more: [
      QOption('Space when I need it', emoji: '🤫'),
      QOption('Easy, low-key interactions', emoji: '😊'),
      QOption('Zero drama', emoji: '🧘'),
      QOption('Warmth without obligation', emoji: '💛'),
    ],
  ),
  QSection(
    key: 'comfort_level', kind: QKind.single, icon: '🌡',
    title: 'Your comfort level', sub: 'Where are you at?',
    options: [
      QOption('Very casual interactions only', emoji: '☕'),
      QOption('Friendly texting and meetups', emoji: '📱'),
      QOption('Something that could grow slowly', emoji: '🌱'),
      QOption('Open but absolutely no rushing', emoji: '🚪'),
    ],
  ),
  QSection(
    key: 'standards', kind: QKind.multi, icon: '🛡',
    title: 'Standards you hold', sub: 'Pick up to 4', max: 4,
    options: [
      QOption('Honesty', emoji: '💬'),
      QOption('Drama-free', emoji: '🧘'),
      QOption('Emotional steadiness', emoji: '⚓'),
      QOption("Respects where I'm at", emoji: '🤝'),
      QOption('No manipulation', emoji: '🚫'),
    ],
    more: [
      QOption('Patient without resentment', emoji: '🕊'),
      QOption('Direct and honest', emoji: '💬'),
      QOption('Low-pressure energy', emoji: '🌿'),
      QOption('Genuine care', emoji: '❤️'),
    ],
  ),
];

const List<QSection> _howUntouched = [
  QSection(
    key: 'experience_level', kind: QKind.card, icon: '🕊️',
    title: "Where you're coming from", sub: 'Be yourself — this is a judgement-free zone',
    options: [
      QOption('Complete beginner — owning it', emoji: '🌟', sub: 'Zero experience, totally okay with that'),
      QOption('Had a little, nothing serious', emoji: '🌱', sub: 'Dipped a toe in but never really dated'),
      QOption('Still figuring out what I want', emoji: '🧭', sub: 'Exploring what dating even means for me'),
      QOption('Ready to genuinely try', emoji: '✅', sub: 'Decided this is the time'),
    ],
  ),
  QSection(
    key: 'what_excites_you', kind: QKind.multi, icon: '🌸',
    title: 'What excites you about this', sub: 'Pick up to 4', max: 4,
    options: [
      QOption('Meeting someone new', emoji: '✨'),
      QOption('Real first-time experiences', emoji: '🌱'),
      QOption('Figuring out how this all works', emoji: '🔍'),
      QOption('Finding someone genuine', emoji: '💎'),
      QOption("An adventure I haven't been on", emoji: '🗺'),
    ],
    more: [
      QOption('Having real conversations', emoji: '💬'),
      QOption('Learning about myself through this', emoji: '🧩'),
      QOption('A connection that feels safe', emoji: '🤝'),
      QOption("Seeing what's possible", emoji: '🌟'),
    ],
  ),
  QSection(
    key: 'what_you_need', kind: QKind.multi, icon: '🤲',
    title: 'What you need', sub: 'Pick up to 4', max: 4,
    options: [
      QOption('Patience', emoji: '⏳'),
      QOption('No pressure', emoji: '🌊'),
      QOption('Someone as sincere as me', emoji: '💎'),
      QOption('A gentle start', emoji: '🌸'),
      QOption('No games or confusion', emoji: '🚫'),
    ],
    more: [
      QOption('Clear and honest communication', emoji: '💬'),
      QOption('Warmth without overwhelming', emoji: '🤗'),
      QOption('Safety to be exactly where I am', emoji: '🛡'),
    ],
  ),
  QSection(
    key: 'values', kind: QKind.multi, icon: '💙',
    title: 'What matters most to you', sub: 'Pick up to 4', max: 4,
    options: [
      QOption('Honesty above everything', emoji: '💬'),
      QOption('Kindness', emoji: '🤍'),
      QOption('No games', emoji: '🚫'),
      QOption('Taking time', emoji: '🌊'),
      QOption('Being genuinely real', emoji: '🌟'),
    ],
    more: [
      QOption('Respect', emoji: '🙏'),
      QOption('Warmth', emoji: '💛'),
      QOption('Sincerity over polish', emoji: '✅'),
      QOption('Mutual curiosity', emoji: '🤝'),
    ],
  ),
];

const List<QSection> _howSecondChapter = [
  QSection(
    key: 'where_you_are', kind: QKind.card, icon: '🔄',
    title: 'Where you are right now', sub: 'Pick the most honest answer',
    options: [
      QOption('Genuinely ready — learned and grown', emoji: '✅', sub: 'Done processing, clear on who I am now'),
      QOption('Ready with a healthy perspective', emoji: '🌿', sub: 'Past it — open and grounded'),
      QOption('Careful but open', emoji: '🚪', sub: 'Willing, just not rushing in'),
      QOption('Hopeful, going slowly', emoji: '🌱', sub: 'Optimistic but taking my time'),
    ],
  ),
  QSection(
    key: 'what_is_different', kind: QKind.multi, icon: '💡',
    title: "What's different this time", sub: 'Pick up to 4', max: 4,
    options: [
      QOption('I know myself better', emoji: '🧘'),
      QOption('Not carrying the past', emoji: '🚫'),
      QOption('I know what I actually need', emoji: '🔍'),
      QOption("I've done the work", emoji: '💪'),
      QOption('My standards are clearer', emoji: '🌱'),
    ],
    more: [
      QOption('More grounded than before', emoji: '⚓'),
      QOption('Better at communicating now', emoji: '💬'),
      QOption('Appreciation over infatuation', emoji: '🌟'),
      QOption('Know my non-negotiables', emoji: '🎯'),
    ],
  ),
  QSection(
    key: 'what_you_need', kind: QKind.multi, icon: '🤲',
    title: 'What you need this time', sub: 'Pick up to 4', max: 4,
    options: [
      QOption('No rush to fill a role', emoji: '🚫'),
      QOption('Emotional availability', emoji: '❤️'),
      QOption('Genuine readiness', emoji: '✅'),
      QOption('Someone who means it', emoji: '🤝'),
      QOption('Honest communication from the start', emoji: '💬'),
    ],
    more: [
      QOption('Patience and steadiness', emoji: '🧘'),
      QOption('Space to grow together', emoji: '🌱'),
      QOption('Warmth without urgency', emoji: '💛'),
      QOption('Safety to be real', emoji: '🛡'),
    ],
  ),
  QSection(
    key: 'non_negotiables', kind: QKind.multi, icon: '🔑',
    title: 'Non-negotiables · private', sub: 'Pick up to 4', private: true, max: 4,
    options: [
      QOption('No drama', emoji: '🧘'),
      QOption('Honest communication', emoji: '💬'),
      QOption('Emotional maturity', emoji: '🌟'),
      QOption('Knowing what they want', emoji: '🎯'),
      QOption('Mutual respect', emoji: '🤝'),
    ],
    more: [
      QOption('Not in a hurry to perform', emoji: '⏳'),
      QOption('Consistent and reliable', emoji: '🛡'),
      QOption('Genuine warmth', emoji: '🌹'),
      QOption('Ready to actually show up', emoji: '✅'),
    ],
  ),
];

const List<QSection> _howJustFriends = [
  QSection(
    key: 'social_style', kind: QKind.card, icon: '👥',
    title: 'Your social style', sub: 'Pick the closest match',
    options: [
      QOption('One-on-one conversations', emoji: '☕', sub: 'I prefer depth over group dynamics'),
      QOption('Small group hangouts', emoji: '👥', sub: 'A few good people is perfect'),
      QOption('Large social circles', emoji: '🎉', sub: 'Love meeting lots of people'),
      QOption('Mix of both', emoji: '🔄', sub: 'Depends on the mood'),
    ],
  ),
  QSection(
    key: 'what_you_enjoy', kind: QKind.multi, icon: '🎉',
    title: 'Activities you enjoy', sub: 'Pick up to 5', max: 5,
    options: [
      QOption('Eating out', emoji: '🍽'),
      QOption('Outdoor activities', emoji: '🏞'),
      QOption('Watching films or sport', emoji: '🎬'),
      QOption('Creative projects', emoji: '🎨'),
      QOption('Fitness activities', emoji: '💪'),
    ],
    more: [
      QOption('Concerts & live music', emoji: '🎵'),
      QOption('Travelling', emoji: '✈️'),
      QOption('Intellectual discussions', emoji: '🧠'),
      QOption('Exploring the city', emoji: '🌆'),
      QOption('Gaming', emoji: '🎮'),
      QOption('Books & culture', emoji: '📚'),
    ],
  ),
  QSection(
    key: 'good_friend_traits', kind: QKind.multi, icon: '🤝',
    title: 'What makes a good friend', sub: 'Pick up to 4', max: 4,
    options: [
      QOption('Shows up when they say they will', emoji: '✅'),
      QOption('Honest', emoji: '💬'),
      QOption('Easy to be around', emoji: '😊'),
      QOption('Good conversation', emoji: '🔑'),
      QOption('Respects space', emoji: '🤝'),
    ],
    more: [
      QOption('Funny', emoji: '😂'),
      QOption('Real talk, not small talk', emoji: '💬'),
      QOption('Actually responds', emoji: '📞'),
      QOption('No drama', emoji: '🌿'),
    ],
  ),
  QSection(
    key: 'comfort_zone', kind: QKind.single, icon: '🌊',
    title: "What you're open to", sub: 'Keep it real',
    options: [
      QOption('Keep it casual and fun', emoji: '😊'),
      QOption('Open to heartfelt conversations too', emoji: '💬'),
      QOption('Friendship first — see what happens', emoji: '🌱'),
      QOption('Platonic only', emoji: '🤝'),
    ],
  ),
];

// ─────────────────────────────────────────────────────────────────────────
// Public selectors
// ─────────────────────────────────────────────────────────────────────────

List<QSection> drawnToSections(String a) {
  if (a == 'casual_generous_man' || a == 'spoiled_casual_woman') return _drawnToCasual;
  if (a == 'hopeless_romantic_man' || a == 'hopeless_romantic_woman') return _drawnToRomantic;
  if (a == 'forever_focused_man' || a == 'forever_focused_woman') return _drawnToForever;
  if (a == 'traditional_matrimony_man' || a == 'traditional_matrimony_woman') return _drawnToMatrimony;
  if (a == 'rebound_healing_man' || a == 'rebound_healing_woman') return _drawnToRebound;
  if (a == 'untouched_heart_man' || a == 'untouched_heart_woman') return _drawnToUntouched;
  if (a == 'second_chapter_man' || a == 'second_chapter_woman') return _drawnToSecondChapter;
  if (a == 'just_friends_man' || a == 'just_friends_woman') return _drawnToJustFriends;
  return _drawnToCasual; // sensible default
}

String drawnToTitle(String a) {
  if (a == 'hopeless_romantic_man' || a == 'hopeless_romantic_woman') return "What you're drawn to in a person.";
  if (a == 'forever_focused_man' || a == 'forever_focused_woman') return "What you're building toward.";
  if (a == 'traditional_matrimony_man' || a == 'traditional_matrimony_woman') return "What you value in a partner.";
  if (a == 'rebound_healing_man' || a == 'rebound_healing_woman') return "What you need right now.";
  if (a == 'untouched_heart_man' || a == 'untouched_heart_woman') return "What you're hoping for.";
  if (a == 'second_chapter_man' || a == 'second_chapter_woman') return "What this chapter is about.";
  if (a == 'just_friends_man' || a == 'just_friends_woman') return "What makes a great connection.";
  return "What you're drawn to."; // casual / default
}

List<String> drawnToRequiredKeys(String a) =>
    drawnToSections(a).map((s) => s.key).toList();

List<QSection> howYouLiveSections(String a) {
  if (a == 'casual_generous_man') return _howCasualMan;
  if (a == 'spoiled_casual_woman') return _howSpoiledCasual;
  if (a == 'hopeless_romantic_man' || a == 'hopeless_romantic_woman') return _howRomantic;
  if (a == 'forever_focused_man' || a == 'forever_focused_woman') return _howForever;
  if (a == 'traditional_matrimony_man' || a == 'traditional_matrimony_woman') return _howMatrimony;
  if (a == 'rebound_healing_man' || a == 'rebound_healing_woman') return _howRebound;
  if (a == 'untouched_heart_man' || a == 'untouched_heart_woman') return _howUntouched;
  if (a == 'second_chapter_man' || a == 'second_chapter_woman') return _howSecondChapter;
  if (a == 'just_friends_man' || a == 'just_friends_woman') return _howJustFriends;
  return _howCasualMan; // default
}

List<String> howYouLiveRequiredKeys(String a) {
  if (a == 'casual_generous_man') return const ['chemistry', 'lifestyle', 'standards'];
  if (a == 'spoiled_casual_woman') return const ['vibe', 'standards', 'chemistry'];
  if (a == 'hopeless_romantic_man' || a == 'hopeless_romantic_woman') return const ['emotional_openness', 'how_you_show_up', 'standards'];
  if (a == 'forever_focused_man' || a == 'forever_focused_woman') return const ['life_stage', 'timeline', 'relationship_approach'];
  if (a == 'traditional_matrimony_man' || a == 'traditional_matrimony_woman') return const ['marital_status', 'religion', 'lifestyle'];
  if (a == 'rebound_healing_man' || a == 'rebound_healing_woman') return const ['where_you_are', 'what_you_need', 'comfort_level'];
  if (a == 'untouched_heart_man' || a == 'untouched_heart_woman') return const ['experience_level', 'what_excites_you', 'what_you_need'];
  if (a == 'second_chapter_man' || a == 'second_chapter_woman') return const ['where_you_are', 'what_is_different', 'what_you_need'];
  if (a == 'just_friends_man' || a == 'just_friends_woman') return const ['social_style', 'what_you_enjoy', 'good_friend_traits'];
  return const ['chemistry', 'lifestyle', 'standards']; // default (CASUAL_MAN)
}

String howYouLiveTitle(String a) {
  if (a == 'hopeless_romantic_man' || a == 'hopeless_romantic_woman') return "How you love and what you bring.";
  if (a == 'forever_focused_man' || a == 'forever_focused_woman') return "Where you are and where you're going.";
  if (a == 'traditional_matrimony_man' || a == 'traditional_matrimony_woman') return "Your background and lifestyle.";
  if (a == 'rebound_healing_man' || a == 'rebound_healing_woman') return "Where you are in your journey.";
  if (a == 'untouched_heart_man' || a == 'untouched_heart_woman') return "Where you're starting from.";
  if (a == 'second_chapter_man' || a == 'second_chapter_woman') return "What's different this time.";
  if (a == 'just_friends_man' || a == 'just_friends_woman') return "Your social style and interests.";
  if (a == 'spoiled_casual_woman') return "Your vibe and what you value.";
  return "How you live and what you value."; // casual / default
}
