/// Archetype catalog — mirrors src/lib/verified-vibe/constants.ts.
/// Includes id, emoji, name, tag, longTag, matchTraits, avoidTraits, brings.

class MatchTrait {
  final String tier; // 'best' | 'good'
  final String label;
  final bool lead;
  const MatchTrait(this.tier, this.label, {this.lead = false});
}

class AvoidTrait {
  final String label;
  const AvoidTrait(this.label);
}

class Archetype {
  final String id;
  final String emoji;
  final String name;
  final String tag;
  final String longTag;
  final List<MatchTrait> matchTraits;
  final List<AvoidTrait> avoidTraits;
  final List<String> brings;
  const Archetype(this.id, this.emoji, this.name, this.tag, {
    this.longTag = '',
    this.matchTraits = const [],
    this.avoidTraits = const [],
    this.brings = const [],
  });
}

class LaneSection {
  final String label;
  final List<Archetype> archetypes;
  const LaneSection(this.label, this.archetypes);
}

// ── Male archetypes ──────────────────────────────────────────────────────────

const _man = <String, Archetype>{
  'casual_generous_man': Archetype(
    'casual_generous_man', '💸', 'Casual-Generous',
    'Confident, generous, experiences over labels',
    longTag: 'You date well and you show it. Experiences over labels — dinners, weekends, no strings attached to who picks up the bill.',
    matchTraits: [
      MatchTrait('best', 'Spoiled-Casual Women', lead: true),
      MatchTrait('good', 'Rebound-Healing Women'),
      MatchTrait('good', 'Hopeless-Romantic Women'),
    ],
    avoidTraits: [AvoidTrait('Forever-Focused'), AvoidTrait('Traditional-Matrimony')],
    brings: ['Financial confidence', 'Upscale experiences', 'No-pressure energy', 'Privacy & discretion', 'Generosity as a love language', 'Clarity of intent'],
  ),
  'hopeless_romantic_man': Archetype(
    'hopeless_romantic_man', '💞', 'Hopeless-Romantic',
    'Emotionally intense, chasing the deep thing',
    longTag: 'You\'re not here for casual. You feel deeply and you\'re not ashamed of it. You want connection that means something.',
    matchTraits: [
      MatchTrait('best', 'Hopeless-Romantic Women', lead: true),
      MatchTrait('good', 'Untouched-Heart Women'),
      MatchTrait('good', 'Forever-Focused Women'),
      MatchTrait('good', 'Traditional-Matrimony Women'),
    ],
    avoidTraits: [AvoidTrait('Spoiled-Casual'), AvoidTrait('Rebound-Healing')],
    brings: ['Deep emotional availability', 'Fierce loyalty', 'Romantic intentionality', 'Vulnerability without weakness', 'Warmth & presence'],
  ),
  'rebound_healing_man': Archetype(
    'rebound_healing_man', '🌱', 'Rebound-Healing',
    'Recovering, honest, not rushing',
    longTag: 'You\'ve been through it. You\'re not hiding that — and you\'re not dragging it either. You\'re ready to explore, slowly.',
    matchTraits: [
      MatchTrait('best', 'Rebound-Healing Women', lead: true),
      MatchTrait('good', 'Untouched-Heart Women'),
      MatchTrait('good', 'Spoiled-Casual Women'),
    ],
    avoidTraits: [AvoidTrait('Forever-Focused'), AvoidTrait('Traditional-Matrimony')],
    brings: ['Hard-won emotional intelligence', 'Radical honesty', 'No-games energy', 'Self-awareness', 'Appreciation for real connection'],
  ),
  'untouched_heart_man': Archetype(
    'untouched_heart_man', '🕊️', 'Untouched-Heart',
    'Inexperienced, sincere, going slow',
    longTag: 'You haven\'t dated much, and you\'re owning it. You\'re thoughtful, sincere, and bringing zero baggage.',
    matchTraits: [
      MatchTrait('best', 'Untouched-Heart Women', lead: true),
      MatchTrait('good', 'Hopeless-Romantic Women'),
      MatchTrait('good', 'Forever-Focused Women'),
    ],
    avoidTraits: [AvoidTrait('Spoiled-Casual'), AvoidTrait('Rebound-Healing')],
    brings: ['Genuine curiosity', 'Open heart', 'Zero emotional baggage', 'Slow, intentional approach', 'Sincerity in every step'],
  ),
  'forever_focused_man': Archetype(
    'forever_focused_man', '🎯', 'Forever-Focused',
    'Marriage-minded, intentional, done with games',
    longTag: 'You\'re building something real and you\'re selective about who\'s in it. Intentional dating only — no maybes.',
    matchTraits: [
      MatchTrait('best', 'Forever-Focused Women', lead: true),
      MatchTrait('best', 'Traditional-Matrimony Women'),
      MatchTrait('good', 'Untouched-Heart Women'),
      MatchTrait('good', 'Hopeless-Romantic Women'),
    ],
    avoidTraits: [AvoidTrait('Spoiled-Casual'), AvoidTrait('Rebound-Healing')],
    brings: ['Long-term commitment', 'Financial stability', 'Partnership mindset', 'Clear communication', 'Emotional maturity', 'Settled, grounded lifestyle'],
  ),
  'traditional_matrimony_man': Archetype(
    'traditional_matrimony_man', '🏛️', 'Traditional-Matrimony',
    'Hard set on matrimony, family values',
    longTag: 'Marriage is the goal, not the conversation. Family fit, shared values, cultural alignment — these aren\'t compromises, they\'re the point.',
    matchTraits: [
      MatchTrait('best', 'Forever-Focused Women', lead: true),
      MatchTrait('best', 'Traditional-Matrimony Women'),
      MatchTrait('good', 'Untouched-Heart Women'),
      MatchTrait('good', 'Hopeless-Romantic Women'),
    ],
    avoidTraits: [AvoidTrait('Spoiled-Casual'), AvoidTrait('Rebound-Healing')],
    brings: ['Family-first values', 'Cultural alignment', 'Long-term commitment', 'Clear expectations', 'Stability & structure', 'Respect for tradition'],
  ),
  'second_chapter_man': Archetype(
    'second_chapter_man', '🔄', 'Second-Chapter',
    'Loved or married before, ready to do it right',
    longTag: 'You\'ve loved or married before. You\'re ready to try again — right this time. No bitterness, no rush. Just wisdom and the will to build something real.',
    matchTraits: [
      MatchTrait('best', 'Second-Chapter Women', lead: true),
      MatchTrait('good', 'Traditional-Matrimony Women'),
      MatchTrait('good', 'Forever-Focused Women'),
    ],
    avoidTraits: [AvoidTrait('Casual-Generous'), AvoidTrait('Rebound-Healing')],
    brings: ['Hard-won emotional wisdom', 'Maturity without cynicism', 'Deep appreciation for real love', 'Patience built from experience', 'Clarity on what actually matters'],
  ),
  'just_friends_man': Archetype(
    'just_friends_man', '🤝', 'Just-Friends',
    'Not looking to date — looking to connect',
    longTag: 'You\'re not here for romance. You\'re here to find real people — conversations that go somewhere, energy that feels good, zero pressure attached.',
    matchTraits: [
      MatchTrait('best', 'Just-Friends Women', lead: true),
      MatchTrait('good', 'Untouched-Heart Women'),
      MatchTrait('good', 'Rebound-Healing Women'),
    ],
    avoidTraits: [AvoidTrait('Forever-Focused'), AvoidTrait('Traditional-Matrimony')],
    brings: ['Zero pressure or agenda', 'Genuine company', 'Platonic loyalty', 'Good conversation', 'A safe, honest space'],
  ),
};

// ── Female archetypes ────────────────────────────────────────────────────────

const _woman = <String, Archetype>{
  'spoiled_casual_woman': Archetype(
    'spoiled_casual_woman', '✨', 'Spoiled-Casual',
    'Luxury vibes, treated well, no pressure',
    longTag: 'You want to be wined, dined and genuinely enjoyed — without labels and without apology. Life is short; experience it at full quality.',
    matchTraits: [
      MatchTrait('best', 'Casual-Generous Men', lead: true),
      MatchTrait('good', 'Rebound-Healing Men'),
    ],
    avoidTraits: [AvoidTrait('Forever-Focused'), AvoidTrait('Traditional-Matrimony'), AvoidTrait('Hopeless-Romantic')],
    brings: ['Elegance & poise', 'High social IQ', 'Conversation that actually lands', 'Style & taste', 'Loyalty when chosen', 'Genuine appreciation for effort'],
  ),
  'hopeless_romantic_woman': Archetype(
    'hopeless_romantic_woman', '🌹', 'Hopeless-Romantic',
    'Emotionally intense, chasing the deep thing',
    longTag: 'You feel everything and you\'re not sorry about it. You want a love that\'s real, consuming and worth the risk.',
    matchTraits: [
      MatchTrait('best', 'Hopeless-Romantic Men', lead: true),
      MatchTrait('good', 'Untouched-Heart Men'),
      MatchTrait('good', 'Forever-Focused Men'),
    ],
    avoidTraits: [AvoidTrait('Casual-Generous'), AvoidTrait('Rebound-Healing')],
    brings: ['Deep emotional availability', 'Fierce loyalty', 'Romantic intentionality', 'Warmth & unwavering presence', 'The kind of love that lingers'],
  ),
  'rebound_healing_woman': Archetype(
    'rebound_healing_woman', '🌿', 'Rebound-Healing',
    'Recovering, honest, finding her footing',
    longTag: 'You\'ve come out the other side and you know yourself better for it. You\'re not guarded — you\'re thoughtful.',
    matchTraits: [
      MatchTrait('best', 'Rebound-Healing Men', lead: true),
      MatchTrait('good', 'Untouched-Heart Men'),
      MatchTrait('good', 'Casual-Generous Men'),
    ],
    avoidTraits: [AvoidTrait('Traditional-Matrimony'), AvoidTrait('Forever-Focused')],
    brings: ['Hard-won self-awareness', 'Empathy without co-dependence', 'Emotional authenticity', 'No baggage disguised as personality', 'Perspective that makes you a better partner'],
  ),
  'untouched_heart_woman': Archetype(
    'untouched_heart_woman', '🌸', 'Untouched-Heart',
    'First steps, sincere, no games in her',
    longTag: 'You haven\'t dated much, and you\'re bringing exactly that energy — open, curious and completely without agenda.',
    matchTraits: [
      MatchTrait('best', 'Untouched-Heart Men', lead: true),
      MatchTrait('good', 'Hopeless-Romantic Men'),
      MatchTrait('good', 'Forever-Focused Men'),
    ],
    avoidTraits: [AvoidTrait('Casual-Generous'), AvoidTrait('Rebound-Healing')],
    brings: ['Genuine curiosity', 'Zero emotional baggage', 'Completely open heart', 'Slow, intentional pace', 'Sincerity at every stage'],
  ),
  'forever_focused_woman': Archetype(
    'forever_focused_woman', '💍', 'Forever-Focused',
    'Marriage-minded, knows what she wants',
    longTag: 'You\'re not auditioning anyone. You know what you\'re building and who belongs in it. Intentional — every step.',
    matchTraits: [
      MatchTrait('best', 'Forever-Focused Men', lead: true),
      MatchTrait('best', 'Traditional-Matrimony Men'),
      MatchTrait('good', 'Untouched-Heart Men'),
      MatchTrait('good', 'Hopeless-Romantic Men'),
    ],
    avoidTraits: [AvoidTrait('Casual-Generous'), AvoidTrait('Rebound-Healing')],
    brings: ['Clarity of intent', 'Ambition in life and love', 'Partnership-first mindset', 'Long-term thinking', 'Emotional intelligence under pressure'],
  ),
  'traditional_matrimony_woman': Archetype(
    'traditional_matrimony_woman', '🏛️', 'Traditional-Matrimony',
    'Family fit, cultural match, matrimony is the goal',
    longTag: 'Marriage isn\'t a milestone — it\'s the direction. Family alignment, cultural fit and shared values are the foundation, not the fine print.',
    matchTraits: [
      MatchTrait('best', 'Forever-Focused Men', lead: true),
      MatchTrait('best', 'Traditional-Matrimony Men'),
      MatchTrait('good', 'Hopeless-Romantic Men'),
    ],
    avoidTraits: [AvoidTrait('Casual-Generous'), AvoidTrait('Rebound-Healing'), AvoidTrait('Untouched-Heart')],
    brings: ['Family-first values', 'Cultural alignment', 'Commitment with zero ambiguity', 'Clear expectations upfront', 'Stability & long-term partnership'],
  ),
  'second_chapter_woman': Archetype(
    'second_chapter_woman', '🌺', 'Second-Chapter',
    'Loved or married before, starting over right',
    longTag: 'You\'ve loved or married before. You\'re ready to try again — right this time. Wiser, softer in the right places, and done settling.',
    matchTraits: [
      MatchTrait('best', 'Second-Chapter Men', lead: true),
      MatchTrait('good', 'Traditional-Matrimony Men'),
      MatchTrait('good', 'Forever-Focused Men'),
    ],
    avoidTraits: [AvoidTrait('Spoiled-Casual'), AvoidTrait('Rebound-Healing')],
    brings: ['Emotional maturity', 'Clarity on what she needs', 'No games — only real', 'Appreciation without desperation', 'Strength that comes from having survived'],
  ),
  'just_friends_woman': Archetype(
    'just_friends_woman', '🫂', 'Just-Friends',
    'Not looking to date — looking to connect',
    longTag: 'You\'re not here for romance. You want real people to talk to — no chase, no expectations, just good energy and honest connection.',
    matchTraits: [
      MatchTrait('best', 'Just-Friends Men', lead: true),
      MatchTrait('good', 'Untouched-Heart Men'),
      MatchTrait('good', 'Rebound-Healing Men'),
    ],
    avoidTraits: [AvoidTrait('Forever-Focused'), AvoidTrait('Traditional-Matrimony')],
    brings: ['Zero pressure or hidden agenda', 'Warm, genuine company', 'Emotional safety', 'Real conversation', 'Friendship that actually sticks'],
  ),
};

/// Look up an archetype's display metadata by raw id (either gender).
Archetype? archetypeFor(String id) => _man[id] ?? _woman[id];

/// "What He Brings" items per male archetype (mirrors ARCHETYPE_BRINGS in
/// src/routes/verified-vibe/profile/+page.svelte). Women have no brings map.
class BringsItem {
  final String emoji;
  final String text;
  const BringsItem(this.emoji, this.text);
}

const Map<String, List<BringsItem>> archetypeBrings = {
  'casual_man': [
    BringsItem('✌️', 'Easy energy'), BringsItem('🤝', 'Honest intentions'),
    BringsItem('💬', 'Good conversation'), BringsItem('🌱', 'Low pressure'),
    BringsItem('⏱️', 'Quality time'),
  ],
  'casual_generous_man': [
    BringsItem('💰', 'Financial stability'), BringsItem('🍾', 'Generosity on dates'),
    BringsItem('🗓️', 'Time he actually gives you'), BringsItem('🔒', 'Privacy & discretion'),
    BringsItem('💭', 'Real opinions, gently held'),
  ],
  'forever_focused_man': [
    BringsItem('💙', 'Emotional depth'), BringsItem('🎯', 'Long-term clarity'),
    BringsItem('🌿', 'Shared values'), BringsItem('🏠', 'Consistent presence'),
    BringsItem('💍', 'Real commitment'),
  ],
  'hopeless_romantic_man': [
    BringsItem('🌹', 'Romantic thoughtfulness'), BringsItem('💕', 'Emotional availability'),
    BringsItem('🌊', 'Deep connection'), BringsItem('⚡', 'All-in energy'),
    BringsItem('🎁', 'Genuine gestures'),
  ],
  'traditional_matrimony_man': [
    BringsItem('👨‍👩‍👧', 'Family values'), BringsItem('🏡', 'Stability'),
    BringsItem('🌺', 'Cultural alignment'), BringsItem('🗺️', 'Clear life plan'),
    BringsItem('🤲', 'Lifelong respect'),
  ],
  'second_chapter_man': [
    BringsItem('🧠', 'Hard-earned wisdom'), BringsItem('🌿', 'Emotional maturity'),
    BringsItem('🎯', 'Clarity on what he wants'), BringsItem('⚓', 'Grounded presence'),
    BringsItem('🤝', 'Real partnership'),
  ],
  'untouched_heart_man': [
    BringsItem('✨', 'Authenticity'), BringsItem('👁️', 'Fresh perspective'),
    BringsItem('💚', 'Open heart'), BringsItem('🔍', 'Curiosity'),
    BringsItem('🕊️', 'No baggage'),
  ],
  'just_friends_man': [
    BringsItem('😊', 'Good company'), BringsItem('🌬️', 'Zero pressure'),
    BringsItem('💬', 'Easy conversation'), BringsItem('🤗', 'Genuine connection'),
    BringsItem('⚡', 'Consistent energy'),
  ],
  'rebound_healing_man': [
    BringsItem('🤝', 'Honest intentions'), BringsItem('🌸', 'Light touch'),
    BringsItem('✨', 'Fun energy'), BringsItem('🧘', 'Present focus'),
    BringsItem('📸', 'Real moments'),
  ],
  // ── Female archetypes ──────────────────────────────────────────────────────
  'spoiled_casual_woman': [
    BringsItem('✨', 'High standards'), BringsItem('💅', 'Effortless charm'),
    BringsItem('😄', 'Fun energy'), BringsItem('🎯', 'Knows what she wants'),
    BringsItem('💬', 'Honest vibes'),
  ],
  'hopeless_romantic_woman': [
    BringsItem('🌹', 'Deep affection'), BringsItem('💕', 'Emotional warmth'),
    BringsItem('🎁', 'Thoughtful gestures'), BringsItem('🌊', 'All-in energy'),
    BringsItem('✨', 'Magic in small moments'),
  ],
  'rebound_healing_woman': [
    BringsItem('🌿', 'Growth mindset'), BringsItem('🧘', 'Emotional awareness'),
    BringsItem('💬', 'Honest communication'), BringsItem('🌸', 'Gentle energy'),
    BringsItem('🤝', 'Real intentions'),
  ],
  'untouched_heart_woman': [
    BringsItem('🌸', 'Pure heart'), BringsItem('👁️', 'Fresh perspective'),
    BringsItem('💚', 'Openness'), BringsItem('🕊️', 'No baggage'),
    BringsItem('✨', 'Genuine curiosity'),
  ],
  'forever_focused_woman': [
    BringsItem('💍', 'Clarity on commitment'), BringsItem('🏡', 'Family vision'),
    BringsItem('💙', 'Emotional depth'), BringsItem('🌿', 'Shared values'),
    BringsItem('🎯', 'Long-term focus'),
  ],
  'traditional_matrimony_woman': [
    BringsItem('🏛️', 'Family-first values'), BringsItem('🤝', 'Cultural alignment'),
    BringsItem('💍', 'Commitment with zero ambiguity'), BringsItem('📋', 'Clear expectations upfront'),
    BringsItem('🏠', 'Stability & long-term partnership'),
  ],
  'second_chapter_woman': [
    BringsItem('🌺', 'Emotional maturity'), BringsItem('🎯', 'Clarity on what she needs'),
    BringsItem('💬', 'No games — only real'), BringsItem('💚', 'Appreciation without desperation'),
    BringsItem('💪', 'Strength that comes from having survived'),
  ],
  'just_friends_woman': [
    BringsItem('🫂', 'Zero pressure or hidden agenda'), BringsItem('☀️', 'Warm, genuine company'),
    BringsItem('🛡️', 'Emotional safety'), BringsItem('💬', 'Real conversation'),
    BringsItem('🌱', 'Friendship that actually sticks'),
  ],
};

List<LaneSection> laneSectionsFor(String gender) {
  final m = gender == 'woman' ? _woman : _man;
  final suffix = gender == 'woman' ? '_woman' : '_man';
  return [
    LaneSection('Serious Connection', [
      m['traditional_matrimony$suffix']!,
      m['forever_focused$suffix']!,
      m['hopeless_romantic$suffix']!,
      m['second_chapter$suffix']!,
    ]),
    LaneSection('Low-Pressure', [
      m[(gender == 'woman' ? 'spoiled_casual' : 'casual_generous') + suffix]!,
      m['rebound_healing$suffix']!,
      m['untouched_heart$suffix']!,
      m['just_friends$suffix']!,
    ]),
  ];
}
