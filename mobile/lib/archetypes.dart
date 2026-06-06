/// Archetype catalog (mirrors src/lib/verified-vibe/constants.ts) — id, emoji,
/// name, tag — grouped into the two lanes shown at selection, per gender.
class Archetype {
  final String id;
  final String emoji;
  final String name;
  final String tag;
  const Archetype(this.id, this.emoji, this.name, this.tag);
}

class LaneSection {
  final String label;
  final List<Archetype> archetypes;
  const LaneSection(this.label, this.archetypes);
}

const _man = <String, Archetype>{
  'casual_generous_man': Archetype('casual_generous_man', '💸', 'Casual-Generous', 'Confident, generous, experiences over labels'),
  'rebound_healing_man': Archetype('rebound_healing_man', '🌱', 'Rebound-Healing', 'Recovering, honest, not rushing'),
  'untouched_heart_man': Archetype('untouched_heart_man', '🕊️', 'Untouched-Heart', 'Inexperienced, sincere, going slow'),
  'just_friends_man': Archetype('just_friends_man', '🤝', 'Just-Friends', 'Not looking to date — looking to connect'),
  'traditional_matrimony_man': Archetype('traditional_matrimony_man', '🏛️', 'Traditional-Matrimony', 'Hard set on matrimony, family values'),
  'forever_focused_man': Archetype('forever_focused_man', '🎯', 'Forever-Focused', 'Marriage-minded, intentional, done with games'),
  'hopeless_romantic_man': Archetype('hopeless_romantic_man', '💞', 'Hopeless-Romantic', 'Emotionally intense, chasing the deep thing'),
  'second_chapter_man': Archetype('second_chapter_man', '🔄', 'Second-Chapter', 'Loved or married before, ready to do it right'),
};

const _woman = <String, Archetype>{
  'spoiled_casual_woman': Archetype('spoiled_casual_woman', '✨', 'Spoiled-Casual', 'Luxury vibes, treated well, no pressure'),
  'rebound_healing_woman': Archetype('rebound_healing_woman', '🌿', 'Rebound-Healing', 'Recovering, honest, finding her footing'),
  'untouched_heart_woman': Archetype('untouched_heart_woman', '🌸', 'Untouched-Heart', 'First steps, sincere, no games in her'),
  'just_friends_woman': Archetype('just_friends_woman', '🫂', 'Just-Friends', 'Not looking to date — looking to connect'),
  'traditional_matrimony_woman': Archetype('traditional_matrimony_woman', '🏛️', 'Traditional-Matrimony', 'Family fit, cultural match, matrimony is the goal'),
  'forever_focused_woman': Archetype('forever_focused_woman', '💍', 'Forever-Focused', 'Marriage-minded, knows what she wants'),
  'hopeless_romantic_woman': Archetype('hopeless_romantic_woman', '🌹', 'Hopeless-Romantic', 'Emotionally intense, chasing the deep thing'),
  'second_chapter_woman': Archetype('second_chapter_woman', '🌺', 'Second-Chapter', 'Loved or married before, starting over right'),
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
